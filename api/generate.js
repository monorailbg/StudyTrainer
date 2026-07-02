/**
 * api/generate.js — Vercel Serverless Function
 *
 * Multi-provider failover pipeline:
 *   Stage 1 → GEMINI_PRIMARY  (gemini-2.5-flash + model fallbacks)
 *   Stage 2 → GEMINI_BACKUP   (same model ladder, backup key)
 *   Stage 3 → GROQ_BACKUP     (llama3-8b-8192, text-only)
 *
 * Key env vars (Vercel → Project Settings → Environment Variables):
 *   GEMINI_API_KEY            Primary Gemini key   (required)
 *   BACKUP_GEMINI_API_KEY     Backup  Gemini key   (optional)
 *   GROQ_API_KEY              Groq key             (optional)
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_BASE   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL  = 'llama-3.1-8b-instant';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

// ── Key resolution ─────────────────────────────────────────────────────────

function resolveKeys() {
  const primary = (process.env.GEMINI_API_KEY          || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim();
  const backup  = (process.env.BACKUP_GEMINI_API_KEY   || process.env.NEXT_PUBLIC_BACKUP_GEMINI_API_KEY)?.trim();
  const groq    = (process.env.GROQ_API_KEY             || process.env.NEXT_PUBLIC_GROQ_API_KEY)?.trim();

  if (!primary) {
    throw new Error('GEMINI_API_KEY is not set. Add it in Vercel → Project Settings → Environment Variables.');
  }

  return { primary, backup: backup || null, groq: groq || null };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isPerMinuteLimit(msg) {
  const lower = msg.toLowerCase();
  return lower.includes('per minute') || lower.includes('rpm') || lower.includes('rate_limit_exceeded');
}

function retryDelayMs(msg) {
  const match = msg.match(/retry\s+in\s+([\d.]+)\s*s/i);
  return match ? (Math.ceil(parseFloat(match[1])) + 2) * 1000 : 65_000;
}

function isQuotaExhausted(msg) {
  return (
    (msg.includes('429') && !isPerMinuteLimit(msg)) ||
    (msg.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(msg)) ||
    msg.toLowerCase().includes('quota')
  );
}

function isUnavailable(msg) {
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.toLowerCase().includes('high demand');
}

// A 401/403 means THIS key is bad (revoked, expired, or its backing Google
// Cloud project has been denied access/suspended) — not that the request
// itself was malformed. That's exactly the case the backup key exists for:
// a different key/project may still be perfectly healthy. Retrying the same
// key against other models would fail identically, so this only gates
// failover to the NEXT key/provider, not the per-model ladder.
function isKeyRejected(msg) {
  return (
    msg.includes('401') || msg.includes('403') ||
    msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') ||
    msg.toLowerCase().includes('denied access')
  );
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Generic exponential-backoff-with-jitter retry wrapper for transient
 * 503 UNAVAILABLE / high-demand errors from the Gemini API. `apiFn` is
 * retried up to `maxRetries` times; any other error (auth, bad request,
 * quota) is rethrown immediately without retrying.
 */
async function callGeminiWithRetry(apiFn, maxRetries = 3, initialDelay = 1000) {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiFn();
    } catch (error) {
      const msg = String(error?.message ?? error);
      if (isUnavailable(msg) && attempt < maxRetries) {
        // Random jitter prevents every retrying client from hammering the API in lockstep.
        const jitter = Math.random() * 200;
        console.warn(`[generate] Model unavailable (503); retrying in ${Math.round((delay + jitter) / 1000)}s… (attempt ${attempt}/${maxRetries})`);
        await sleep(delay + jitter);
        delay *= 2; // Exponentially increase delay
        continue;
      }
      throw error; // Not a 503, or retries exhausted — rethrow
    }
  }
}

// ── Gemini REST: single model call ────────────────────────────────────────

async function fetchGeminiOnce(apiKey, model, contents, genConfig) {
  const url = `${GEMINI_BASE}/${model}:generateContent`;
  const body = { contents };
  if (genConfig && Object.keys(genConfig).length) body.generationConfig = genConfig;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg  = errData.error?.message ?? res.statusText ?? String(res.status);
    const errCode = errData.error?.status ?? '';
    throw new Error(`${res.status} ${errCode}: ${errMsg}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini.');
  return text;
}

async function callGeminiModel(apiKey, model, contents, genConfig, maxPerMinuteAttempts = 2) {
  // 503 UNAVAILABLE gets exponential backoff + jitter via callGeminiWithRetry.
  // Per-minute 429s get their own inner loop, since the API tells us exactly
  // how long to wait rather than needing a doubling schedule.
  for (let attempt = 1; attempt <= maxPerMinuteAttempts; attempt++) {
    try {
      return await callGeminiWithRetry(() => fetchGeminiOnce(apiKey, model, contents, genConfig));
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (msg.includes('429') && isPerMinuteLimit(msg) && attempt < maxPerMinuteAttempts) {
        const delay = retryDelayMs(msg);
        console.warn(`[generate] ${model} per-minute rate-limited; retrying in ${delay / 1000}s…`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

// ── Gemini REST: model-ladder for one key ─────────────────────────────────

async function callGeminiKey(apiKey, contents, genConfig, label) {
  let lastError;

  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiModel(apiKey, model, contents, genConfig);
    } catch (err) {
      lastError = err;
      const msg = String(err);
      const isDailyQuota  = msg.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(msg);
      const isRetired     = msg.includes('404');
      const isOverloaded  = isUnavailable(msg);

      if (isDailyQuota || isRetired || isOverloaded) {
        console.warn(`[generate] ${label} model ${model} unavailable (${msg.slice(0, 80)}), trying next model…`);
        continue;
      }

      // Auth / bad request — no point trying other models with this key.
      throw err;
    }
  }

  throw lastError ?? new Error(`All models exhausted for ${label}.`);
}

// ── Groq REST: text-only fallback ─────────────────────────────────────────

function extractTextFromParts(parts) {
  const texts = parts.filter(p => p.text).map(p => p.text);
  if (texts.length === 0) throw new Error('Groq fallback requires at least one text part.');
  return texts.join('\n\n');
}

async function callGroq(groqKey, parts, temperature) {
  const content = extractTextFromParts(parts);

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content }],
      temperature: typeof temperature === 'number' ? temperature : 0.7,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg  = errData.error?.message ?? res.statusText ?? String(res.status);
    throw new Error(`Groq ${res.status}: ${errMsg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq.');
  return text;
}

// ── Failover orchestrator ──────────────────────────────────────────────────

async function generateWithFailover(parts, temperature, genConfig) {
  const { primary, backup, groq } = resolveKeys();
  const contents = [{ role: 'user', parts }];

  // ── Stage 1: Primary Gemini key ──────────────────────────────────────────
  try {
    const text = await callGeminiKey(primary, contents, genConfig, 'GEMINI_PRIMARY');
    return text;
  } catch (err) {
    const msg = String(err);
    if (!isQuotaExhausted(msg) && !isUnavailable(msg) && !isKeyRejected(msg)) throw err; // bad request — don't failover
    if (isKeyRejected(msg)) console.warn('[generate] ⚠️  GEMINI_PRIMARY key rejected (401/403) — failing over to GEMINI_BACKUP…');
    else console.warn('[generate] ⚠️  GEMINI_PRIMARY unavailable — failing over to GEMINI_BACKUP…');
  }

  // ── Stage 2: Backup Gemini key ───────────────────────────────────────────
  if (backup) {
    try {
      const text = await callGeminiKey(backup, contents, genConfig, 'GEMINI_BACKUP');
      console.warn('[generate] ✅ Request served by GEMINI_BACKUP.');
      return text;
    } catch (err) {
      const msg = String(err);
      if (!isQuotaExhausted(msg) && !isUnavailable(msg) && !isKeyRejected(msg)) throw err;
      console.warn('[generate] ⚠️  GEMINI_BACKUP unavailable — failing over to GROQ_BACKUP…');
    }
  } else {
    console.warn('[generate] ℹ️  No BACKUP_GEMINI_API_KEY configured — skipping to GROQ_BACKUP…');
  }

  // ── Stage 3: Groq fallback ───────────────────────────────────────────────
  if (groq) {
    console.warn(`[generate] ⚠️  Routing to GROQ_BACKUP (${GROQ_MODEL})…`);
    const text = await callGroq(groq, parts, temperature);
    console.warn('[generate] ✅ Request served by GROQ_BACKUP.');
    return text;
  }

  throw new Error(
    'All AI providers exhausted. Configure BACKUP_GEMINI_API_KEY and/or GROQ_API_KEY to enable failover.',
  );
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { parts, temperature, maxOutputTokens, responseMimeType, responseSchema } = req.body ?? {};

  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "parts" array.' });
  }

  for (const part of parts) {
    if (!part.text && !part.inline_data && !part.file_data) {
      return res.status(400).json({ error: 'Each part must have "text", "inline_data", or "file_data".' });
    }
  }

  const genConfig = {};
  if (typeof temperature === 'number') genConfig.temperature = temperature;
  if (typeof maxOutputTokens === 'number' && maxOutputTokens > 0) genConfig.maxOutputTokens = maxOutputTokens;
  if (typeof responseMimeType === 'string' && responseMimeType.trim()) genConfig.responseMimeType = responseMimeType.trim();
  if (responseSchema && typeof responseSchema === 'object') genConfig.responseSchema = responseSchema;

  try {
    const text = await generateWithFailover(parts, temperature, Object.keys(genConfig).length ? genConfig : undefined);
    return res.json({ text });
  } catch (err) {
    console.error('[generate] Fatal error:', err);
    const msg = String(err);

    if (msg.includes('401') || msg.includes('API_KEY_INVALID')) {
      return res.status(401).json({ error: 'Invalid or expired API key.' });
    }
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
      return res.status(403).json({
        error: 'The Gemini API key\'s Google Cloud project has been denied access (not just an invalid key — the project itself is blocked, often due to billing or a ToS review). Generate a new API key from a different/healthy Google Cloud project, or set BACKUP_GEMINI_API_KEY to a working key so requests fail over automatically.',
      });
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return res.status(429).json({ error: 'All AI provider quotas exhausted. Try again tomorrow.' });
    }
    if (msg.includes('400')) {
      // Include the real underlying reason (Gemini's or Groq's actual
      // message) instead of a canned string — a 400 here can mean the
      // request was genuinely malformed, but it can just as easily be a
      // Groq fallback failing (e.g. a decommissioned model) after Gemini
      // was skipped due to rate limits, which is not diagnosable at all
      // from a generic "check your prompt" message.
      return res.status(400).json({ error: `AI rejected the request: ${msg.slice(0, 200)}` });
    }
    if (isUnavailable(msg)) {
      return res.status(503).json({ error: 'The AI model is temporarily experiencing high demand. Please try again in a moment.' });
    }
    return res.status(500).json({ error: msg.slice(0, 200) || 'Generation failed. Please try again.' });
  }
}

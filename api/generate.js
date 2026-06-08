/**
 * api/generate.js — Vercel Serverless Function
 *
 * Uses the Gemini REST API directly (no SDK) to avoid bundling issues.
 * GEMINI_API_KEY must be set in Vercel → Project Settings → Environment Variables.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not set. Add it in Vercel → Project Settings → Environment Variables.');
  return key;
}

function isPerMinuteLimit(msg) {
  const lower = msg.toLowerCase();
  return lower.includes('per minute') || lower.includes('rpm') || lower.includes('rate_limit_exceeded');
}

function retryDelayMs(msg) {
  const match = msg.match(/retry\s+in\s+([\d.]+)\s*s/i);
  return match ? (Math.ceil(parseFloat(match[1])) + 2) * 1000 : 65_000;
}

// ── Core REST call ──────────────────────────────────────────────────────────

async function callModel(apiKey, model, contents, genConfig, maxAttempts = 2) {
  const url = `${GEMINI_BASE}/${model}:generateContent`;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const body = { contents };
      if (genConfig && Object.keys(genConfig).length) body.generationConfig = genConfig;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error?.message ?? res.statusText ?? String(res.status);
        const errStatus = errData.error?.status ?? '';
        throw new Error(`${res.status} ${errStatus}: ${errMsg}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini.');
      return text;

    } catch (err) {
      lastError = err;
      const msg = String(err);
      if (msg.includes('429') && isPerMinuteLimit(msg) && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, retryDelayMs(msg)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function callGeminiWithFallback(apiKey, contents, genConfig) {
  let lastError;
  for (const model of MODELS) {
    try {
      return await callModel(apiKey, model, contents, genConfig);
    } catch (err) {
      lastError = err;
      const msg = String(err);
      const isDailyQuota = msg.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(msg);
      if (isDailyQuota || msg.includes('404')) continue;
      throw err;
    }
  }
  throw lastError ?? new Error('All Gemini models exhausted.');
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { parts, temperature } = req.body ?? {};

  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "parts" array.' });
  }

  for (const part of parts) {
    if (!part.text && !part.inline_data) {
      return res.status(400).json({ error: 'Each part must have either "text" or "inline_data".' });
    }
  }

  let apiKey;
  try {
    apiKey = getApiKey();
  } catch (err) {
    console.error('[generate] Config error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }

  // The Gemini REST API accepts snake_case (inline_data, mime_type) directly.
  const contents = [{ role: 'user', parts }];
  const genConfig = typeof temperature === 'number' ? { temperature } : undefined;

  try {
    const text = await callGeminiWithFallback(apiKey, contents, genConfig);
    return res.json({ text });
  } catch (err) {
    console.error('[generate] Gemini error:', err);
    const msg = String(err);

    if (msg.includes('401') || msg.includes('API_KEY_INVALID')) {
      return res.status(401).json({ error: 'Invalid or expired Gemini API key.' });
    }
    if (msg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'All Gemini model quotas exhausted. Try again tomorrow.' });
    }
    if (msg.includes('400')) {
      return res.status(400).json({ error: 'Gemini rejected the request. Check your prompt or file type.' });
    }
    return res.status(500).json({ error: msg.slice(0, 200) || 'Generation failed. Please try again.' });
  }
}

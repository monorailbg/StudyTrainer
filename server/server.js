/**
 * StudyTrainer — Gemini API Proxy Server
 *
 * Sits between the browser and the Gemini API so the API key never touches
 * the client bundle. All generation requests hit POST /api/generate here;
 * the server validates, rate-limits, and forwards them to Gemini.
 *
 * Start:   node server.js          (production)
 * Dev:     node --watch server.js  (auto-restarts on file changes, Node ≥ 18)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

// ── 1. Key resolution ──────────────────────────────────────────────────────
//
// Multi-provider failover:  GEMINI_PRIMARY → GEMINI_BACKUP → GROQ_BACKUP

const GEMINI_PRIMARY_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_BACKUP_KEY  = process.env.BACKUP_GEMINI_API_KEY?.trim() || null;
const GROQ_KEY           = process.env.GROQ_API_KEY?.trim() || null;

if (!GEMINI_PRIMARY_KEY) {
  console.error(
    '\n[FATAL] GEMINI_API_KEY is not set.\n' +
    'Copy server/.env.example → server/.env and add your key.\n',
  );
  process.exit(1);
}

// ── 2. Gemini clients ──────────────────────────────────────────────────────

const aiPrimary = new GoogleGenAI({ apiKey: GEMINI_PRIMARY_KEY });
const aiBackup  = GEMINI_BACKUP_KEY ? new GoogleGenAI({ apiKey: GEMINI_BACKUP_KEY }) : null;

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

const GROQ_BASE  = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-8b-8192';

// ── 3. Express setup ────────────────────────────────────────────────────────

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Parse allowed origins from the env var (comma-separated).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    // Only permit requests from known frontend origins.
    origin: (requestOrigin, callback) => {
      // Allow same-origin / non-browser (e.g. curl) requests in development.
      if (!requestOrigin || ALLOWED_ORIGINS.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin "${requestOrigin}" is not allowed.`));
      }
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);

// Body limit: 20 MB to accommodate base64-encoded file uploads.
app.use(express.json({ limit: '20mb' }));

// ── 4. Rate limiter ─────────────────────────────────────────────────────────

/**
 * Scoped to the /api/generate route — 10 requests per minute per IP.
 * Adjust windowMs / max to match your expected traffic and Gemini free-tier
 * quota (2.5-flash: 10 RPM on the free tier as of 2025).
 */
const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // requests per window per IP
  standardHeaders: 'draft-7', // Return RateLimit-* headers (RFC 9110 draft)
  legacyHeaders: false,

  // Custom response so the frontend can show a friendly message.
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests. You can send up to 10 requests per minute.',
      retryAfter: 60,
    });
  },
});

// ── 5. Helper: transform snake_case parts → SDK camelCase ──────────────────

function normaliseParts(parts) {
  return parts.map(part => {
    if (part.inline_data) {
      return { inlineData: { mimeType: part.inline_data.mime_type, data: part.inline_data.data } };
    }
    if (part.file_data) {
      return { fileData: { mimeType: part.file_data.mime_type, fileUri: part.file_data.file_uri } };
    }
    return part;
  });
}

// ── 6. Failover helpers ────────────────────────────────────────────────────

function isPerMinuteLimit(message) {
  const lower = message.toLowerCase();
  return lower.includes('per minute') || lower.includes('rpm') || lower.includes('rate_limit_exceeded');
}

function retryDelayMs(errorMessage) {
  const match = errorMessage.match(/retry\s+in\s+([\d.]+)\s*s/i);
  return match ? (Math.ceil(parseFloat(match[1])) + 2) * 1000 : 65_000;
}

function isQuotaExhausted(message) {
  return (
    (message.includes('429') && !isPerMinuteLimit(message)) ||
    (message.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(message)) ||
    message.toLowerCase().includes('quota')
  );
}

function isUnavailable(message) {
  return message.includes('503') || message.includes('UNAVAILABLE') || message.toLowerCase().includes('high demand');
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
        console.warn(`[proxy] Model unavailable (503); retrying in ${Math.round((delay + jitter) / 1000)}s… (attempt ${attempt}/${maxRetries})`);
        await sleep(delay + jitter);
        delay *= 2; // Exponentially increase delay
        continue;
      }
      throw error; // Not a 503, or retries exhausted — rethrow
    }
  }
}

// ── 7. Gemini SDK: single model call ─────────────────────────────────────

async function callGeminiModel(client, model, sdkContents, config, maxPerMinuteAttempts = 2) {
  for (let attempt = 1; attempt <= maxPerMinuteAttempts; attempt++) {
    try {
      return await callGeminiWithRetry(async () => {
        const response = await client.models.generateContent({
          model,
          contents: sdkContents,
          ...(config && { config }),
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from Gemini.');
        return text;
      });
    } catch (err) {
      const message = String(err?.message ?? err);

      if (message.includes('429') && isPerMinuteLimit(message) && attempt < maxPerMinuteAttempts) {
        const delay = retryDelayMs(message);
        console.warn(`[proxy] Model ${model} per-minute rate-limited; retrying in ${delay / 1000}s…`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

// ── 8. Gemini SDK: model-ladder for one client ────────────────────────────

async function callGeminiClient(client, sdkContents, config, label) {
  let lastError;

  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiModel(client, model, sdkContents, config);
    } catch (err) {
      lastError = err;
      const message = String(err);
      const isDailyQuota = message.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(message);
      const isRetired    = message.includes('404');
      const isOverloaded = isUnavailable(message);

      if (isDailyQuota || isRetired || isOverloaded) {
        console.warn(`[proxy] ${label} model ${model} unavailable (${message.slice(0, 80)}), trying next…`);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error(`All models exhausted for ${label}.`);
}

// ── 9. Groq REST: text-only fallback ─────────────────────────────────────

function extractTextFromParts(parts) {
  const texts = parts.filter(p => p.text).map(p => p.text);
  if (texts.length === 0) throw new Error('Groq fallback requires at least one text part.');
  return texts.join('\n\n');
}

async function callGroq(rawParts, temperature) {
  const content = extractTextFromParts(rawParts);

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
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

// ── 10. Failover orchestrator ─────────────────────────────────────────────

async function generateWithFailover(rawParts, temperature, config) {
  const sdkContents = [{ role: 'user', parts: normaliseParts(rawParts) }];

  // Stage 1: Primary Gemini key
  try {
    return await callGeminiClient(aiPrimary, sdkContents, config, 'GEMINI_PRIMARY');
  } catch (err) {
    const msg = String(err);
    if (!isQuotaExhausted(msg) && !isUnavailable(msg)) throw err;
    console.warn('[proxy] ⚠️  GEMINI_PRIMARY unavailable — failing over to GEMINI_BACKUP…');
  }

  // Stage 2: Backup Gemini key
  if (aiBackup) {
    try {
      const text = await callGeminiClient(aiBackup, sdkContents, config, 'GEMINI_BACKUP');
      console.warn('[proxy] ✅ Request served by GEMINI_BACKUP.');
      return text;
    } catch (err) {
      const msg = String(err);
      if (!isQuotaExhausted(msg) && !isUnavailable(msg)) throw err;
      console.warn('[proxy] ⚠️  GEMINI_BACKUP unavailable — failing over to GROQ_BACKUP…');
    }
  } else {
    console.warn('[proxy] ℹ️  No BACKUP_GEMINI_API_KEY configured — skipping to GROQ_BACKUP…');
  }

  // Stage 3: Groq fallback (text-only)
  if (GROQ_KEY) {
    console.warn(`[proxy] ⚠️  Routing to GROQ_BACKUP (${GROQ_MODEL})…`);
    const text = await callGroq(rawParts, temperature);
    console.warn('[proxy] ✅ Request served by GROQ_BACKUP.');
    return text;
  }

  throw new Error(
    'All AI providers exhausted. Configure BACKUP_GEMINI_API_KEY and/or GROQ_API_KEY to enable failover.',
  );
}

// ── 7. Route: POST /api/init-upload ───────────────────────────────────────

/**
 * Starts a Gemini Files API resumable upload session.
 * Returns a short-lived upload URL the client uses to send file bytes
 * directly to Gemini — the API key never reaches the browser.
 */
app.post('/api/init-upload', async (req, res) => {
  const { mimeType, displayName, size } = req.body ?? {};
  if (!mimeType || !size) {
    return res.status(400).json({ error: '"mimeType" and "size" are required.' });
  }

  try {
    const initRes = await fetch(
      'https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(size),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({ file: { displayName: displayName ?? 'file' } }),
      },
    );

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      const msg = errData.error?.message ?? `HTTP ${initRes.status}`;
      return res.status(500).json({ error: `Gemini init-upload failed: ${msg}` });
    }

    const uploadUrl = initRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      return res.status(500).json({ error: 'Gemini did not return an upload URL.' });
    }

    return res.json({ uploadUrl });
  } catch (err) {
    console.error('[proxy] init-upload error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── 8. Route: POST /api/upload-chunk ──────────────────────────────────────

app.post('/api/upload-chunk', async (req, res) => {
  const { uploadUrl, chunkBase64, offset, isLast } = req.body ?? {};

  if (!uploadUrl || chunkBase64 === undefined || offset === undefined) {
    return res.status(400).json({ error: '"uploadUrl", "chunkBase64", and "offset" are required.' });
  }

  let chunk;
  try {
    chunk = Buffer.from(chunkBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 in "chunkBase64".' });
  }

  try {
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-Offset': String(offset),
        'X-Goog-Upload-Command': isLast ? 'upload, finalize' : 'upload',
      },
      body: chunk,
    });

    if (!isLast) {
      if (uploadRes.ok) return res.json({ ok: true });
      const errText = await uploadRes.text().catch(() => '');
      console.error('[proxy] upload-chunk non-final error:', uploadRes.status, errText.slice(0, 500));
      return res.status(500).json({ error: `Gemini chunk upload failed: HTTP ${uploadRes.status}` });
    }

    if (uploadRes.ok) {
      const data = await uploadRes.json().catch(() => ({}));
      const fileUri = data.file?.uri;
      if (!fileUri) return res.status(500).json({ error: 'No file URI after finalize.' });
      return res.json({ fileUri });
    }

    const errText = await uploadRes.text().catch(() => '');
    console.error('[proxy] upload-chunk final error:', uploadRes.status, errText.slice(0, 500));
    return res.status(500).json({ error: `Gemini chunk upload failed: HTTP ${uploadRes.status}` });
  } catch (err) {
    console.error('[proxy] upload-chunk error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── 11. Route: POST /api/generate ─────────────────────────────────────────

app.post('/api/generate', generateLimiter, async (req, res) => {
  const { parts, temperature, systemInstruction, maxOutputTokens, responseMimeType, responseSchema } = req.body ?? {};

  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "parts" array.' });
  }

  for (const part of parts) {
    if (!part.text && !part.inline_data && !part.file_data) {
      return res.status(400).json({ error: 'Each part must have "text", "inline_data", or "file_data".' });
    }
  }

  const config = {};
  if (typeof temperature === 'number') config.temperature = temperature;
  if (typeof maxOutputTokens === 'number' && maxOutputTokens > 0) config.maxOutputTokens = maxOutputTokens;
  if (typeof responseMimeType === 'string' && responseMimeType.trim()) config.responseMimeType = responseMimeType.trim();
  if (responseSchema && typeof responseSchema === 'object') config.responseSchema = responseSchema;
  if (typeof systemInstruction === 'string' && systemInstruction.trim()) {
    config.systemInstruction = systemInstruction.trim();
  }

  try {
    const text = await generateWithFailover(parts, temperature, Object.keys(config).length ? config : undefined);
    return res.json({ text });
  } catch (err) {
    console.error('[proxy] Fatal error:', err);
    const message = String(err);

    if (message.includes('401') || message.includes('API_KEY_INVALID')) {
      return res.status(401).json({ error: 'Invalid or expired API key.' });
    }
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
      return res.status(429).json({ error: 'All AI provider quotas exhausted. Try again tomorrow.' });
    }
    if (message.includes('400')) {
      return res.status(400).json({ error: 'AI rejected the request. Check your prompt or file type.' });
    }
    if (isUnavailable(message)) {
      return res.status(503).json({ error: 'The AI model is temporarily experiencing high demand. Please try again in a moment.' });
    }
    return res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

// ── 11b. Quiz "Ask AI" streaming route ─────────────────────────────────────

function buildQuizTutorPrompt(quizContext, userQuestion) {
  const { question, options, selectedOption, isCorrect, baseExplanation } = quizContext ?? {};
  const optionsList = Array.isArray(options) ? options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n') : '';

  return `You are an expert tutor helping a student understand a quiz question they just answered.
Analyze the provided quiz context, the user's answer, and the default explanation, then answer the user's specific point of confusion concisely and clearly. Use Markdown formatting where helpful (lists, bold, code, tables).

[QUIZ QUESTION]
${question ?? ''}

[OPTIONS]
${optionsList}

[STUDENT'S ANSWER]
${selectedOption ?? ''} (${isCorrect ? 'Correct' : 'Incorrect'})

[DEFAULT EXPLANATION]
${baseExplanation ?? ''}

[STUDENT'S FOLLOW-UP QUESTION]
${userQuestion}

Answer the student's follow-up question directly and concisely.`;
}

async function* streamGeminiClient(client, model, prompt) {
  const stream = await client.models.generateContentStream({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature: 0.4, maxOutputTokens: 2048 },
  });
  let gotAnyText = false;
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) { gotAnyText = true; yield text; }
  }
  if (!gotAnyText) throw new Error('Empty streamed response from Gemini.');
}

async function* streamGeminiClientLadder(client, prompt, label) {
  let lastError;
  for (const model of GEMINI_MODELS) {
    try {
      yield* streamGeminiClient(client, model, prompt);
      return;
    } catch (err) {
      lastError = err;
      const message = String(err);
      const isDailyQuota = message.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(message);
      const isRetired    = message.includes('404');
      if (isDailyQuota || isRetired) {
        console.warn(`[ask-ai] ${label} model ${model} unavailable (${message.slice(0, 80)}), trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error(`All models exhausted for ${label}.`);
}

app.post('/api/quiz/ask-ai', generateLimiter, async (req, res) => {
  const { userQuestion, quizContext } = req.body ?? {};
  if (typeof userQuestion !== 'string' || !userQuestion.trim()) {
    return res.status(400).json({ error: 'Request body must include a non-empty "userQuestion" string.' });
  }
  if (!quizContext || typeof quizContext !== 'object') {
    return res.status(400).json({ error: 'Request body must include a "quizContext" object.' });
  }

  const prompt = buildQuizTutorPrompt(quizContext, userQuestion.trim());

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });

  try {
    try {
      for await (const chunk of streamGeminiClientLadder(aiPrimary, prompt, 'GEMINI_PRIMARY')) res.write(chunk);
      return res.end();
    } catch (err) {
      const msg = String(err);
      if (!isQuotaExhausted(msg)) throw err;
      console.warn('[ask-ai] ⚠️  GEMINI_PRIMARY quota exhausted — failing over to GEMINI_BACKUP…');
    }

    if (aiBackup) {
      try {
        for await (const chunk of streamGeminiClientLadder(aiBackup, prompt, 'GEMINI_BACKUP')) res.write(chunk);
        return res.end();
      } catch (err) {
        const msg = String(err);
        if (!isQuotaExhausted(msg)) throw err;
        console.warn('[ask-ai] ⚠️  GEMINI_BACKUP quota exhausted — failing over to GROQ_BACKUP…');
      }
    }

    if (GROQ_KEY) {
      const text = await callGroq([{ text: prompt }], 0.4);
      res.write(text);
      return res.end();
    }

    throw new Error('All AI providers exhausted.');
  } catch (err) {
    console.error('[ask-ai] Fatal error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: String(err.message ?? err).slice(0, 200) });
    }
    res.write('\n\n_[Error: response interrupted. Please try again.]_');
    return res.end();
  }
});

// ── 12. Health-check route ─────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 13. 404 catch-all ─────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── 14. Start ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[proxy] AI proxy running on http://localhost:${PORT}`);
  console.log(`[proxy] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`[proxy] Failover: GEMINI_PRIMARY ✓ | GEMINI_BACKUP ${aiBackup ? '✓' : '✗ (BACKUP_GEMINI_API_KEY not set)'} | GROQ ${GROQ_KEY ? '✓' : '✗ (GROQ_API_KEY not set)'}`);
});

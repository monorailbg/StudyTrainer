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

// ── 1. Fail fast if the API key is missing ─────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

if (!GEMINI_API_KEY) {
  console.error(
    '\n[FATAL] GEMINI_API_KEY is not set.\n' +
    'Copy server/.env.example → server/.env and add your key.\n',
  );
  process.exit(1);
}

// ── 2. Gemini client (server-side only) ────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Priority-ordered list of models to attempt.
 * Falls through to the next when a model returns 404 (retired) or
 * RESOURCE_EXHAUSTED on a daily quota (not a per-minute rate limit).
 */
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

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

/**
 * The existing frontend sends parts in Gemini REST snake_case format
 * (`inline_data`, `mime_type`). The @google/genai SDK expects camelCase
 * (`inlineData`, `mimeType`). This function normalises them.
 *
 * @param {Array<{text?: string, inline_data?: {mime_type: string, data: string}}>} parts
 * @returns {Array<{text?: string, inlineData?: {mimeType: string, data: string}}>}
 */
function normaliseParts(parts) {
  return parts.map(part => {
    if (part.inline_data) {
      return { inlineData: { mimeType: part.inline_data.mime_type, data: part.inline_data.data } };
    }
    if (part.file_data) {
      return { fileData: { mimeType: part.file_data.mime_type, fileUri: part.file_data.file_uri } };
    }
    return part; // { text: '...' } is identical in both formats
  });
}

// ── 6. Helper: model-fallback + per-minute retry loop ──────────────────────

/**
 * Returns true if the error is a per-minute rate limit (transient) rather
 * than a daily quota exhaustion or missing model (permanent for now).
 */
function isPerMinuteLimit(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes('per minute') ||
    lower.includes('rpm') ||
    lower.includes('rate_limit_exceeded')
  );
}

/**
 * Extracts the server-suggested retry delay from a 429 error message.
 * Falls back to 65 s (safe default above the 1-minute window).
 */
function retryDelayMs(errorMessage) {
  const match = errorMessage.match(/retry\s+in\s+([\d.]+)\s*s/i);
  return match ? (Math.ceil(parseFloat(match[1])) + 2) * 1000 : 65_000;
}

/**
 * Calls a single Gemini model, retrying up to `maxAttempts` times on
 * transient per-minute rate-limit errors.
 *
 * @param {string} model          Gemini model ID
 * @param {object} sdkContents    Already-normalised SDK contents array
 * @param {object} config         Optional generation config (temperature, etc.)
 * @returns {Promise<string>}
 */
async function callModel(model, sdkContents, config, maxAttempts = 2) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: sdkContents,
        ...(config && { config }),
      });

      const text = response.text;
      if (!text) throw new Error('Empty response from Gemini.');
      return text;

    } catch (err) {
      lastError = err;
      const message = String(err);

      // Retry after delay only for per-minute rate limits.
      if (message.includes('429') && isPerMinuteLimit(message) && attempt < maxAttempts) {
        const delay = retryDelayMs(message);
        console.warn(`[proxy] Model ${model} rate-limited; retrying in ${delay / 1000}s…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // All other errors (401, 400, 500, per-day quota, unknown) — give up on
      // this model immediately and let the caller try the next one.
      throw err;
    }
  }

  throw lastError;
}

/**
 * Attempts each model in MODELS in order, falling through on permanent
 * failures (404 retired model, RESOURCE_EXHAUSTED daily quota).
 *
 * @param {object} sdkContents
 * @param {object} [config]
 * @returns {Promise<string>}
 */
async function callGeminiWithFallback(sdkContents, config) {
  let lastError;

  for (const model of MODELS) {
    try {
      return await callModel(model, sdkContents, config);
    } catch (err) {
      lastError = err;
      const message = String(err);
      const isDailyQuota = message.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(message);
      const isRetired   = message.includes('404');

      if (isDailyQuota || isRetired) {
        console.warn(`[proxy] Model ${model} unavailable (${message.slice(0, 80)}), trying next…`);
        continue; // try next model
      }

      // Non-quota error (401, 400, 500): no point trying other models.
      throw err;
    }
  }

  throw lastError ?? new Error('All Gemini models exhausted.');
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
        'Content-Length': String(chunk.length),
        'X-Goog-Upload-Offset': String(offset),
        'X-Goog-Upload-Command': isLast ? 'upload, finalize' : 'upload',
      },
      body: chunk,
    });

    if (!uploadRes.ok && uploadRes.status !== 308) {
      const errData = await uploadRes.json().catch(() => ({}));
      const msg = errData.error?.message ?? `HTTP ${uploadRes.status}`;
      return res.status(500).json({ error: `Gemini chunk upload failed: ${msg}` });
    }

    if (isLast) {
      const data = await uploadRes.json();
      const fileUri = data.file?.uri;
      if (!fileUri) return res.status(500).json({ error: 'No file URI after finalize.' });
      return res.json({ fileUri });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[proxy] upload-chunk error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── 9. Route: POST /api/generate ───────────────────────────────────────────

app.post('/api/generate', generateLimiter, async (req, res) => {
  // ── a. Validate the request body ─────────────────────────────────────────
  const { parts, temperature, systemInstruction } = req.body ?? {};

  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({
      error: 'Request body must include a non-empty "parts" array.',
    });
  }

  for (const part of parts) {
    if (!part.text && !part.inline_data && !part.file_data) {
      return res.status(400).json({
        error: 'Each part must have "text", "inline_data", or "file_data".',
      });
    }
  }

  // ── b. Build SDK payload ──────────────────────────────────────────────────
  const sdkContents = [{ role: 'user', parts: normaliseParts(parts) }];

  // Optional generation config — only include defined values.
  const config = {};
  if (typeof temperature === 'number') config.temperature = temperature;
  if (typeof systemInstruction === 'string' && systemInstruction.trim()) {
    config.systemInstruction = systemInstruction.trim();
  }

  // ── c. Call Gemini ────────────────────────────────────────────────────────
  try {
    const text = await callGeminiWithFallback(sdkContents, Object.keys(config).length ? config : undefined);
    return res.json({ text });

  } catch (err) {
    // Log the full error server-side for debugging without leaking internals.
    console.error('[proxy] Gemini error:', err);

    const message = String(err);

    // Map known Gemini error codes to meaningful HTTP responses.
    if (message.includes('401') || message.includes('API_KEY_INVALID')) {
      return res.status(401).json({ error: 'Invalid or expired Gemini API key.' });
    }
    if (message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'All Gemini model quotas exhausted. Try again tomorrow.' });
    }
    if (message.includes('400')) {
      return res.status(400).json({ error: 'Gemini rejected the request. Check your prompt or file type.' });
    }

    // Generic fallback — never include the raw error in the response.
    return res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

// ── 9. Health-check route ──────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 10. 404 catch-all ──────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── 11. Start ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[proxy] Gemini proxy running on http://localhost:${PORT}`);
  console.log(`[proxy] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

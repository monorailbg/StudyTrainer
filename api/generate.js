/**
 * api/generate.js — Vercel Serverless Function
 *
 * Vercel automatically exposes this file as POST /api/generate.
 * The GEMINI_API_KEY env var is set once in the Vercel dashboard and
 * never reaches the browser.
 *
 * No CORS config needed: the frontend and this function share the same
 * origin (*.vercel.app), so the browser never blocks the request.
 */

import { GoogleGenAI } from '@google/genai';

// ── Gemini client ──────────────────────────────────────────────────────────

// Resolved lazily inside the handler so a missing key returns a proper
// 500 JSON response instead of crashing the module at cold-start (502).
function getAI() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not set. Add it in Vercel → Project Settings → Environment Variables.');
  return new GoogleGenAI({ apiKey: key });
}

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Converts the frontend's snake_case REST format to the SDK's camelCase.
 * { inline_data: { mime_type, data } } → { inlineData: { mimeType, data } }
 */
function normaliseParts(parts) {
  return parts.map(part =>
    part.inline_data
      ? { inlineData: { mimeType: part.inline_data.mime_type, data: part.inline_data.data } }
      : part,
  );
}

function isPerMinuteLimit(msg) {
  const lower = msg.toLowerCase();
  return lower.includes('per minute') || lower.includes('rpm') || lower.includes('rate_limit_exceeded');
}

function retryDelayMs(msg) {
  const match = msg.match(/retry\s+in\s+([\d.]+)\s*s/i);
  return match ? (Math.ceil(parseFloat(match[1])) + 2) * 1000 : 65_000;
}

async function callModel(ai, model, contents, config, maxAttempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        ...(config && { config }),
      });
      const text = response.text;
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

async function callGeminiWithFallback(ai, contents, config) {
  let lastError;
  for (const model of MODELS) {
    try {
      return await callModel(ai, model, contents, config);
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

  const { parts, temperature, systemInstruction } = req.body ?? {};

  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "parts" array.' });
  }

  for (const part of parts) {
    if (!part.text && !part.inline_data) {
      return res.status(400).json({ error: 'Each part must have either "text" or "inline_data".' });
    }
  }

  const contents = [{ role: 'user', parts: normaliseParts(parts) }];

  const config = {};
  if (typeof temperature === 'number') config.temperature = temperature;
  if (typeof systemInstruction === 'string' && systemInstruction.trim()) {
    config.systemInstruction = systemInstruction.trim();
  }

  let ai;
  try {
    ai = getAI();
  } catch (err) {
    console.error('[generate] Config error:', err);
    return res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }

  try {
    const text = await callGeminiWithFallback(
      ai,
      contents,
      Object.keys(config).length ? config : undefined,
    );
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
    return res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
}

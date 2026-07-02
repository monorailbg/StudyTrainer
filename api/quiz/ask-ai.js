/**
 * api/quiz/ask-ai.js — Vercel Serverless Function
 *
 * Streaming "Ask AI" follow-up for Quiz Mode. Takes the current quiz
 * question/answer context plus a free-form user question, and streams back
 * a tutor-style explanation as plain text chunks (the client renders the
 * accumulated text as Markdown).
 *
 * Failover: GEMINI_PRIMARY → GEMINI_BACKUP → GROQ_BACKUP (non-streamed,
 * written as a single chunk so the client's incremental-read loop still works).
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_BASE   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL  = 'llama3-8b-8192';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

function resolveKeys() {
  const primary = (process.env.GEMINI_API_KEY        || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim();
  const backup  = (process.env.BACKUP_GEMINI_API_KEY || process.env.NEXT_PUBLIC_BACKUP_GEMINI_API_KEY)?.trim();
  const groq    = (process.env.GROQ_API_KEY           || process.env.NEXT_PUBLIC_GROQ_API_KEY)?.trim();

  if (!primary) {
    throw new Error('GEMINI_API_KEY is not set. Add it in Vercel → Project Settings → Environment Variables.');
  }
  return { primary, backup: backup || null, groq: groq || null };
}

function isPerMinuteLimit(msg) {
  const lower = msg.toLowerCase();
  return lower.includes('per minute') || lower.includes('rpm') || lower.includes('rate_limit_exceeded');
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
// a different key/project may still be perfectly healthy.
function isKeyRejected(msg) {
  return (
    msg.includes('401') || msg.includes('403') ||
    msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') ||
    msg.toLowerCase().includes('denied access')
  );
}

// ── Build tutor prompt ───────────────────────────────────────────────────────

function buildTutorPrompt(quizContext, userQuestion) {
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

// ── Gemini streaming (SSE) ──────────────────────────────────────────────────

async function* streamGeminiModel(apiKey, model, prompt) {
  const url = `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg  = errData.error?.message ?? res.statusText ?? String(res.status);
    const errCode = errData.error?.status ?? '';
    throw new Error(`${res.status} ${errCode}: ${errMsg}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let gotAnyText = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd;
    while ((lineEnd = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const data = JSON.parse(payload);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) { gotAnyText = true; yield text; }
      } catch {
        // Ignore malformed SSE chunks (partial JSON across reads is not expected
        // here since each `data:` line is a complete JSON object per the SSE spec).
      }
    }
  }

  if (!gotAnyText) throw new Error('Empty streamed response from Gemini.');
}

async function* streamGeminiKey(apiKey, prompt, label) {
  let lastError;
  for (const model of GEMINI_MODELS) {
    try {
      yield* streamGeminiModel(apiKey, model, prompt);
      return;
    } catch (err) {
      lastError = err;
      const msg = String(err);
      const isDailyQuota = msg.includes('RESOURCE_EXHAUSTED') && !isPerMinuteLimit(msg);
      const isRetired    = msg.includes('404');
      const isOverloaded = isUnavailable(msg);
      if (isDailyQuota || isRetired || isOverloaded) {
        console.warn(`[ask-ai] ${label} model ${model} unavailable (${msg.slice(0, 80)}), trying next model…`);
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error(`All models exhausted for ${label}.`);
}

async function callGroq(groqKey, prompt) {
  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
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

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { userQuestion, quizContext } = req.body ?? {};
  if (typeof userQuestion !== 'string' || !userQuestion.trim()) {
    return res.status(400).json({ error: 'Request body must include a non-empty "userQuestion" string.' });
  }
  if (!quizContext || typeof quizContext !== 'object') {
    return res.status(400).json({ error: 'Request body must include a "quizContext" object.' });
  }

  let keys;
  try {
    keys = resolveKeys();
  } catch (err) {
    return res.status(500).json({ error: String(err.message ?? err) });
  }

  const prompt = buildTutorPrompt(quizContext, userQuestion.trim());

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });

  try {
    try {
      for await (const chunk of streamGeminiKey(keys.primary, prompt, 'GEMINI_PRIMARY')) {
        res.write(chunk);
      }
      return res.end();
    } catch (err) {
      const msg = String(err);
      if (!isQuotaExhausted(msg) && !isUnavailable(msg) && !isKeyRejected(msg)) throw err;
      console.warn('[ask-ai] ⚠️  GEMINI_PRIMARY unavailable/rejected — failing over to GEMINI_BACKUP…');
    }

    if (keys.backup) {
      try {
        for await (const chunk of streamGeminiKey(keys.backup, prompt, 'GEMINI_BACKUP')) {
          res.write(chunk);
        }
        return res.end();
      } catch (err) {
        const msg = String(err);
        if (!isQuotaExhausted(msg) && !isUnavailable(msg) && !isKeyRejected(msg)) throw err;
        console.warn('[ask-ai] ⚠️  GEMINI_BACKUP unavailable/rejected — failing over to GROQ_BACKUP…');
      }
    }

    if (keys.groq) {
      const text = await callGroq(keys.groq, prompt);
      res.write(text);
      return res.end();
    }

    throw new Error('All AI providers exhausted.');
  } catch (err) {
    console.error('[ask-ai] Fatal error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: String(err.message ?? err).slice(0, 200) });
    }
    // Headers already sent (mid-stream failure) — terminate the stream with
    // a visible error marker rather than corrupting the partial Markdown.
    res.write('\n\n_[Error: response interrupted. Please try again.]_');
    return res.end();
  }
}

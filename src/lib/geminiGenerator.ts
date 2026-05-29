import type {
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
  GenerationType,
} from './generator';

const MODEL = 'gemini-2.0-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const LS_KEY = 'gemini_api_key';

export function getStoredApiKey(): string {
  return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)
    ?? localStorage.getItem(LS_KEY)
    ?? '';
}

export function setStoredApiKey(key: string) {
  localStorage.setItem(LS_KEY, key.trim());
}

export function clearStoredApiKey() {
  localStorage.removeItem(LS_KEY);
}

function getApiKey(): string {
  const key = getStoredApiKey();
  if (!key) throw new Error('Gemini API key not set. Enter it in the banner above.');
  return key;
}

function parseJSON(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\n?([\s\S]*?)\n?```$/);
  if (fence) text = fence[1].trim();
  return JSON.parse(text);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function processResult(
  parsed: Record<string, unknown>,
  type: GenerationType,
  fallbackTopic: string
): GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[] {
  if (type === 'flashcards') {
    const cards = parsed['flashcards'] as Array<{ front: string; back: string; topic: string }>;
    return cards.map((fc, i) => ({
      id: `gem-${Date.now()}-${i}`,
      front: fc.front,
      back: fc.back,
      topic: fc.topic ?? fallbackTopic,
    }));
  }
  if (type === 'notes') return parsed as unknown as GeneratedNote;

  const questions = parsed['questions'] as Array<{
    question: string;
    options: [string, string, string, string];
    correct: number;
    explanation: string;
  }>;
  return questions.map((q, i) => ({
    id: `gem-${Date.now()}-${i}`,
    question: q.question,
    options: q.options,
    correct: q.correct as 0 | 1 | 2 | 3,
    explanation: q.explanation,
  }));
}

// ── Gemini REST call ───────────────────────────────────────────────────────

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function callGemini(parts: Part[]): Promise<string> {
  const key = getApiKey();
  const url = `${API_BASE}/${MODEL}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as {
      error?: { message?: string; status?: string };
    };
    const msg = err.error?.message ?? res.statusText;
    const status = err.error?.status ?? '';
    throw new Error(`${res.status} ${status}: ${msg}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// ── Retry helper ──────────────────────────────────────────────────────────

function extractRetryDelay(err: unknown): number {
  const msg = String(err);
  const match = msg.match(/retry\s+in\s+([\d.]+)s/i);
  // Default 65s covers the 60-second RPM window with margin
  return match ? (Math.ceil(parseFloat(match[1])) + 2) * 1000 : 65_000;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const is429 = String(err).includes('429');
      if (is429 && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, extractRetryDelay(err)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ── Prompts ────────────────────────────────────────────────────────────────

const FILE_PROMPTS: Record<GenerationType, (subject: string) => string> = {
  flashcards: (subject) =>
    `You are an expert study material creator for university-level ${subject} students.

Analyse the content in this file and create exactly 12 high-quality flashcards covering the most important concepts, definitions, and relationships.

Return ONLY valid JSON — no markdown, no commentary:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or definition", "topic": "Specific sub-topic" }
  ]
}`,

  notes: (subject) =>
    `You are an expert academic note-taker for university-level ${subject}.

Analyse the content in this file and create comprehensive structured notes.

Return ONLY valid JSON — no markdown, no commentary:
{
  "title": "Descriptive title of the material",
  "summary": "2-3 sentence executive summary",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Main explanation paragraph (2-4 sentences)",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}

Create 4-7 sections covering all major topics.`,

  quiz: (subject) =>
    `You are an expert exam question writer for university-level ${subject}.

Analyse the content in this file and create exactly 10 multiple-choice questions.

Return ONLY valid JSON — no markdown, no commentary:
{
  "questions": [
    {
      "question": "Clear, specific question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this is correct (1-2 sentences)"
    }
  ]
}`,
};

const LEVEL_MAP: Record<string, string> = {
  introductory: 'introductory (first-year university)',
  intermediate: 'intermediate (second-year university)',
  advanced: 'advanced (final year / master\'s level)',
};

const TOPIC_PROMPTS: Record<GenerationType, (topic: string, context: string, level: string) => string> = {
  flashcards: (topic, context, level) =>
    `You are an expert study material creator for university students.

Create exactly 12 flashcards on: "${topic}"${context ? ` in the context of ${context}` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.

Return ONLY valid JSON — no markdown, no preamble:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or explanation", "topic": "Sub-topic category" }
  ]
}`,

  notes: (topic, context, level) =>
    `You are an expert academic note-taker for university students.

Create comprehensive structured notes on: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.

Return ONLY valid JSON — no markdown, no preamble:
{
  "title": "Descriptive title",
  "summary": "2-3 sentence overview",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Explanation paragraph (2-4 sentences)",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}

Create 4-7 sections.`,

  quiz: (topic, context, level) =>
    `You are an expert exam question writer for university students.

Create exactly 10 multiple-choice questions on: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.

Return ONLY valid JSON — no markdown, no preamble:
{
  "questions": [
    {
      "question": "Clear, specific question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this is correct (1-2 sentences)"
    }
  ]
}`,
};

// ── Public API ─────────────────────────────────────────────────────────────

export async function generateFromFile(
  file: File,
  type: GenerationType,
  subjectTitle: string
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const base64 = await fileToBase64(file);
  const prompt = FILE_PROMPTS[type](subjectTitle);

  const text = await withRetry(() =>
    callGemini([
      { inline_data: { mime_type: file.type, data: base64 } },
      { text: prompt },
    ])
  );

  const parsed = parseJSON(text) as Record<string, unknown>;
  return processResult(parsed, type, subjectTitle);
}

export async function generateFromTopic(
  topic: string,
  type: GenerationType,
  subjectContext = '',
  level = 'intermediate'
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const prompt = TOPIC_PROMPTS[type](topic, subjectContext, level);

  const text = await withRetry(() => callGemini([{ text: prompt }]));
  const parsed = parseJSON(text) as Record<string, unknown>;
  return processResult(parsed, type, topic);
}

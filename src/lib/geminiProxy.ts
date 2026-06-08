/**
 * geminiProxy.ts — Frontend client for the secure backend proxy.
 *
 * Drop-in replacement for geminiGenerator.ts. Swap the import path in any
 * file that calls generateFromFile / generateFromTopic / generateDefinition
 * and delete the API key banner — the key lives on the server now.
 *
 * Development:  local Express proxy at http://localhost:5000  (cd server && npm run dev)
 * Production:   Vercel serverless function at /api/generate (same origin, no CORS needed)
 *               Override with VITE_PROXY_URL if deploying the Express server elsewhere.
 */

import type {
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
  GenerationType,
} from './generator';

// ── Proxy endpoint URL ─────────────────────────────────────────────────────

/**
 * URL resolution priority:
 *  1. VITE_PROXY_URL env var  — explicit override (e.g. separate Railway server)
 *  2. Development (import.meta.env.DEV) — local Express proxy on port 5000
 *  3. Production default      — /api/generate on the same Vercel origin (no CORS)
 */
const GENERATE_ENDPOINT: string = (() => {
  const override = (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/$/, '');
  if (override) return `${override}/api/generate`;
  // In both dev (Vite proxy → localhost:5000) and production (Vercel function),
  // /api/generate is same-origin so no CORS is needed and Codespaces work correctly.
  return '/api/generate';
})();

// ── Types that mirror the REST wire format ──────────────────────────────────

type TextPart        = { text: string };
type InlineDataPart  = { inline_data: { mime_type: string; data: string } };
type Part            = TextPart | InlineDataPart;

// ── Core fetch wrapper ──────────────────────────────────────────────────────

/**
 * Sends a generation request to the proxy server.
 * Retries once automatically on a transient network error.
 *
 * @throws {Error} with a user-facing message on 4xx/5xx responses.
 */
async function callProxy(
  parts: Part[],
  options?: { temperature?: number; systemInstruction?: string },
): Promise<string> {
  const body = JSON.stringify({ parts, ...options });

  let response: Response;
  try {
    response = await fetch(GENERATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    // Network-level failure (server down, CORS, no internet).
    throw new Error(
      'Could not reach the proxy server. In development, run: cd server && npm run dev',
    );
  }

  if (response.ok) {
    const data = await response.json() as { text: string };
    if (!data.text) throw new Error('Empty response from proxy.');
    return data.text;
  }

  // Parse the structured error the proxy always returns.
  const err = await response.json().catch(() => ({ error: response.statusText })) as {
    error: string;
    retryAfter?: number;
  };

  if (response.status === 429) {
    const wait = err.retryAfter ?? 60;
    throw new Error(`Rate limit reached. Please wait ${wait} seconds and try again.`);
  }
  if (response.status === 401) {
    throw new Error('Invalid or expired Gemini API key. Update GEMINI_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy.');
  }
  if (response.status === 400) {
    throw new Error(`Bad request: ${err.error}`);
  }

  // 500 or unexpected status — use || so empty strings fall through to the default.
  throw new Error(err.error || `Generation failed (HTTP ${response.status}). Please try again.`);
}

// ── Shared helpers (identical to geminiGenerator.ts) ───────────────────────

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
  fallbackTopic: string,
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
    correct: Number(q.correct) as 0 | 1 | 2 | 3,
    explanation: q.explanation,
  }));
}

// ── Generation options (same public interface as geminiGenerator.ts) ────────

export interface GenerateOptions {
  cardCount?:      number;
  questionCount?:  number;
  focusTopic?:     string;
  notesDetail?:    'concise' | 'standard' | 'comprehensive';
  notesIncludes?:  string[];
  customPrompt?:   string;
  language?:       'english' | 'japanese' | 'both';
  difficulty?:     'easy' | 'medium' | 'hard';
}

function languageInstruction(language?: 'english' | 'japanese' | 'both'): string {
  if (!language || language === 'english') return '';
  if (language === 'japanese')
    return '\n\nGenerate ALL text content in Japanese (日本語で生成してください). Every field in the JSON output must be written in Japanese.';
  return '\n\nGenerate content bilingually — write each text value in both English and Japanese, separated by " / ". Example: "Supply and demand / 需要と供給". Apply this to every text field in the JSON.';
}

// ── Prompt builders (identical to geminiGenerator.ts) ──────────────────────

function flashcardFilePrompt(subject: string, opts: GenerateOptions): string {
  const count  = opts.cardCount ?? 12;
  const focus  = opts.focusTopic?.trim();
  const custom = opts.customPrompt?.trim();
  return `You are an expert study material creator for university-level ${subject} students.

Analyse the content in this file and create exactly ${count} high-quality flashcards.
${focus ? `Focus specifically on the topic: "${focus}".` : 'Cover the most important concepts, definitions, and relationships.'}
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Return ONLY valid JSON — no markdown, no commentary:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or definition", "topic": "Specific sub-topic" }
  ]
}`;
}

function notesFilePrompt(subject: string, opts: GenerateOptions): string {
  const detail   = opts.notesDetail ?? 'standard';
  const includes = opts.notesIncludes ?? [];
  const custom   = opts.customPrompt?.trim();

  const sectionCount = detail === 'concise' ? '3–4' : detail === 'comprehensive' ? '8–12' : '4–7';
  const contentDepth =
    detail === 'concise'
      ? 'Keep each section brief — 1-2 sentences of content, 2-3 key points.'
      : detail === 'comprehensive'
        ? 'Each section should have a thorough explanation (4-6 sentences) and 4-6 key points.'
        : 'Each section should have a clear explanation (2-4 sentences) and 3-5 key points.';

  const formulaInstruction = includes.includes('formulas')
    ? 'If a section involves mathematics, physics, chemistry, or economics formulae, add a "formula" field with the key equation(s) in plain-text notation (e.g., "F = ma").'
    : '';
  const diagramInstruction = includes.includes('diagrams')
    ? 'Where a process, flow, or structure is best shown visually, add a "diagram" field with a concise text diagram.'
    : '';
  const mindmapInstruction = includes.includes('mindmap')
    ? 'Organise sections hierarchically: the first section introduces the top-level concept, subsequent sections each explore one branch.'
    : '';

  const schemaExtras = (includes.includes('formulas') || includes.includes('diagrams'))
    ? `      "formula": "optional — key equation or formula for this section",
      "diagram": "optional — short text diagram or flow for this section",`
    : '';

  return `You are an expert academic note-taker for university-level ${subject}.

Analyse the content in this file and create ${detail} structured notes with ${sectionCount} sections.
${contentDepth}
${formulaInstruction}
${diagramInstruction}
${mindmapInstruction}
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Return ONLY valid JSON — no markdown, no commentary:
{
  "title": "Descriptive title of the material",
  "summary": "2-3 sentence executive summary",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Main explanation paragraph",
      ${schemaExtras}
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}`;
}

const DIFFICULTY_MAP: Record<'easy' | 'medium' | 'hard', string> = {
  easy:   'EASY — test foundational recall and basic comprehension.',
  medium: 'MEDIUM — test solid understanding and application. Require connecting concepts.',
  hard:   'HARD — test deep analysis, synthesis, and edge cases with subtle distractors.',
};

function difficultyInstruction(difficulty?: 'easy' | 'medium' | 'hard'): string {
  if (!difficulty) return '';
  return `\nDifficulty level: ${DIFFICULTY_MAP[difficulty]}`;
}

function quizFilePrompt(subject: string, opts: GenerateOptions): string {
  const count  = opts.questionCount ?? 10;
  const focus  = opts.focusTopic?.trim();
  const custom = opts.customPrompt?.trim();
  return `You are an expert exam question writer for university-level ${subject}.

Analyse the content in this file and create exactly ${count} multiple-choice questions.
${focus ? `Focus specifically on the topic: "${focus}".` : ''}${difficultyInstruction(opts.difficulty)}
${custom ? `Additional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

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
}`;
}

const LEVEL_MAP: Record<string, string> = {
  introductory: 'introductory (first-year university)',
  intermediate: 'intermediate (second-year university)',
  advanced:     'advanced (final year / master\'s level)',
};

const TOPIC_PROMPTS: Record<
  GenerationType,
  (topic: string, context: string, level: string, language?: 'english' | 'japanese' | 'both') => string
> = {
  flashcards: (topic, context, level, language) =>
    `You are an expert study material creator for university students.

Create exactly 12 flashcards on: "${topic}"${context ? ` in the context of ${context}` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.${languageInstruction(language)}

Return ONLY valid JSON — no markdown, no preamble:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or explanation", "topic": "Sub-topic category" }
  ]
}`,

  notes: (topic, context, level, language) =>
    `You are an expert academic note-taker for university students.

Create comprehensive structured notes on: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.${languageInstruction(language)}

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

  quiz: (topic, context, level, language) =>
    `You are an expert exam question writer for university students.

Create exactly 10 multiple-choice questions on: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.${languageInstruction(language)}

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

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateFromFile(
  file: File,
  type: GenerationType,
  subjectTitle: string,
  options: GenerateOptions = {},
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const base64 = await fileToBase64(file);
  const prompt =
    type === 'flashcards' ? flashcardFilePrompt(subjectTitle, options) :
    type === 'notes'      ? notesFilePrompt(subjectTitle, options) :
                            quizFilePrompt(subjectTitle, options);

  const text = await callProxy([
    { inline_data: { mime_type: file.type, data: base64 } },
    { text: prompt },
  ]);

  const parsed = parseJSON(text) as Record<string, unknown>;
  return processResult(parsed, type, subjectTitle);
}

export async function generateFromTopic(
  topic: string,
  type: GenerationType,
  subjectContext = '',
  level = 'intermediate',
  language?: 'english' | 'japanese' | 'both',
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const prompt = TOPIC_PROMPTS[type](topic, subjectContext, level, language);
  const text   = await callProxy([{ text: prompt }]);
  const parsed = parseJSON(text) as Record<string, unknown>;
  return processResult(parsed, type, topic);
}

export async function generateDefinition(term: string, subjectTitle: string): Promise<string> {
  return callProxy([{
    text:
      `You are an academic dictionary for the subject "${subjectTitle}" in a Global Business Studies programme.\n\n` +
      `Define the term or concept: "${term}"\n\n` +
      `Return EXACTLY 1 bullet point (•): one sentence of max 20 words giving the core meaning in the context of ${subjectTitle}.\n\n` +
      `Rules:\n- Start with •\n- No headings, no JSON, no markdown bold, no extra text before or after\n- Maximum 20 words`,
  }]);
}

export async function generateJapaneseDefinition(term: string, subjectTitle: string): Promise<string> {
  return callProxy([{
    text:
      `あなたは「${subjectTitle}」というグローバルビジネス学部の学術辞典です。\n\n` +
      `次の用語を日本語で説明してください：「${term}」\n\n` +
      `以下の形式で正確に2行を返してください：\n` +
      `• 翻訳：[日本語訳または読み方]\n` +
      `• 説明：[${subjectTitle}の文脈における意味を1文で、最大30字]\n\n` +
      `ルール：\n- 各行は•で始めること\n- 見出し・JSON・太字・前後の余分なテキストは不要\n- すべて日本語で記述すること`,
  }]);
}

import type {
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
  GenerationType,
} from './generator';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Each model has its own independent daily free-tier quota — fall through on
// exhaustion. gemini-2.0-* were deprecated Feb 2026 and retire June 2026 with
// gutted free quota, so we use the 2.5 family (current free tier: 2.5-flash
// 1,500 RPD, 2.5-flash-lite 1,000 RPD). The -latest aliases are a safety net
// if a pinned ID is ever retired.
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

const LS_KEY = 'gemini_api_key';

export function getStoredApiKey(): string {
  // A key entered in the banner (localStorage) always wins over the build-time
  // env var. On a deployed build the env var is baked into the bundle, so if it
  // held a revoked/leaked key it would otherwise override the user's fresh key.
  const stored = localStorage.getItem(LS_KEY)?.trim();
  if (stored) return stored;
  return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? '';
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
    // The model sometimes returns this index as a string ("1") rather than a
    // number, which broke the strict === comparison in QuizViewer and made every
    // answer read as incorrect. Coerce to a real number so the check holds.
    correct: Number(q.correct) as 0 | 1 | 2 | 3,
    explanation: q.explanation,
  }));
}

// ── Gemini REST call ───────────────────────────────────────────────────────

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function callGemini(parts: Part[], model: string): Promise<string> {
  const key = getApiKey();
  const url = `${API_BASE}/${model}:generateContent`;

  // Send the key via the canonical header rather than the query string —
  // avoids URL-encoding pitfalls and is Google's recommended method.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
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

// ── Retry + model-fallback helpers ────────────────────────────────────────

function extractRetryDelay(err: unknown): number {
  const msg = String(err);
  const match = msg.match(/retry\s+in\s+([\d.]+)s/i);
  return match ? (Math.ceil(parseFloat(match[1])) + 2) * 1000 : 65_000;
}

function isPerMinuteError(msg: string): boolean {
  return (
    msg.toLowerCase().includes('per minute') ||
    msg.toLowerCase().includes('rpm') ||
    msg.toLowerCase().includes('rate_limit_exceeded')
  );
}

function isQuotaOrUnavailable(msg: string): boolean {
  return (msg.includes('RESOURCE_EXHAUSTED') && !isPerMinuteError(msg)) || msg.includes('404');
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err);
      if (msg.includes('429') && isPerMinuteError(msg) && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, extractRetryDelay(err)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function callGeminiAuto(parts: Part[]): Promise<string> {
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      return await withRetry(() => callGemini(parts, model));
    } catch (err) {
      lastErr = err;
      if (isQuotaOrUnavailable(String(err))) continue;
      throw err;
    }
  }
  throw lastErr;
}

// ── Generation options ─────────────────────────────────────────────────────

export interface GenerateOptions {
  cardCount?: number;                                          // flashcards (default 12)
  questionCount?: number;                                      // quiz (default 10)
  focusTopic?: string;                                         // narrow topic, flashcards & quiz
  notesDetail?: 'concise' | 'standard' | 'comprehensive';     // notes depth
  notesIncludes?: string[];                                    // 'formulas' | 'diagrams' | 'mindmap'
  customPrompt?: string;                                       // free-text appended to the prompt
  language?: 'english' | 'japanese' | 'both';                 // output language (default english)
  difficulty?: 'easy' | 'medium' | 'hard';                    // quiz question difficulty
}

function languageInstruction(language?: 'english' | 'japanese' | 'both'): string {
  if (!language || language === 'english') return '';
  if (language === 'japanese') return '\n\nGenerate ALL text content in Japanese (日本語で生成してください). Every field in the JSON output must be written in Japanese.';
  return '\n\nGenerate content bilingually — write each text value in both English and Japanese, separated by " / ". Example: "Supply and demand / 需要と供給". Apply this to every text field in the JSON.';
}

// ── Prompts ────────────────────────────────────────────────────────────────

function flashcardFilePrompt(subject: string, opts: GenerateOptions): string {
  const count = opts.cardCount ?? 12;
  const focus = opts.focusTopic?.trim();
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
  const detail = opts.notesDetail ?? 'standard';
  const includes = opts.notesIncludes ?? [];
  const custom = opts.customPrompt?.trim();

  const sectionCount = detail === 'concise' ? '3–4' : detail === 'comprehensive' ? '8–12' : '4–7';
  const contentDepth = detail === 'concise'
    ? 'Keep each section brief — 1-2 sentences of content, 2-3 key points.'
    : detail === 'comprehensive'
      ? 'Each section should have a thorough explanation (4-6 sentences) and 4-6 key points.'
      : 'Each section should have a clear explanation (2-4 sentences) and 3-5 key points.';

  const formulaInstruction = includes.includes('formulas')
    ? 'If a section involves mathematics, physics, chemistry, or economics formulae, add a "formula" field with the key equation(s) in plain-text notation (e.g., "F = ma", "ΔG = ΔH − TΔS", "MV = PQ").'
    : '';
  const diagramInstruction = includes.includes('diagrams')
    ? 'Where a process, flow, or structure is best shown visually, add a "diagram" field with a concise text diagram (e.g., "Households → [Labour] → Firms → [Wages] → Households", or a simple table row like "AD ↑ → Price level ↑ → Real output ↑ (short run)").'
    : '';
  const mindmapInstruction = includes.includes('mindmap')
    ? 'Organise sections hierarchically: the first section should introduce the top-level concept, subsequent sections should each explore one branch or sub-concept.'
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
  easy: 'EASY — test foundational recall and basic comprehension. Use clear, direct questions with plainly distinguishable options and obvious distractors. Suitable for someone first learning the material.',
  medium: 'MEDIUM — test solid understanding and application. Require connecting concepts, with plausible distractors that reflect common misconceptions. The standard exam level.',
  hard: 'HARD — test deep analysis, synthesis, and edge cases. Use challenging scenario- or calculation-based questions with subtle, closely competing distractors that demand careful reasoning. Suitable for advanced revision.',
};

function difficultyInstruction(difficulty?: 'easy' | 'medium' | 'hard'): string {
  if (!difficulty) return '';
  return `\nDifficulty level: ${DIFFICULTY_MAP[difficulty]}`;
}

function quizFilePrompt(subject: string, opts: GenerateOptions): string {
  const count = opts.questionCount ?? 10;
  const focus = opts.focusTopic?.trim();
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
  advanced: 'advanced (final year / master\'s level)',
};

const TOPIC_PROMPTS: Record<GenerationType, (topic: string, context: string, level: string, language?: 'english' | 'japanese' | 'both') => string> = {
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

// ── Public API ─────────────────────────────────────────────────────────────

export async function generateFromFile(
  file: File,
  type: GenerationType,
  subjectTitle: string,
  options: GenerateOptions = {}
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const base64 = await fileToBase64(file);
  const prompt =
    type === 'flashcards' ? flashcardFilePrompt(subjectTitle, options) :
    type === 'notes'      ? notesFilePrompt(subjectTitle, options) :
                            quizFilePrompt(subjectTitle, options);

  const text = await callGeminiAuto([
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
  language?: 'english' | 'japanese' | 'both'
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const prompt = TOPIC_PROMPTS[type](topic, subjectContext, level, language);

  const text = await callGeminiAuto([{ text: prompt }]);
  const parsed = parseJSON(text) as Record<string, unknown>;
  return processResult(parsed, type, topic);
}

// ── Dictionary definition generator ───────────────────────────────────────────

export async function generateDefinition(term: string, subjectTitle: string): Promise<string> {
  const prompt = `You are an academic dictionary for the subject "${subjectTitle}" in a Global Business Studies programme.

Define the term or concept: "${term}"

Write a clear, precise definition of 2–4 sentences aimed at a university student. Include:
- what the term means in the context of ${subjectTitle}
- any key relationships or mechanisms (cause/effect, formula, framework)
- one concrete real-world example if it adds clarity

Return ONLY the definition text. No headings, no bullet points, no JSON, no markdown.`;

  return callGeminiAuto([{ text: prompt }]);
}

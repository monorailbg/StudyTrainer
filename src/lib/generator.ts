import Anthropic from '@anthropic-ai/sdk';

export interface GeneratedFlashcard {
  id: string;
  front: string;
  back: string;
  topic: string;
}

export interface GeneratedNoteSection {
  heading: string;
  content: string;
  keyPoints?: string[];
  formula?: string;   // inline formula block, e.g. "F = ma" or "ΔG = ΔH − TΔS"
  diagram?: string;   // text diagram, e.g. "Input → [Stage A] → Output"
}

export interface GeneratedNote {
  title: string;
  summary: string;
  sections: GeneratedNoteSection[];
}

export interface GeneratedQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export type GenerationType = 'flashcards' | 'notes' | 'quiz';

const PROMPTS: Record<GenerationType, (subject: string, text: string) => string> = {
  flashcards: (subject, text) => `You are an expert study material creator for university-level ${subject} students.

Based on the study material below, create exactly 12 high-quality flashcards covering the most important concepts, definitions, and relationships. Focus on exam-relevant content.

Return ONLY a valid JSON object — no markdown, no commentary:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or definition", "topic": "Specific sub-topic" }
  ]
}

Study material:
${text}`,

  notes: (subject, text) => `You are an expert academic note-taker for university-level ${subject}.

Based on the study material below, create comprehensive structured notes. Extract all key concepts, definitions, frameworks, and relationships.

Return ONLY a valid JSON object — no markdown, no commentary:
{
  "title": "Descriptive title of the material",
  "summary": "2-3 sentence executive summary",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Main explanation paragraph for this section (2-4 sentences)",
      "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
    }
  ]
}

Create 4-7 sections covering all major topics. Study material:
${text}`,

  quiz: (subject, text) => `You are an expert exam question writer for university-level ${subject}.

Based on the study material below, create exactly 10 multiple-choice questions. Each question should test understanding, not just recall. Include plausible distractors.

Return ONLY a valid JSON object — no markdown, no commentary:
{
  "questions": [
    {
      "question": "Clear, specific question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this is correct and others are wrong (1-2 sentences)"
    }
  ]
}

The "correct" field is the 0-based index of the correct option. Study material:
${text}`,
};

// LLM output sometimes contains raw backslashes (markdown/LaTeX/Mermaid syntax)
// that aren't valid JSON escape sequences and crash JSON.parse with "Bad escaped character".
function sanitizeJsonString(raw: string): string {
  let text = raw.trim();
  // Strip markdown code fences
  const fence = text.match(/^```(?:json)?\n?([\s\S]*?)\n?```$/);
  if (fence) text = fence[1].trim();
  // Escape backslashes that aren't part of a valid JSON escape sequence
  return text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}

function parseJSON(raw: string): unknown {
  const text = sanitizeJsonString(raw);
  return JSON.parse(text);
}

export async function generateFromText(
  apiKey: string,
  text: string,
  type: GenerationType,
  subjectTitle: string
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const truncated = text.slice(0, 10000);
  const prompt = PROMPTS[type](subjectTitle, truncated);

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from API');

  const parsed = parseJSON(block.text) as Record<string, unknown>;

  if (type === 'flashcards') {
    const cards = parsed['flashcards'] as Array<{ front: string; back: string; topic: string }>;
    return cards.map((fc, i) => ({
      id: `gen-${Date.now()}-${i}`,
      front: fc.front,
      back: fc.back,
      topic: fc.topic ?? subjectTitle,
    }));
  }

  if (type === 'notes') {
    return parsed as unknown as GeneratedNote;
  }

  const questions = parsed['questions'] as Array<{
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  }>;
  return questions.map((q, i) => ({
    id: `gen-${Date.now()}-${i}`,
    question: q.question,
    options: q.options,
    correct: Number(q.correct),
    explanation: q.explanation,
  }));
}

const LEVEL_MAP: Record<string, string> = {
  introductory: 'introductory (first-year university)',
  intermediate: 'intermediate (second-year university)',
  advanced: 'advanced (final year / master\'s level)',
};

const TOPIC_PROMPTS: Record<GenerationType, (topic: string, context: string, level: string) => string> = {
  flashcards: (topic, context, level) =>
    `You are an expert study material creator for university students.

Create exactly 12 flashcards on: "${topic}"${context ? ` — relevant to ${context}` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.

Focus on key definitions, frameworks, relationships, and exam-critical concepts.

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

Create 4-7 sections covering all major aspects.`,

  quiz: (topic, context, level) =>
    `You are an expert exam question writer for university students.

Create exactly 10 multiple-choice questions on: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.

Test understanding and application, not recall alone. Include plausible distractors.

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

export async function generateFromTopic(
  apiKey: string,
  topic: string,
  type: GenerationType,
  subjectContext = '',
  level = 'intermediate'
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const prompt = TOPIC_PROMPTS[type](topic, subjectContext, level);

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from API');

  const parsed = parseJSON(block.text) as Record<string, unknown>;

  if (type === 'flashcards') {
    const cards = parsed['flashcards'] as Array<{ front: string; back: string; topic: string }>;
    return cards.map((fc, i) => ({
      id: `topic-${Date.now()}-${i}`,
      front: fc.front,
      back: fc.back,
      topic: fc.topic ?? topic,
    }));
  }

  if (type === 'notes') {
    return parsed as unknown as GeneratedNote;
  }

  const questions = parsed['questions'] as Array<{
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  }>;
  return questions.map((q, i) => ({
    id: `topic-${Date.now()}-${i}`,
    question: q.question,
    options: q.options,
    correct: Number(q.correct),
    explanation: q.explanation,
  }));
}

export async function generateFromImage(
  apiKey: string,
  base64: string,
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
  type: GenerationType,
  subjectTitle: string
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const typeInstructions = {
    flashcards: `Create exactly 12 flashcards from the content in this image. Return ONLY JSON: { "flashcards": [{ "front": "...", "back": "...", "topic": "..." }] }`,
    notes: `Create structured notes from the content in this image. Return ONLY JSON: { "title": "...", "summary": "...", "sections": [{ "heading": "...", "content": "...", "keyPoints": ["..."] }] }`,
    quiz: `Create exactly 10 multiple-choice quiz questions from the content in this image. Return ONLY JSON: { "questions": [{ "question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..." }] }`,
  };

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `You are an expert study material creator for ${subjectTitle} students.\n\n${typeInstructions[type]}` },
        ],
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from API');

  const parsed = parseJSON(block.text) as Record<string, unknown>;

  if (type === 'flashcards') {
    const cards = parsed['flashcards'] as Array<{ front: string; back: string; topic: string }>;
    return cards.map((fc, i) => ({
      id: `gen-img-${Date.now()}-${i}`,
      front: fc.front,
      back: fc.back,
      topic: fc.topic ?? subjectTitle,
    }));
  }

  if (type === 'notes') {
    return parsed as unknown as GeneratedNote;
  }

  const questions = parsed['questions'] as Array<{
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  }>;
  return questions.map((q, i) => ({
    id: `gen-img-${Date.now()}-${i}`,
    question: q.question,
    options: q.options,
    correct: Number(q.correct),
    explanation: q.explanation,
  }));
}

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
  GeneratedNoteSection,
  GeneratedQuizQuestion,
  GenerationType,
} from './generator';
import { extractTextFromFile, renderPdfPagesAsJpeg } from './pdfExtractor';

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
type FileDataPart    = { file_data: { mime_type: string; file_uri: string } };
type Part            = TextPart | InlineDataPart | FileDataPart;

// ── Core fetch wrapper ──────────────────────────────────────────────────────

/**
 * Sends a generation request to the proxy server.
 * Retries once automatically on a transient network error.
 *
 * @throws {Error} with a user-facing message on 4xx/5xx responses.
 */
// Client-side ceiling for a single proxy call. Kept comfortably below the
// gateway/serverless function's own timeout so a hung request fails with a
// clear, actionable message instead of the browser waiting on a 504.
const REQUEST_TIMEOUT_MS = 55_000;

interface CallProxyOptions {
  temperature?: number;
  systemInstruction?: string;
  maxOutputTokens?: number;
  // Forces Gemini to return application/json instead of free-form text —
  // paired with responseSchema this eliminates prose preambles, markdown
  // fences, and malformed/missing fields in structured-output calls (e.g.
  // the notes outline step).
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
}

async function callProxy(
  parts: Part[],
  options?: CallProxyOptions,
): Promise<string> {
  const body = JSON.stringify({ parts, ...options });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GENERATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('The request took too long and timed out. Try a smaller batch (fewer pages, or a lower "Cards per file" count instead of "All").');
    }
    // Network-level failure (server down, CORS, no internet).
    throw new Error(
      'Could not reach the proxy server. In development, run: cd server && npm run dev',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    const data = await response.json() as { text: string };
    if (!data.text) throw new Error('Empty response from proxy.');
    return data.text;
  }

  if (response.status === 504 || response.status === 502 || response.status === 503) {
    throw new Error('The server took too long to respond (gateway timeout). Try a smaller batch (fewer pages, or a lower "Cards per file" count instead of "All").');
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

/**
 * Strips a markdown code fence (```json ... ``` or ``` ... ```) and any
 * leading/trailing whitespace or prose around it, leaving just the raw JSON
 * text. Gemini is supposed to return clean JSON when responseMimeType is
 * set, but it (and the Groq fallback, which has no such option) sometimes
 * still wraps the payload in a fence or adds a preamble — this protects
 * every JSON.parse() call site against that.
 */
function stripCodeFence(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) {
    text = fence[1].trim();
  } else {
    // No fence: skip any preamble and start from first { or [
    const start = text.search(/[{[]/);
    if (start > 0) text = text.slice(start);
  }
  return text;
}

// The model's JSON string values often contain raw backslashes from markdown,
// LaTeX-style formulas, or Mermaid diagram syntax (e.g. "A-->B" is fine, but
// things like "\(x\)" or "C:\path" are not valid JSON escape sequences) and
// crash JSON.parse with "Bad escaped character in JSON". Escape any backslash
// that isn't already part of a valid JSON escape token before parsing.
function sanitizeJsonEscapes(text: string): string {
  return text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}

function parseJSON(raw: string): unknown {
  const text = sanitizeJsonEscapes(stripCodeFence(raw));

  // Happy path
  try {
    return JSON.parse(text);
  } catch (firstErr) {
    // Attempt to repair a truncated response by closing any open structure.
    // This handles the common case where the model ran out of output tokens
    // mid-string, mid-array, or mid-object.
    const repaired = repairTruncatedJSON(text);
    if (repaired !== text) {
      try {
        return JSON.parse(repaired);
      } catch {
        // Fall through to throw the original error with helpful context.
      }
    }
    throw firstErr;
  }
}

/**
 * Best-effort repair of JSON that was cut off before the closing delimiter.
 * Strategy:
 *  1. If the last character is mid-string (odd number of unescaped quotes),
 *     close the string first.
 *  2. Walk a bracket/brace stack to close any open arrays / objects.
 */
function repairTruncatedJSON(text: string): string {
  // Find the last position that is safe to truncate to (avoid mid-escape sequences)
  // by trimming trailing incomplete escape like  \  or  \"
  let s = text.replace(/\\+$/, '').trimEnd();
  // Remove a trailing comma before a closing delimiter (common truncation artifact)
  s = s.replace(/,\s*$/, '');

  // Determine if we're currently inside a string by counting unescaped quotes
  let inString = false;
  let i = 0;
  while (i < s.length) {
    if (s[i] === '"' && (i === 0 || s[i - 1] !== '\\')) inString = !inString;
    i++;
  }
  if (inString) s += '"'; // close the open string

  // Remove a trailing comma again (may now be exposed after closing the string)
  s = s.replace(/,\s*$/, '');

  // Count open braces/brackets and close them in reverse order
  const stack: string[] = [];
  inString = false;
  for (let j = 0; j < s.length; j++) {
    const ch = s[j];
    if (ch === '"' && (j === 0 || s[j - 1] !== '\\')) {
      inString = !inString;
    } else if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
  }
  while (stack.length) s += stack.pop()!;

  return s;
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
    const raw = parsed['flashcards'];
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(
        `Gemini returned an unexpected format for flashcards. ` +
        `Got keys: ${Object.keys(parsed).join(', ') || '(none)'}`,
      );
    }
    return (raw as Array<Record<string, unknown>>).map((fc, i) => {
      // Vocabulary cards carry reading / example / translation fields.
      // Encode them as a prefixed JSON string so the viewer can detect and
      // render them differently without a schema change.
      const isVocab = 'reading' in fc || 'example' in fc;
      const back = isVocab
        ? '__vocab__' + JSON.stringify({
            reading:     String(fc['reading']     ?? ''),
            meaning:     String(fc['meaning']     ?? fc['back'] ?? ''),
            example:     String(fc['example']     ?? ''),
            translation: String(fc['translation'] ?? ''),
          })
        : String(fc['back'] ?? '');
      return {
        id: `gem-${Date.now()}-${i}`,
        front: String(fc['front'] ?? ''),
        back,
        topic: String(fc['topic'] ?? fallbackTopic),
      };
    });
  }

  if (type === 'notes') return parsed as unknown as GeneratedNote;

  const raw = parsed['questions'];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      `Gemini returned an unexpected format for quiz questions. ` +
      `Got keys: ${Object.keys(parsed).join(', ') || '(none)'}`,
    );
  }
  // The model occasionally repeats the final question verbatim (e.g. when it
  // pads out to hit the requested count) — drop exact repeats of a prior
  // question's text before assigning ids, so duplicates never reach the UI.
  const seen = new Set<string>();
  const deduped = (raw as Array<{
    question: string;
    options: [string, string, string, string];
    correct: number;
    explanation: string;
  }>).filter(q => {
    const key = String(q.question ?? '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.map((q, i) => ({
    id: `gem-${Date.now()}-${i}`,
    question: q.question,
    options:  q.options,
    correct:  Number(q.correct) as 0 | 1 | 2 | 3,
    explanation: q.explanation,
  }));
}

// ── Generation options (same public interface as geminiGenerator.ts) ────────

export interface GenerateOptions {
  cardCount?:      number | 'all';
  questionCount?:  number;
  focusTopic?:     string;
  notesDetail?:    'concise' | 'standard' | 'comprehensive';
  notesIncludes?:  string[];
  detailedNotes?:  boolean;
  customPrompt?:   string;
  language?:       'english' | 'japanese' | 'both';
  difficulty?:     'easy' | 'medium' | 'hard';
  flashcardMode?:  'standard' | 'vocabulary';
  quizMode?:       'generated' | 'extraction';
}

function languageInstruction(language?: 'english' | 'japanese' | 'both'): string {
  if (!language || language === 'english') return '';
  if (language === 'japanese')
    return '\n\nGenerate ALL text content in Japanese (日本語で生成してください). Every field in the JSON output must be written in Japanese.';
  return '\n\nGenerate content bilingually — write each text value in both English and Japanese, separated by " / ". Example: "Supply and demand / 需要と供給". Apply this to every text field in the JSON.';
}

// ── Prompt builders (identical to geminiGenerator.ts) ──────────────────────

function flashcardVocabPrompt(subject: string, opts: GenerateOptions, forceAll = false): string {
  const isAll = forceAll || opts.cardCount === 'all';
  const count = isAll ? undefined : (opts.cardCount ?? 15);
  const focus  = opts.focusTopic?.trim();
  const custom = opts.customPrompt?.trim();
  return `You are an expert vocabulary flashcard creator for students studying ${subject}.

${isAll
    ? 'Analyse the provided content and extract every single unique vocabulary word or expression it contains — do not cap or limit the count, no upper restriction, include all of them even if there are dozens.'
    : `Analyse the provided content and extract exactly ${count} key vocabulary items from it.`}
${focus ? `Focus on vocabulary related to: "${focus}".` : ''}
${custom ? `Additional instructions: ${custom}` : ''}

For each vocabulary item provide:
- "front": the word or expression in its native script only (characters/script — no reading, no translation)
- "reading": pronunciation guide appropriate to the language (furigana/romaji for Japanese, pinyin for Chinese, IPA or romanisation for others)
- "meaning": concise English meaning of the word
- "example": a short, natural example sentence in the source language (native script) that uses this exact word in context
- "translation": the English translation of that exact example sentence — no other sentence
- "topic": grammatical category or subject area (e.g. "Noun", "Verb", "Business", "Greetings")

Return ONLY valid JSON — no markdown, no commentary:
{
  "flashcards": [
    {
      "front": "経済",
      "reading": "けいざい (keizai)",
      "meaning": "economy, economics",
      "example": "日本の経済は急速に発展してきた。",
      "translation": "Japan's economy has developed rapidly.",
      "topic": "Noun"
    }
  ]
}`;
}

function flashcardFilePrompt(subject: string, opts: GenerateOptions, forceAll = false): string {
  if (opts.flashcardMode === 'vocabulary') return flashcardVocabPrompt(subject, opts, forceAll);
  const isAll = forceAll || opts.cardCount === 'all';
  const count = isAll ? undefined : (opts.cardCount ?? 12);
  const focus  = opts.focusTopic?.trim();
  const custom = opts.customPrompt?.trim();
  return `You are an expert study material creator for university-level ${subject} students.

${isAll
    ? 'Analyse the content in this file and create a flashcard for every distinct concept, term or fact it contains — do not cap or limit the count, no upper restriction.'
    : `Analyse the content in this file and create exactly ${count} high-quality flashcards.`}
${focus ? `Focus specifically on the topic: "${focus}".` : 'Cover the most important concepts, definitions, and relationships.'}
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Return ONLY valid JSON — no markdown, no commentary:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or definition", "topic": "Specific sub-topic" }
  ]
}`;
}

// ── Notes: single-call generation ───────────────────────────────────────────

function notesSectionCountRange(detail: 'concise' | 'standard' | 'comprehensive'): string {
  return detail === 'concise' ? '3–4' : detail === 'comprehensive' ? '8–12' : '4–7';
}

function notesFilePrompt(subject: string, opts: GenerateOptions): string {
  const detail   = opts.notesDetail ?? 'standard';
  const includes = opts.notesIncludes ?? [];
  const custom   = opts.customPrompt?.trim();
  const sectionCount = notesSectionCountRange(detail);

  const mindmapInstruction = includes.includes('mindmap')
    ? 'Organise sections hierarchically: the first section introduces the top-level concept, subsequent sections each explore one branch.'
    : '';

  return `You are an expert academic note-taker for university-level ${subject}.

Based on the content in this file, create ${detail} structured notes with ${sectionCount} sections covering everything important in the material. Extract all key concepts, definitions, frameworks, and relationships.
${mindmapInstruction}
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Use clean, well-structured Markdown for each section's content — standard headers, concise explanations, and bullet points. Bold key terms.

Return ONLY a valid JSON object — no markdown wrapper, no commentary:
{
  "title": "Descriptive title of the material",
  "summary": "2–3 sentence executive summary",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Main explanation in clean markdown (2-4 sentences plus bullet points)",
      "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
    }
  ]
}`;
}

// ── Notes: detailed "dashboard" mode (opt-in, single call) ─────────────────
//
// Same JSON contract as the fast prompt (title/summary/sections[]) so no
// downstream parsing change is needed — only the instructions for what goes
// into each section's "content" field change, asking for maximum
// information density (tables, flowcharts, decision trees, etc.) instead of
// plain markdown. Still a single request, just a heavier one — expect a
// noticeably longer generation time than the default fast mode.
const DASHBOARD_FORMAT_RULES = `You are an expert instructional designer. Transform the material into the highest-information-density notes possible, not prose summaries.

RULES:
- Prefer visual structures over text: comparison tables > flowcharts > decision trees > hierarchical trees > timelines > cause-effect diagrams > checklists > formula cards > structured bullets > paragraphs (last resort).
- Eliminate filler, introductions, transitions, conversational language, and motivational language.
- Preserve all important information — do not just shorten the source.
- Every section must be scannable and understandable in under 30 seconds.

Use these plain-text diagram conventions inside "content" (as markdown code blocks or plain text — no images):
- Flowcharts: A ↓ B ↓ C
- Decision trees: Condition? ├─ Yes → Outcome A  └─ No → Outcome B
- Cause-effect: ↑ Inflation ↓ ↑ Interest Rates ↓ ↓ Borrowing
- Definitions/characteristics/examples/exceptions as markdown tables.
- Formulas as a labelled block: Formula, Variables table, Interpretation, Increase/Decrease effects table.
- Comparable concepts as side-by-side comparison tables.

Structure the "sections" array using whichever of these apply to the material (skip ones with no content to put in them):
1. Topic Overview — concise hierarchical topic map of the whole material.
2. Core Concepts — one section per concept: definition table, key-characteristics table, examples table, exceptions table if applicable.
3. Comparisons — side-by-side tables for any comparable concepts.
4. Processes — flowcharts for sequences, workflows, cycles, procedures.
5. Decision Logic — decision trees for rules/conditions/classification.
6. Relationships — cause-effect diagrams for economic/scientific/business relationships.
7. Formulas — formula card per formula (formula, variables table, interpretation, increase/decrease table).
8. Key Facts — compact tables or checklists only.
9. Common Mistakes — frequently confused concepts, misconceptions, important distinctions, typical errors.
10. Chapter Summary — single-screen recap: core idea, most important concepts, key relationships, critical rules, essential formulas.`;

function notesDashboardFilePrompt(subject: string, opts: GenerateOptions): string {
  const includes = opts.notesIncludes ?? [];
  const custom   = opts.customPrompt?.trim();

  const mindmapInstruction = includes.includes('mindmap')
    ? 'Organise the Topic Overview and Core Concepts sections hierarchically: top-level concept first, subsequent sections each explore one branch.'
    : '';

  return `${DASHBOARD_FORMAT_RULES}

Subject: university-level ${subject}.
Based on the content in this file, cover everything important in the material — do not skip topics to save space.
${mindmapInstruction}
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Return ONLY a valid JSON object — no markdown wrapper, no commentary:
{
  "title": "Descriptive title of the material",
  "summary": "2–3 sentence executive summary",
  "sections": [
    {
      "heading": "Section heading (e.g. 'Topic Overview', 'Core Concepts: <name>', 'Comparisons', 'Processes', 'Decision Logic', 'Relationships', 'Formulas', 'Key Facts', 'Common Mistakes', 'Chapter Summary')",
      "content": "Dense markdown — tables/flowcharts/decision trees/checklists per the rules above. Minimal prose.",
      "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
    }
  ]
}`;
}

// ── Notes: chunked generation (outline + per-section calls) ────────────────
//
// A single call asking for the full notes JSON (especially in dashboard
// mode) can take long enough to generate that it exceeds the client/server
// timeout on large or dense documents. Instead, generate an outline first
// (cheap, fast), then fill in each section's content with its own small,
// bounded call — every individual request finishes quickly regardless of
// how long the overall document is.

function notesOutlinePrompt(subject: string, opts: GenerateOptions, dashboard: boolean): string {
  const detail   = opts.notesDetail ?? 'standard';
  const includes = opts.notesIncludes ?? [];
  const custom   = opts.customPrompt?.trim();
  const sectionCount = notesSectionCountRange(detail);

  const mindmapInstruction = includes.includes('mindmap')
    ? 'Organise the headings hierarchically: the first heading introduces the top-level concept, subsequent headings each explore one branch.'
    : '';

  return `You are an expert academic note-taker for university-level ${subject}.

Based on the content in this file, plan the structure of ${dashboard ? 'highly information-dense' : detail} notes with ${sectionCount} sections covering everything important in the material — but do NOT write the section content yet, only the outline.
${mindmapInstruction}
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Return ONLY a valid JSON object — no markdown wrapper, no commentary:
{
  "title": "Descriptive title of the material",
  "summary": "2–3 sentence executive summary",
  "headings": ["Section heading 1", "Section heading 2"]
}`;
}

function notesSectionPrompt(subject: string, opts: GenerateOptions, dashboard: boolean, heading: string): string {
  const custom = opts.customPrompt?.trim();

  if (dashboard) {
    return `${DASHBOARD_FORMAT_RULES}

Subject: university-level ${subject}.
Based on the content in this file, write ONLY the section titled "${heading}" — cover everything in the material relevant to this section, do not skip detail to save space.
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Return ONLY a valid JSON object — no markdown wrapper, no commentary:
{
  "content": "Dense markdown — tables/flowcharts/decision trees/checklists per the rules above. Minimal prose.",
  "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
}`;
  }

  return `You are an expert academic note-taker for university-level ${subject}.

Based on the content in this file, write ONLY the section titled "${heading}". Extract all key concepts, definitions, frameworks, and relationships relevant to this section.
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}

Use clean, well-structured Markdown — standard headers, concise explanations, and bullet points. Bold key terms.

Return ONLY a valid JSON object — no markdown wrapper, no commentary:
{
  "content": "Main explanation in clean markdown (2-4 sentences plus bullet points)",
  "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
}`;
}

const NOTES_OUTLINE_TOKENS = 1024;
const NOTES_SECTION_TOKENS = 2048;
const NOTES_SECTION_TOKENS_DASHBOARD = 3072;

async function generateNotesChunked(
  sourceParts: Part[],
  subjectTitle: string,
  opts: GenerateOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedNote> {
  const dashboard = !!opts.detailedNotes;

  const outlineParts: Part[] = [...sourceParts, { text: notesOutlinePrompt(subjectTitle, opts, dashboard) }];
  const outlineText = await callProxy(outlineParts, { maxOutputTokens: NOTES_OUTLINE_TOKENS });
  const outline = parseJSON(outlineText) as { title?: string; summary?: string; headings?: string[] };

  const headings = Array.isArray(outline.headings) && outline.headings.length > 0
    ? outline.headings
    : ['Overview'];

  const sections: GeneratedNoteSection[] = [];
  for (let i = 0; i < headings.length; i++) {
    onProgress?.(i + 1, headings.length);
    const heading = headings[i];
    const sectionParts: Part[] = [...sourceParts, { text: notesSectionPrompt(subjectTitle, opts, dashboard, heading) }];
    const sectionText = await callProxy(sectionParts, {
      maxOutputTokens: dashboard ? NOTES_SECTION_TOKENS_DASHBOARD : NOTES_SECTION_TOKENS,
    });
    const parsedSection = parseJSON(sectionText) as { content?: string; keyPoints?: string[] };
    sections.push({
      heading,
      content: String(parsedSection.content ?? ''),
      keyPoints: parsedSection.keyPoints,
    });
  }

  return {
    title: String(outline.title ?? subjectTitle),
    summary: String(outline.summary ?? ''),
    sections,
  };
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

function quizExtractionPrompt(subject: string, opts: GenerateOptions): string {
  const count  = opts.questionCount ?? 10;
  const focus  = opts.focusTopic?.trim();
  return `You are a verbatim content extractor for a ${subject} study tool.

Your task is to create exactly ${count} multiple-choice questions by lifting sentences and phrases WORD FOR WORD from the provided document — do NOT paraphrase, summarise, or invent content.
${focus ? `Focus on passages related to: "${focus}".` : ''}

For each question:
1. Find a meaningful sentence or short passage in the document that contains a key term, figure, or fact.
2. Quote that sentence or passage VERBATIM, character-for-character exactly as it appears in the document, as the "question" field — do NOT alter, blank out, redact, or replace any word with "___" or any placeholder. The full original sentence must appear intact, unmodified.
3. Turn it into a question by appending a separate, short instruction after the quoted passage, e.g. ending with "What is the key term/figure described here?" — but the quoted text itself stays 100% unchanged.
4. The correct answer (option at index "correct") must be the term, figure, or fact from that passage, copied verbatim from the document.
5. The three distractors must be plausible alternatives drawn verbatim from elsewhere in the document or closely related concepts — never invented.
6. The explanation must cite the exact sentence from the document where the answer appears.

Never use a blank, underscore, or cloze placeholder anywhere in the "question" field. The quoted passage must read exactly as written in the source document, in full.

Return ONLY valid JSON — no markdown, no commentary:
{
  "questions": [
    {
      "question": "The document states: \\"The company reported revenue of $512 billion in fiscal year 2023.\\" What figure does the document report as the company's fiscal year 2023 revenue?",
      "options": ["$512 billion", "$480 billion", "$390 billion", "$620 billion"],
      "correct": 0,
      "explanation": "The document states verbatim: 'The company reported revenue of $512 billion in fiscal year 2023.'"
    }
  ]
}`;}

function quizFilePrompt(subject: string, opts: GenerateOptions): string {
  if (opts.quizMode === 'extraction') return quizExtractionPrompt(subject, opts);
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
  'flashcards' | 'quiz',
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

function notesTopicPrompt(
  topic: string,
  context: string,
  level: string,
  language?: 'english' | 'japanese' | 'both',
): string {
  return `You are an expert academic note-taker for university students.

Create structured notes on: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.${languageInstruction(language)}

Create 4–7 sections covering everything important about this topic. Use clean, well-structured Markdown for each section's content — standard headers, concise explanations, and bullet points. Bold key terms.

Return ONLY valid JSON — no markdown wrapper, no preamble:
{
  "title": "Descriptive title",
  "summary": "2–3 sentence overview",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Main explanation in clean markdown (2-4 sentences plus bullet points)",
      "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
    }
  ]
}`;
}

function notesDashboardTopicPrompt(
  topic: string,
  context: string,
  level: string,
  language?: 'english' | 'japanese' | 'both',
): string {
  return `${DASHBOARD_FORMAT_RULES}

Topic: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.${languageInstruction(language)}
Cover everything important about this topic — do not skip aspects to save space.

Return ONLY valid JSON — no markdown wrapper, no preamble:
{
  "title": "Descriptive title",
  "summary": "2–3 sentence overview",
  "sections": [
    {
      "heading": "Section heading (e.g. 'Topic Overview', 'Core Concepts: <name>', 'Comparisons', 'Processes', 'Decision Logic', 'Relationships', 'Formulas', 'Key Facts', 'Common Mistakes', 'Chapter Summary')",
      "content": "Dense markdown — tables/flowcharts/decision trees/checklists per the rules above. Minimal prose.",
      "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
    }
  ]
}`;
}

// ── Size thresholds ────────────────────────────────────────────────────────

const LARGE_FILE_THRESHOLD = 3 * 1024 * 1024; // 3 MB

// Cap any single proxy request's page images to this base64 budget — stays
// under Vercel's 4.5 MB body limit and keeps Gemini's response time bounded
// well under the function's maxDuration.
const MAX_CHUNK_B64 = 3_000_000;

// Multi-page flashcard sources are split into batches this large so each
// proxy call finishes quickly instead of risking a gateway timeout on one
// huge request that covers the whole document.
const PAGES_PER_CHUNK = 6;

function chunkPages<T extends { base64: string }>(pages: T[], maxPerChunk: number, maxBytesPerChunk: number): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const p of pages) {
    if (current.length > 0 && (current.length >= maxPerChunk || bytes + p.base64.length > maxBytesPerChunk)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(p);
    bytes += p.base64.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

// ── Large-image compression ─────────────────────────────────────────────────

const COMPRESS_TARGET = 2.5 * 1024 * 1024; // 2.5 MB binary (→ ~3.3 MB base64)

/**
 * Compresses any image file to ≤ 2.5 MB binary using Canvas + JPEG encoding.
 * Scales dimensions down to 2048px on the longest side first, then reduces
 * JPEG quality in steps until the blob is small enough.
 */
async function compressImageToFit(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      const MAX_DIM = 2048;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not available.')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      const attempt = () => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Image compression failed.')); return; }
          if (blob.size <= COMPRESS_TARGET || quality <= 0.1) {
            const reader = new FileReader();
            reader.onload  = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: 'image/jpeg' });
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          } else {
            quality = Math.max(0.1, quality - 0.15);
            attempt();
          }
        }, 'image/jpeg', quality);
      };
      attempt();
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not load image.')); };
    img.src = objectUrl;
  });
}

const NOTES_TOKENS = 8192;
// Dashboard mode packs many tables/diagrams per section, so it needs a much
// larger budget than the default fast prompt to avoid truncating mid-note.
const NOTES_DASHBOARD_TOKENS = 16384;

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateFromFile(
  file: File,
  type: GenerationType,
  subjectTitle: string,
  options: GenerateOptions = {},
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  const prompt =
    type === 'flashcards' ? flashcardFilePrompt(subjectTitle, options) :
    type === 'notes'      ? (options.detailedNotes ? notesDashboardFilePrompt(subjectTitle, options) : notesFilePrompt(subjectTitle, options)) :
                            quizFilePrompt(subjectTitle, options);

  let parts: Part[] | null = null;
  let pageImages: Array<{ base64: string; mimeType: 'image/jpeg' }> | null = null;
  let extractedText: string | null = null;

  if (file.type === 'application/x-studytrainer-pages') {
    // Pre-compressed format: JSON array of JPEG page images, created at upload time.
    pageImages = JSON.parse(await file.text()) as Array<{ base64: string; mimeType: 'image/jpeg' }>;
  } else if (file.type === 'application/pdf') {
    const extracted = await extractTextFromFile(file);
    if (extracted.trim()) {
      // Text-based PDF: embed extracted text — works for any file size.
      extractedText = extracted;
    } else if (file.size > LARGE_FILE_THRESHOLD) {
      // Large scanned PDF: render pages as JPEG images client-side and send
      // as inline_data parts. Bypasses the Files API entirely. Flashcard
      // generation renders far more pages since it chunks them into several
      // bounded requests below instead of sending them all in one call.
      pageImages = await renderPdfPagesAsJpeg(file, type === 'flashcards' ? 60 : 15, 0.65);
    } else {
      // Small scanned PDF: inline base64.
      const base64 = await fileToBase64(file);
      parts = [{ inline_data: { mime_type: file.type, data: base64 } }];
    }
  } else if (file.type.startsWith('image/')) {
    if (file.size > LARGE_FILE_THRESHOLD) {
      // Large image: compress client-side to fit Vercel's 4.5 MB body limit.
      const { base64, mimeType } = await compressImageToFit(file);
      parts = [{ inline_data: { mime_type: mimeType, data: base64 } }];
    } else {
      const base64 = await fileToBase64(file);
      parts = [{ inline_data: { mime_type: file.type, data: base64 } }];
    }
  } else {
    if (file.size > LARGE_FILE_THRESHOLD) {
      throw new Error('File too large. Use a text-based PDF (any size) or an image file.');
    }
    const base64 = await fileToBase64(file);
    parts = [{ inline_data: { mime_type: file.type, data: base64 } }];
  }

  if (pageImages) {
    if (pageImages.length === 0) throw new Error('Could not read any pages from this file.');

    if (type === 'flashcards' && pageImages.length > PAGES_PER_CHUNK) {
      // Split the document into several bounded requests instead of one call
      // covering every page — each chunk finishes well within the gateway's
      // timeout, and results are merged as each chunk completes. Every chunk
      // is asked to extract everything it sees; if the user requested a
      // specific count (rather than "all"), the merged results are trimmed
      // to that count afterwards.
      const chunks = chunkPages(pageImages, PAGES_PER_CHUNK, MAX_CHUNK_B64);
      const chunkPrompt = flashcardFilePrompt(subjectTitle, options, true);
      const merged: GeneratedFlashcard[] = [];
      for (let i = 0; i < chunks.length; i++) {
        onProgress?.(i + 1, chunks.length);
        const chunkParts: Part[] = [
          ...chunks[i].map((p): InlineDataPart => ({ inline_data: { mime_type: p.mimeType, data: p.base64 } })),
          { text: chunkPrompt },
        ];
        const text = await callProxy(chunkParts);
        const parsed = parseJSON(text) as Record<string, unknown>;
        merged.push(...(processResult(parsed, 'flashcards', subjectTitle) as GeneratedFlashcard[]));
      }
      return (options.cardCount && options.cardCount !== 'all') ? merged.slice(0, options.cardCount) : merged;
    }

    // Small enough to fit in one request — cap by base64 budget just in case.
    const pageImageParts: InlineDataPart[] = [];
    let totalB64 = 0;
    for (const p of pageImages) {
      if (totalB64 + p.base64.length > MAX_CHUNK_B64) break;
      pageImageParts.push({ inline_data: { mime_type: p.mimeType, data: p.base64 } });
      totalB64 += p.base64.length;
    }
    if (pageImageParts.length === 0) throw new Error('Could not render any pages from this PDF.');
    parts = pageImageParts;
  }

  if (type === 'notes') {
    const sourceParts: Part[] = extractedText !== null ? [{ text: extractedText }] : (parts ?? []);
    if (sourceParts.length === 0) throw new Error('Could not prepare file content for generation.');
    return generateNotesChunked(sourceParts, subjectTitle, options, onProgress);
  }

  if (extractedText !== null) {
    parts = [{ text: `${prompt}\n\nDocument content:\n${extractedText}` }];
  } else if (parts) {
    parts = [...parts, { text: prompt }];
  }

  if (!parts) throw new Error('Could not prepare file content for generation.');

  const text = await callProxy(parts);
  const parsed = parseJSON(text) as Record<string, unknown>;
  return processResult(parsed, type, subjectTitle);
}

export async function generateFromTopic(
  topic: string,
  type: GenerationType,
  subjectContext = '',
  level = 'intermediate',
  language?: 'english' | 'japanese' | 'both',
  detailedNotes = false,
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  if (type === 'notes') {
    const prompt = detailedNotes
      ? notesDashboardTopicPrompt(topic, subjectContext, level, language)
      : notesTopicPrompt(topic, subjectContext, level, language);
    const text   = await callProxy([{ text: prompt }], { maxOutputTokens: detailedNotes ? NOTES_DASHBOARD_TOKENS : NOTES_TOKENS });
    const parsed = parseJSON(text) as Record<string, unknown>;
    return processResult(parsed, type, topic);
  }

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

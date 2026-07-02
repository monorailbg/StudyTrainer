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
// gateway/serverless function's own timeout (see vercel.json maxDuration)
// so a hung request fails with a clear, actionable message instead of the
// browser waiting on a 504. Large documents no longer need the full budget
// as often now that big text sources are chunked before generation, but a
// single chunk (or a document just under the chunking threshold) can still
// legitimately take a while, so this stays close to the server's ceiling.
const REQUEST_TIMEOUT_MS = 85_000;

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

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ── Retry status pub/sub ─────────────────────────────────────────────────
//
// Lets the UI show a low-profile "Model busy, retrying…" message instead of
// the loading spinner going quiet (or the request just failing) during a
// transient 503 retry. SubjectPage registers a listener before calling
// generateFromFile/generateFromTopic and clears it once generation settles.
type RetryListener = (status: string | null) => void;
let activeRetryListener: RetryListener | null = null;

export function onGenerationRetry(listener: RetryListener | null): void {
  activeRetryListener = listener;
}

function isUnavailableError(errText: string): boolean {
  return errText.includes('UNAVAILABLE') || errText.toLowerCase().includes('high demand') || errText.includes('503');
}

/**
 * Generic exponential-backoff-with-jitter retry wrapper for transient
 * 503 UNAVAILABLE / high-demand errors from the proxy. `apiFn` is retried
 * up to `maxRetries` times; any other error is rethrown immediately.
 */
async function callGeminiWithRetry<T>(
  apiFn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  maxRetries = 3,
  initialDelay = 3000,
): Promise<T> {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiFn();
      activeRetryListener?.(null);
      return result;
    } catch (error) {
      if (isRetryable(error) && attempt < maxRetries) {
        // Random jitter prevents every retrying client from hammering the API in lockstep.
        const jitter = Math.random() * 200;
        activeRetryListener?.('Model busy, retrying…');
        console.warn(`[callProxy] Model high-demand (attempt ${attempt}/${maxRetries}); retrying in ${Math.round((delay + jitter) / 1000)}s…`);
        await sleep(delay + jitter);
        delay *= 2; // Exponentially increase delay
        continue;
      }
      activeRetryListener?.(null);
      throw error; // Not retryable, or retries exhausted — rethrow
    }
  }
  // Unreachable but satisfies TypeScript.
  throw new Error('Generation failed after retries.');
}

async function callProxyOnce(body: string): Promise<string> {
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
    clearTimeout(timeout);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('The request took too long and timed out. Try a smaller batch (fewer pages, or a lower "Cards per file" count instead of "All").');
    }
    // A network-level fetch failure (not an HTTP error response) means the
    // request never reached a server at all — could be the local dev proxy
    // not running, a misconfigured VITE_PROXY_URL, no internet connection,
    // or a browser extension (ad blocker) blocking the request. The message
    // must differ by environment: telling a production user to run a local
    // dev server is actively misleading.
    if (import.meta.env.DEV) {
      throw new Error(`Could not reach the proxy server at "${GENERATE_ENDPOINT}". In development, run: cd server && npm run dev`);
    }
    throw new Error(
      `Could not reach the generation server at "${GENERATE_ENDPOINT}". This usually means a network issue, an ad blocker/extension blocking the request, or the server is temporarily unreachable — check your connection and try again.`,
    );
  }
  clearTimeout(timeout);

  if (response.ok) {
    const data = await response.json() as { text: string };
    if (!data.text) throw new Error('Empty response from proxy.');
    return data.text;
  }

  // Parse the structured error body.
  const err = await response.json().catch(() => ({ error: response.statusText })) as { error: string; retryAfter?: number };
  const errText = err.error ?? '';

  // 503 from the proxy OR high-demand error passed through from the model.
  if (response.status === 503 || isUnavailableError(errText)) {
    throw new Error(errText || 'The AI model is temporarily experiencing high demand. Please try again in a moment.');
  }
  if (response.status === 504 || response.status === 502) {
    throw new Error('The server took too long to respond (gateway timeout). Try a smaller batch (fewer pages, or a lower "Cards per file" count instead of "All").');
  }
  if (response.status === 429) {
    // Prefer the server's actual message when it has one — a brief
    // per-minute rate limit and a fully exhausted daily quota are both
    // 429s, but they mean very different things and have very different
    // wait times; collapsing them into one generic "wait 60s" message hides
    // that distinction from the user.
    if (errText) throw new Error(errText);
    const wait = err.retryAfter ?? 60;
    throw new Error(`Rate limit reached. Please wait ${wait} seconds and try again.`);
  }
  if (response.status === 401) {
    throw new Error('Invalid or expired Gemini API key. Update GEMINI_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy.');
  }
  if (response.status === 400) {
    throw new Error(`Bad request: ${errText}`);
  }

  throw new Error(errText || `Generation failed (HTTP ${response.status}). Please try again.`);
}

async function callProxy(
  parts: Part[],
  options?: CallProxyOptions,
): Promise<string> {
  const body = JSON.stringify({ parts, ...options });
  return callGeminiWithRetry(
    () => callProxyOnce(body),
    err => isUnavailableError(err instanceof Error ? err.message : String(err)),
  );
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
  // Only treat this as a wrapping fence if the WHOLE response starts and ends
  // with ``` — using the outermost markers (not a lazy regex) avoids
  // mistaking a ``` code block nested inside a JSON string value (e.g. a
  // diagram or table the model fenced inside a section's "content" field)
  // for the closing fence, which would silently discard everything after it.
  if (text.startsWith('```')) {
    const lastFence = text.lastIndexOf('```');
    if (lastFence > 2) {
      const firstLineEnd = text.indexOf('\n');
      const body = firstLineEnd === -1 ? '' : text.slice(firstLineEnd + 1, lastFence);
      text = body.trim();
      return text;
    }
  }
  // No fence: skip any preamble and start from first { or [
  const start = text.search(/[{[]/);
  if (start > 0) text = text.slice(start);
  return text;
}

// The model's JSON string values often contain raw backslashes from markdown,
// LaTeX-style formulas, or Mermaid diagram syntax (e.g. "A-->B" is fine, but
// things like "\(x\)", "C:\path", or LaTeX commands like "\underline{}" or
// "\upsilon" are not valid JSON escape sequences) and crash JSON.parse with
// "Bad escaped character in JSON". Escape any backslash that isn't already
// part of a valid JSON escape token before parsing. \u is only a valid
// escape when followed by exactly 4 hex digits — treating a bare backslash
// followed by any "u" as already-valid (the previous, buggy version of this
// regex) let LaTeX commands starting with \u (\underline, \upsilon, ...)
// slip through unescaped and crash with "Bad Unicode escape"/"Bad escaped
// character" instead.
function sanitizeJsonEscapes(text: string): string {
  return text.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
}

// Gemini occasionally emits a raw, unescaped control character (a literal
// newline, tab, or similar 0x00–0x1F byte) inside a JSON string value
// instead of the escaped "\n"/"\t" form — valid as markdown, but illegal
// inside a JSON string literal, which crashes JSON.parse with "Bad control
// character in string literal". Walk the text tracking string boundaries
// (skipping escaped quotes) and escape any raw control character found
// inside a string.
function sanitizeControlChars(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        result += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        result += ch;
        continue;
      }
      const code = text.charCodeAt(i);
      if (code < 0x20) {
        if (ch === '\n') result += '\\n';
        else if (ch === '\r') result += '\\r';
        else if (ch === '\t') result += '\\t';
        else result += '\\u' + code.toString(16).padStart(4, '0');
        continue;
      }
      result += ch;
    } else {
      if (ch === '"') inString = true;
      result += ch;
    }
  }
  return result;
}

// Gemini's JSON-mode output can occasionally include trailing content after
// an otherwise complete, valid JSON value — a stray explanatory sentence, a
// repeated/echoed object, or leftover prose despite "no commentary"
// instructions. JSON.parse rejects the whole string with "Unexpected
// non-whitespace character after JSON at position N" in that case; this
// truncates the text to the position V8 reports and retries parsing just
// the valid JSON prefix.
function stripTrailingGarbage(text: string, err: SyntaxError): string | null {
  const match = /position (\d+)/.exec(err.message);
  if (!match) return null;
  const pos = Number(match[1]);
  if (!(pos > 0) || pos >= text.length) return null;
  return text.slice(0, pos);
}

function parseJSON(raw: string): unknown {
  const text = sanitizeJsonEscapes(sanitizeControlChars(stripCodeFence(raw)));

  // Happy path
  try {
    return JSON.parse(text);
  } catch (firstErr) {
    if (firstErr instanceof SyntaxError) {
      // Case 1: trailing content after an otherwise complete JSON value.
      const truncated = stripTrailingGarbage(text, firstErr);
      if (truncated !== null) {
        try {
          return JSON.parse(truncated);
        } catch {
          // Fall through to the truncation-repair attempt below.
        }
      }
    }

    // Case 2: response was cut off before the closing delimiter — attempt
    // to repair by closing any open structure. Handles the common case
    // where the model ran out of output tokens mid-string, mid-array, or
    // mid-object.
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

  const rawQuestions = parsed['questions'];
  return processQuizQuestions(rawQuestions);
}

// Fail-safe cleanup for when the model still leaks an inline multiple-choice
// option list into the "question" field despite the prompt instructions
// (e.g. "...called ______. A) ergonomics B) work-life balance C) ..."). Only
// trims once it finds a genuine "A) ... B)" sequence — a single
// letter+punctuation match would false-positive on ordinary abbreviations
// that are just as common in study material ("Mr. Smith", "U.S. policy",
// "e.g. this", "Fig. 2", decimal-adjacent text, etc.).
function cleanQuestionStem(question: string): string {
  const match = /\s+A[).]\s+\S[\s\S]*?\s+B[).]\s+\S/i.exec(question);
  if (!match) return question.trim();
  return question.slice(0, match.index).trim();
}

function processQuizQuestions(raw: unknown): GeneratedQuizQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Gemini returned an unexpected format for quiz questions.');
  }
  // The model occasionally repeats the final question verbatim (e.g. when it
  // pads out to hit the requested count) — drop exact repeats of a prior
  // question's text before assigning ids, so duplicates never reach the UI.
  const seen = new Set<string>();
  const deduped = (raw as Array<{
    question: string;
    options: string[];
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
    question: cleanQuestionStem(String(q.question ?? '')),
    options:  q.options,
    correct:  Number(q.correct),
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

// Forbids stopping mid-generation with an incomplete final item, a stub, or
// a placeholder — the flashcard/quiz equivalent of NOTES_COMPLETENESS_RULES
// below, which only covers notes sections.
const NO_PLACEHOLDER_RULE = '\n\n[CRITICAL: COMPLETION] Every item must be fully written out — never leave any field blank, stubbed, or as a placeholder like "TBD", "...", or "to be added". If you are running low on space, finish the item you are currently writing completely and simply return fewer total items rather than leaving the last one incomplete.';

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
${custom ? `Additional instructions: ${custom}` : ''}${NO_PLACEHOLDER_RULE}

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
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}${NO_PLACEHOLDER_RULE}

Return ONLY valid JSON — no markdown, no commentary:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or definition", "topic": "Specific sub-topic" }
  ]
}`;
}

// ── Notes: shared prompt fragments (used by the chunked outline/section and
// topic-based prompts below — file-based notes always go through the
// chunked outline+section path, never a single-call prompt) ───────────────

// Models occasionally reach for HTML layout tags (<br>, <div>, <p>) when
// asked for "clean spacing" — this keeps every notes prompt's output
// renderable as pure Markdown.
const NO_HTML_RULE = 'Output pure Markdown only — never use HTML tags (e.g. <br>, <div>, <p>) for layout or line breaks. Use standard Markdown double-newlines for spacing and structure.';

function notesSectionCountRange(detail: 'concise' | 'standard' | 'comprehensive'): string {
  return detail === 'concise' ? '3–4' : detail === 'comprehensive' ? '8–12' : '4–7';
}

// ── Notes: detailed "dashboard" mode format rules ───────────────────────────
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
- ${NO_HTML_RULE}

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

// Appended to every section-content prompt so a single section can never
// come back empty, truncated, or stubbed out with a placeholder — each
// section is a small, bounded call, so there is always token budget left
// to finish it properly.
const NOTES_COMPLETENESS_RULES = `

[CRITICAL QUALITY CONSTRAINT]
- You must provide comprehensive, textbook-level detail. Do not summarize or truncate.
- This section MUST contain fully developed explanations, definitions, and context.
- NEVER leave the section empty, and never use placeholders like "Content coming soon" or "To be discussed". Write its full content now.
- When creating a markdown table, always finish the entire table structure (headers, separator row, and all data rows) before stopping. Do not emit a partial table outline without data, and do not stop mid-row.`;

function notesSectionPrompt(subject: string, opts: GenerateOptions, dashboard: boolean, heading: string): string {
  const custom = opts.customPrompt?.trim();

  if (dashboard) {
    return `${DASHBOARD_FORMAT_RULES}

Subject: university-level ${subject}.
Based on the content in this file, write ONLY the section titled "${heading}" — cover everything in the material relevant to this section, do not skip detail to save space.
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}${NOTES_COMPLETENESS_RULES}

Return ONLY a valid JSON object — no markdown wrapper, no commentary:
{
  "content": "Dense markdown — tables/flowcharts/decision trees/checklists per the rules above. Minimal prose.",
  "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
}`;
  }

  return `You are an expert academic note-taker for university-level ${subject}.

Based on the content in this file, write ONLY the section titled "${heading}". Extract all key concepts, definitions, frameworks, and relationships relevant to this section.
${custom ? `\nAdditional instructions: ${custom}` : ''}${languageInstruction(opts.language)}${NOTES_COMPLETENESS_RULES}

Use clean, well-structured Markdown — standard headers, concise explanations, and bullet points. Bold key terms. ${NO_HTML_RULE}

Return ONLY a valid JSON object — no markdown wrapper, no commentary:
{
  "content": "Main explanation in clean markdown (2-4 sentences plus bullet points)",
  "keyPoints": ["Specific point 1", "Specific point 2", "Specific point 3"]
}`;
}

const NOTES_OUTLINE_TOKENS = 1024;
// Each section call is bounded to one heading's content, so a generous
// per-section budget still finishes well within the request timeout —
// unlike the old single whole-document call this replaced.
const NOTES_SECTION_TOKENS = 4096;
const NOTES_SECTION_TOKENS_DASHBOARD = 8192;

async function generateNotesChunked(
  sourceParts: Part[],
  subjectTitle: string,
  opts: GenerateOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedNote> {
  const dashboard = !!opts.detailedNotes;

  const outlineParts: Part[] = [...sourceParts, { text: notesOutlinePrompt(subjectTitle, opts, dashboard) }];
  const outlineText = await callProxy(outlineParts, { maxOutputTokens: NOTES_OUTLINE_TOKENS, responseMimeType: 'application/json' });
  const outline = parseJSON(outlineText) as { title?: string; summary?: string; headings?: string[] };

  const headings = Array.isArray(outline.headings) && outline.headings.length > 0
    ? outline.headings
    : ['Overview'];

  // Each section is its own bounded request — if one section fails even
  // after the client/server retry layers are exhausted (or its response
  // can't be parsed despite the JSON repair pipeline), skip just that
  // section instead of discarding every section already generated
  // successfully. Only throws if every single section fails.
  const sections: GeneratedNoteSection[] = [];
  const failedHeadings: string[] = [];
  for (let i = 0; i < headings.length; i++) {
    onProgress?.(i + 1, headings.length);
    const heading = headings[i];
    try {
      const sectionParts: Part[] = [...sourceParts, { text: notesSectionPrompt(subjectTitle, opts, dashboard, heading) }];
      const sectionText = await callProxy(sectionParts, {
        maxOutputTokens: dashboard ? NOTES_SECTION_TOKENS_DASHBOARD : NOTES_SECTION_TOKENS,
        temperature: 0.3,
        responseMimeType: 'application/json',
      });
      const parsedSection = parseJSON(sectionText) as { content?: string; keyPoints?: string[] };
      sections.push({
        heading,
        content: String(parsedSection.content ?? ''),
        keyPoints: parsedSection.keyPoints,
      });
    } catch (err) {
      console.error(`[generateNotesChunked] Section "${heading}" failed, skipping:`, err);
      failedHeadings.push(heading);
    }
  }

  if (sections.length === 0) {
    throw new Error(`Could not generate any section (all ${headings.length} failed). Try again, or generate a smaller/simpler note.`);
  }

  return {
    title: String(outline.title ?? subjectTitle),
    summary: failedHeadings.length > 0
      ? `${String(outline.summary ?? '')}\n\n(Note: ${failedHeadings.length} section${failedHeadings.length > 1 ? 's' : ''} could not be generated and were skipped — you can try regenerating if needed.)`
      : String(outline.summary ?? ''),
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

function quizExtractionPrompt(subject: string, opts: GenerateOptions, chunkExcerpt = false): string {
  const count  = opts.questionCount ?? 10;
  const focus  = opts.focusTopic?.trim();
  return `You are a verbatim content extractor for a ${subject} study tool.
${chunkExcerpt ? '\nNote: the text below is one excerpt of a larger document, split for processing — extract every pre-written question you find in THIS excerpt (and, if none exist, build verbatim-passage questions from it as described below); do not worry about the total count across the whole document, that is handled separately.\n' : ''}

[CRITICAL: EXTRACTION MODE]
- You are a strict text extractor, not a question writer. If the source document already contains pre-written multiple-choice questions (e.g. an exam paper, quiz sheet, or worksheet with its own lettered options), copy those questions, their options, and their answers EXACTLY as written — do NOT rephrase, alter, add to, or omit any text from the questions or options.
- Do NOT invent or generate new questions when the source already has its own. If the source document contains 6 pre-written questions, output exactly those 6 questions — not more, not fewer — even if that differs from the requested count below.
- The requested count of ${count} questions below applies ONLY when the source document is prose (a textbook, article, notes) with no pre-existing questions of its own, in which case you build ${count} questions from verbatim passages as described.
${focus ? `Focus on passages related to: "${focus}".` : ''}

[CRITICAL: TEXT CLEANING]
- The "question" field must contain ONLY the question stem or fill-in-the-blank sentence itself — never the answer choices.
- When the source lists its options inline right after the question (e.g. "...is called ______. A) ergonomics B) work-life balance C) quality of work life"), you MUST strip that entire inline option list out of the "question" field and move each option's text into its own slot in the "options" array instead. The "question" field ends at the sentence/blank — it must NOT contain "A)", "B)", "C)" or any option text after it.
- Example of what NOT to do: "question": "An overall environment... is called ______. A) ergonomics B) work-life balance C) quality of work life D) job enrichment E) employee turnover" — this is WRONG because the options leaked into the question field.
- Correct version: "question": "An overall environment... is called ______." with "options": ["ergonomics", "work-life balance", "quality of work life", "job enrichment", "employee turnover"].

For each question:
1. If the document already presents this as a formatted multiple-choice question, copy the question text, every option, and the letter/position of the correct answer VERBATIM, character-for-character — do not touch the wording, option count, or order. The question text itself must exclude the "A) ... B) ... C) ..." option list — that list belongs only in the "options" array, per the TEXT CLEANING rule above.
2. Otherwise, find a meaningful sentence or short passage in the document that contains a key term, figure, or fact, and quote that sentence or passage VERBATIM as the "question" field — do NOT alter, blank out, redact, or replace any word with "___" or any placeholder. The full original sentence must appear intact, unmodified.
3. When building a question from prose (case 2), turn it into a question by appending a separate, short instruction after the quoted passage, e.g. ending with "What is the key term/figure described here?" — but the quoted text itself stays 100% unchanged.
4. The correct answer (option at index "correct") must be the term, figure, or fact from that passage (or the document's own marked correct answer), copied verbatim from the document.
5. If the source document itself presents this question as a pre-written multiple-choice item (e.g. an exam paper with its own lettered options A, B, C, D, E...), copy that document's own options VERBATIM and preserve its exact option count — do NOT reduce it to 4. Otherwise, when you must invent distractors yourself (case 2), write exactly three plausible alternatives drawn verbatim from elsewhere in the document or closely related concepts — never invented out of thin air.
6. The explanation must cite the exact sentence from the document where the answer appears.

Never use a blank, underscore, or cloze placeholder anywhere in the "question" field. The quoted passage must read exactly as written in the source document, in full — but with any inline option list removed and relocated into the "options" array as described above.
${NO_PLACEHOLDER_RULE}

Return ONLY the raw JSON object below — no markdown fences, no conversational introduction or conclusion, no commentary before or after the JSON, nothing but the object itself. The "options" array length must match the source document's own option count when the document presents a pre-written multiple-choice question (it may be 5 or more); only default to 4 total options when you are inventing the distractors yourself:
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

const OPTION_COUNT_RULE = `
- Analyze the source material for each question. If the source question explicitly provides 5 options, you MUST generate exactly 5 corresponding options (A, B, C, D, E).
- Do not truncate or force the quiz into a standard 4-option (A-D) format if the source text contains more.
- If the source material does not present pre-existing options (i.e. you are writing the question yourself), default to exactly 4 options.
- [CRITICAL: TEXT CLEANING] The "question" field must contain ONLY the question stem — never the answer choices. If the source lists options inline right after the question (e.g. "...called ______. A) ergonomics B) work-life balance C) quality of work life"), strip that entire inline list out of the "question" field and place each option's text into its own slot in the "options" array instead. The "question" field must never contain "A)", "B)", "C)" or any option text after the stem.`;

function quizFilePrompt(subject: string, opts: GenerateOptions, chunkExcerpt = false): string {
  if (opts.quizMode === 'extraction') return quizExtractionPrompt(subject, opts, chunkExcerpt);
  const count  = opts.questionCount ?? 10;
  const focus  = opts.focusTopic?.trim();
  const custom = opts.customPrompt?.trim();
  return `You are an expert exam question writer for university-level ${subject}.

${chunkExcerpt
    ? `The text below is one excerpt of a larger document, split for processing. Create up to ${count} multiple-choice questions covering the material in THIS excerpt — fewer is fine if the excerpt doesn't support that many; do not pad with filler or repeat concepts just to hit the number. Do not worry about the total count across the whole document, that is handled separately.`
    : `Analyse the content in this file and create exactly ${count} multiple-choice questions.`}
${focus ? `Focus specifically on the topic: "${focus}".` : ''}${difficultyInstruction(opts.difficulty)}
${custom ? `Additional instructions: ${custom}` : ''}${languageInstruction(opts.language)}${NO_PLACEHOLDER_RULE}

Option count rules:${OPTION_COUNT_RULE}

Return ONLY valid JSON — no markdown, no commentary. The example below shows two questions purely to demonstrate that "options" arrays are NOT all the same length — copy the source material's actual option count for each question individually, it is not always 4:
{
  "questions": [
    {
      "question": "Clear, specific question (source material provided only 4 options, or none at all)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this is correct (1-2 sentences)"
    },
    {
      "question": "Clear, specific question (source material explicitly provided 5 options for THIS question)",
      "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
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
Level: ${LEVEL_MAP[level] ?? level}.${languageInstruction(language)}${NO_PLACEHOLDER_RULE}

Return ONLY valid JSON — no markdown, no preamble:
{
  "flashcards": [
    { "front": "Concise question or term", "back": "Clear answer or explanation", "topic": "Sub-topic category" }
  ]
}`,

  quiz: (topic, context, level, language) =>
    `You are an expert exam question writer for university students.

Create exactly 10 multiple-choice questions on: "${topic}"${context ? ` for a ${context} course` : ''}.
Level: ${LEVEL_MAP[level] ?? level}.${languageInstruction(language)}${NO_PLACEHOLDER_RULE}

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

Create 4–7 sections covering everything important about this topic. Use clean, well-structured Markdown for each section's content — standard headers, concise explanations, and bullet points. Bold key terms. ${NO_HTML_RULE}${NOTES_COMPLETENESS_RULES}

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
Cover everything important about this topic — do not skip aspects to save space.${NOTES_COMPLETENESS_RULES}

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

// A text-based PDF/paste above this many words is split into batches before
// generation — a single request carrying the whole document risks a slow
// response that eats into the gateway's maxDuration, especially for quiz
// generation where the model has to read the entire text before writing a
// single question.
const LARGE_TEXT_THRESHOLD_WORDS = 4500;
const TEXT_WORDS_PER_CHUNK = 4000;
// Small word overlap between consecutive chunks so a concept or question
// split across a chunk boundary still appears whole in at least one chunk,
// instead of being silently lost or half-extracted at the edge.
const TEXT_CHUNK_OVERLAP_WORDS = 200;

function chunkText(text: string, wordsPerChunk = TEXT_WORDS_PER_CHUNK, overlapWords = TEXT_CHUNK_OVERLAP_WORDS): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= LARGE_TEXT_THRESHOLD_WORDS) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start = end - overlapWords;
  }
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

// ── Quiz/flashcards: chunked generation from large extracted text ──────────
//
// A large text-based PDF (or pasted text) is split into overlapping word
// chunks and generated one excerpt at a time instead of one call carrying
// the entire document — each request finishes quickly and reports progress
// via onProgress, matching the existing image-page chunking UX.

async function generateQuizOrFlashcardsFromTextChunks(
  extractedText: string,
  type: 'quiz' | 'flashcards',
  subjectTitle: string,
  options: GenerateOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedFlashcard[] | GeneratedQuizQuestion[]> {
  const chunks = chunkText(extractedText);

  // Each chunk is its own bounded request — if one chunk fails even after
  // the retry layers are exhausted, skip just that chunk's contribution
  // instead of discarding every chunk already generated successfully. Only
  // throws if every single chunk fails.
  let failedChunks = 0;

  if (type === 'flashcards') {
    const chunkPrompt = flashcardFilePrompt(subjectTitle, options, true);
    const merged: GeneratedFlashcard[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i + 1, chunks.length);
      try {
        const text = await callProxy(
          [{ text: `${chunkPrompt}\n\nDocument excerpt ${i + 1} of ${chunks.length}:\n${chunks[i]}` }],
          { responseMimeType: 'application/json' },
        );
        const parsed = parseJSON(text) as Record<string, unknown>;
        merged.push(...(processResult(parsed, 'flashcards', subjectTitle) as GeneratedFlashcard[]));
      } catch (err) {
        console.error(`[generateQuizOrFlashcardsFromTextChunks] Chunk ${i + 1}/${chunks.length} failed, skipping:`, err);
        failedChunks++;
      }
    }
    if (merged.length === 0) {
      throw new Error(`Could not generate any flashcards (all ${chunks.length} batches failed). Try again, or use a smaller document.`);
    }
    if (failedChunks > 0) console.warn(`[generateQuizOrFlashcardsFromTextChunks] ${failedChunks}/${chunks.length} batches failed — returning flashcards from the remaining ${chunks.length - failedChunks}.`);
    return (options.cardCount && options.cardCount !== 'all') ? merged.slice(0, options.cardCount) : merged;
  }

  // Quiz: split the requested total across chunks, generating a little extra
  // per chunk so the global dedupe below still has enough left after
  // dropping cross-chunk repeats from the overlapping text windows.
  const isExtraction = options.quizMode === 'extraction';
  const totalCount = options.questionCount ?? 10;
  const perChunkCount = Math.max(2, Math.ceil(totalCount / chunks.length));
  const merged: GeneratedQuizQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    try {
      const chunkPrompt = quizFilePrompt(subjectTitle, { ...options, questionCount: perChunkCount }, true);
      const text = await callProxy(
        [{ text: `${chunkPrompt}\n\nDocument excerpt ${i + 1} of ${chunks.length}:\n${chunks[i]}` }],
        { responseMimeType: 'application/json' },
      );
      const parsed = parseJSON(text) as Record<string, unknown>;
      const questions = processResult(parsed, 'quiz', subjectTitle) as GeneratedQuizQuestion[];
      for (const q of questions) {
        const key = q.question.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(q);
      }
    } catch (err) {
      console.error(`[generateQuizOrFlashcardsFromTextChunks] Chunk ${i + 1}/${chunks.length} failed, skipping:`, err);
      failedChunks++;
    }
  }
  if (merged.length === 0) {
    throw new Error(`Could not generate any questions (all ${chunks.length} batches failed). Try again, or use a smaller document.`);
  }
  if (failedChunks > 0) console.warn(`[generateQuizOrFlashcardsFromTextChunks] ${failedChunks}/${chunks.length} batches failed — returning questions from the remaining ${chunks.length - failedChunks}.`);
  // Extraction mode must preserve every distinct question the source
  // actually contains — trimming to totalCount would silently drop real
  // exam questions. "Generated" mode still honours the requested count.
  return isExtraction ? merged : merged.slice(0, totalCount);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateFromFile(
  file: File,
  type: GenerationType,
  subjectTitle: string,
  options: GenerateOptions = {},
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedFlashcard[] | GeneratedNote | GeneratedQuizQuestion[]> {
  let parts: Part[] | null = null;
  let pageImages: Array<{ base64: string; mimeType: 'image/jpeg' }> | null = null;
  let extractedText: string | null = null;

  if (file.type === 'application/x-studytrainer-text') {
    // Virtual text source: raw text pasted by the user, stored as a plain text blob.
    extractedText = await file.text();
    if (!extractedText.trim()) throw new Error(`"${file.name}" is empty — add some text content before generating.`);
  } else if (file.type === 'application/x-studytrainer-pages') {
    // Pre-compressed format: JSON array of JPEG page images, created at upload time.
    pageImages = JSON.parse(await file.text()) as Array<{ base64: string; mimeType: 'image/jpeg' }>;
  } else if (file.type === 'application/pdf') {
    let extracted: string;
    try {
      extracted = await extractTextFromFile(file);
    } catch (err) {
      console.error('[generateFromFile] PDF text extraction failed for', file.name, err);
      throw err instanceof Error ? err : new Error(`Could not read "${file.name}" — invalid or corrupted PDF.`);
    }
    if (extracted.trim()) {
      // Text-based PDF: embed extracted text — works for any file size.
      extractedText = extracted;
    } else if (file.size > LARGE_FILE_THRESHOLD) {
      // Large scanned PDF: render pages as JPEG images client-side and send
      // as inline_data parts. Bypasses the Files API entirely. Flashcard
      // generation renders far more pages since it chunks them into several
      // bounded requests below instead of sending them all in one call.
      try {
        pageImages = await renderPdfPagesAsJpeg(file, type === 'flashcards' ? 60 : 15, 0.65);
      } catch (err) {
        console.error('[generateFromFile] PDF page rendering failed for', file.name, err);
        throw err instanceof Error ? err : new Error(`Could not render pages of "${file.name}" — invalid or corrupted PDF.`);
      }
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
        const text = await callProxy(chunkParts, { responseMimeType: 'application/json' });
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

  if (extractedText !== null && extractedText.split(/\s+/).filter(Boolean).length > LARGE_TEXT_THRESHOLD_WORDS) {
    return generateQuizOrFlashcardsFromTextChunks(extractedText, type, subjectTitle, options, onProgress);
  }

  // Only flashcards/quiz reach here — notes always returns earlier via
  // generateNotesChunked, and large text sources via the chunked path above.
  const prompt = type === 'flashcards' ? flashcardFilePrompt(subjectTitle, options) : quizFilePrompt(subjectTitle, options);

  if (extractedText !== null) {
    parts = [{ text: `${prompt}\n\nDocument content:\n${extractedText}` }];
  } else if (parts) {
    parts = [...parts, { text: prompt }];
  }

  if (!parts) throw new Error('Could not prepare file content for generation.');

  const text = await callProxy(parts, { responseMimeType: 'application/json' });
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
    const text   = await callProxy([{ text: prompt }], {
      maxOutputTokens: detailedNotes ? NOTES_DASHBOARD_TOKENS : NOTES_TOKENS,
      temperature: 0.3,
      responseMimeType: 'application/json',
    });
    const parsed = parseJSON(text) as Record<string, unknown>;
    return processResult(parsed, type, topic);
  }

  const prompt = TOPIC_PROMPTS[type](topic, subjectContext, level, language);
  const text   = await callProxy([{ text: prompt }], { responseMimeType: 'application/json' });
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

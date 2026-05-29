import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { ALL_SUBJECTS } from '../data/subjects';
import { generateFromTopic } from '../lib/geminiGenerator';
import type {
  GenerationType,
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
} from '../lib/generator';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { NotesViewer } from '../components/NotesViewer';
import { QuizViewer } from '../components/QuizViewer';

function friendlyError(raw: string): string {
  if (!raw) return 'Generation failed.';
  if (raw.includes('VITE_GEMINI_API_KEY') || raw.includes('not set'))
    return 'Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.';
  if (raw.includes('403') || raw.includes('API_KEY_INVALID') || raw.toLowerCase().includes('api key'))
    return 'Invalid API key. Check VITE_GEMINI_API_KEY in your .env file.';
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('limit: 0')) {
    const isPerMinute = raw.toLowerCase().includes('per minute') || raw.toLowerCase().includes('rpm') || raw.includes('429');
    if (isPerMinute)
      return 'Per-minute rate limit hit (Gemini free tier: 15 req/min). The system retried automatically — if this keeps happening, wait 2 minutes before trying again.';
    return 'Daily quota reached. The Gemini free tier allows 1,500 requests per day. Try again tomorrow or check your usage at ai.google.dev.';
  }
  if (raw.toLowerCase().includes('quota'))
    return 'Quota limit reached. Check your Gemini API usage at ai.google.dev.';
  if (raw.includes('429'))
    return 'Rate limit hit. Wait 60 seconds and try again.';
  if (raw.includes('400'))
    return 'Bad request — topic too long or unsupported content.';
  return `Generation failed: ${raw.slice(0, 160)}`;
}

const SparkleIcon = ({ color = '#3D7EFF' }: { color?: string }) => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M4.22 4.22l2.83 2.83M12.95 12.95l2.83 2.83M4.22 15.78l2.83-2.83M12.95 7.05l2.83-2.83" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const Spinner = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"
    style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6" stroke={color + '28'} strokeWidth="2" />
    <path d="M8 2a6 6 0 016 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </svg>
);

type Level = 'introductory' | 'intermediate' | 'advanced';
type GenStatus = 'idle' | 'generating' | 'done' | 'error';

interface Result {
  type: GenerationType;
  topic: string;
  color: string;
  flashcards?: GeneratedFlashcard[];
  notes?: GeneratedNote;
  quiz?: GeneratedQuizQuestion[];
}

export default function Generate() {
  useLang();

  const [topic, setTopic] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [level, setLevel] = useState<Level>('intermediate');
  const [contentType, setContentType] = useState<GenerationType>('flashcards');

  const [status, setStatus] = useState<GenStatus>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const subject = ALL_SUBJECTS.find(s => s.id === selectedSubjectId);
  const accentColor = subject?.color ?? '#3D7EFF';
  const canGenerate = topic.trim().length >= 3;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStatus('generating');
    setError('');
    setResult(null);
    try {
      const output = await generateFromTopic(topic.trim(), contentType, subject?.title ?? '', level);
      const r: Result = { type: contentType, topic: topic.trim(), color: accentColor };
      if (contentType === 'flashcards') r.flashcards = output as GeneratedFlashcard[];
      if (contentType === 'notes') r.notes = output as GeneratedNote;
      if (contentType === 'quiz') r.quiz = output as GeneratedQuizQuestion[];
      setResult(r);
      setStatus('done');
    } catch (err) {
      setError(String(err));
      setStatus('error');
    }
  };

  const levels: { key: Level; label: string }[] = [
    { key: 'introductory', label: 'Introductory' },
    { key: 'intermediate', label: 'Intermediate' },
    { key: 'advanced', label: 'Advanced' },
  ];

  const types: { key: GenerationType; label: string; count: string }[] = [
    { key: 'flashcards', label: 'Flashcards', count: '12 cards' },
    { key: 'notes', label: 'Notes', count: '4–7 sections' },
    { key: 'quiz', label: 'Quiz', count: '10 questions' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-9 pb-20">

      {/* Header */}
      <div className="mb-8">
        <div className="text-md-primary text-[10px] tracking-[0.18em] uppercase font-semibold mb-2">
          AI Generator
        </div>
        <h1 className="font-display text-md-on-surface m-0 mb-2 leading-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)' }}>
          Generate Study Materials
        </h1>
        <p className="text-md-on-surface-variant text-sm m-0 leading-relaxed">
          Type any topic and Gemini will build flashcards, structured notes, or a quiz.
        </p>
      </div>

      {/* Config form */}
      <div className="bg-md-surface-container rounded-3xl overflow-hidden border border-md-outline-variant mb-7">

        {/* Topic input */}
        <div className="px-6 py-5 border-b border-md-outline-variant">
          <label className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold block mb-2.5">
            Topic
          </label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Comparative advantage and the Heckscher-Ohlin model, Porter's Five Forces, SWOT analysis..."
            rows={3}
            className="md-textarea !rounded-2xl !text-sm"
          />
        </div>

        {/* Subject context */}
        <div className="px-6 py-5 border-b border-md-outline-variant">
          <div className="flex items-baseline gap-2.5 mb-3">
            <span className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold">
              Subject context
            </span>
            <span className="text-md-outline text-[10px]">optional</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SUBJECTS.map(s => {
              const isSelected = selectedSubjectId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubjectId(isSelected ? '' : s.id)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-full text-xs border cursor-pointer transition-all duration-150 whitespace-nowrap font-medium"
                  style={{
                    backgroundColor: isSelected ? s.color + '18' : 'var(--color-md-surface-container-high)',
                    borderColor: isSelected ? s.color + '55' : 'var(--color-md-outline-variant)',
                    color: isSelected ? s.color : 'var(--color-md-on-surface-variant)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  {s.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Level + Type + Generate */}
        <div className="px-6 py-5 flex items-end gap-6 flex-wrap">

          {/* Level */}
          <div>
            <div className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold mb-2">
              Level
            </div>
            <div className="flex gap-1">
              {levels.map(l => (
                <button
                  key={l.key}
                  onClick={() => setLevel(l.key)}
                  className={`h-8 px-3 rounded-full text-xs cursor-pointer border transition-all duration-150 whitespace-nowrap font-medium ${
                    level === l.key
                      ? 'bg-md-surface-container-highest text-md-on-surface border-md-outline'
                      : 'bg-transparent text-md-on-surface-variant border-md-outline-variant hover:bg-md-surface-container-high'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-12 bg-md-outline-variant flex-shrink-0" />

          {/* Content type */}
          <div>
            <div className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold mb-2">
              Generate
            </div>
            <div className="flex gap-1.5">
              {types.map(tp => {
                const isSelected = contentType === tp.key;
                return (
                  <button
                    key={tp.key}
                    onClick={() => setContentType(tp.key)}
                    className="flex flex-col items-center h-12 px-4 rounded-2xl border cursor-pointer transition-all duration-150 gap-0.5 justify-center"
                    style={{
                      backgroundColor: isSelected ? accentColor + '18' : 'var(--color-md-surface-container-high)',
                      borderColor: isSelected ? accentColor + '50' : 'var(--color-md-outline-variant)',
                      color: isSelected ? accentColor : 'var(--color-md-on-surface-variant)',
                    }}
                  >
                    <span className="text-xs font-semibold">{tp.label}</span>
                    <span className="text-[10px] opacity-60 font-normal">{tp.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <div className="ml-auto">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || status === 'generating'}
              className={`h-11 px-7 rounded-full text-sm font-semibold flex items-center gap-2 border-0 cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-default whitespace-nowrap${canGenerate && status !== 'generating' ? ' btn-accent' : ''}`}
              style={{
                backgroundColor: canGenerate && status !== 'generating' ? '#3D7EFF' : 'var(--color-md-surface-container-high)',
                color: canGenerate && status !== 'generating' ? '#E6EDF3' : 'var(--color-md-on-surface-variant)',
              }}
            >
              {status === 'generating' ? (
                <><Spinner color={accentColor} />Generating...</>
              ) : (
                <><SparkleIcon color={canGenerate ? '#E6EDF3' : 'var(--color-md-on-surface-variant)'} />Generate</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-5 py-4 text-red-400 text-sm mb-6">
          <div>{friendlyError(error)}</div>
          {error && (
            <div className="mt-2 text-[11px] opacity-50 break-all" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {error.slice(0, 220)}
            </div>
          )}
        </div>
      )}

      {/* Output */}
      {status === 'done' && result && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: result.color }} />
              <span className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold">
                {result.type === 'flashcards' ? `${result.flashcards?.length} Flashcards`
                  : result.type === 'notes' ? `${result.notes?.sections.length} Sections`
                  : `${result.quiz?.length} Questions`}
              </span>
              <span className="text-md-outline text-[10px]">·</span>
              <span className="text-md-on-surface-variant text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                {result.topic}
              </span>
            </div>
            <button
              onClick={() => { setResult(null); setStatus('idle'); }}
              className="bg-transparent border-none text-md-on-surface-variant text-xs cursor-pointer underline p-0 hover:text-md-on-surface"
            >
              Clear
            </button>
          </div>

          {result.flashcards && <FlashcardViewer cards={result.flashcards} color={result.color} />}
          {result.notes && <NotesViewer notes={result.notes} />}
          {result.quiz && <QuizViewer questions={result.quiz} color={result.color} />}
        </div>
      )}

      {/* Idle hint */}
      {status === 'idle' && (
        <div className="bg-md-surface-container rounded-3xl p-8 border border-md-outline-variant text-center">
          <div className="flex justify-center mb-3 opacity-30">
            <SparkleIcon color="var(--color-md-on-surface-variant)" />
          </div>
          <div className="text-md-on-surface-variant text-sm">
            Enter a topic above to generate study materials
          </div>
        </div>
      )}
    </div>
  );
}

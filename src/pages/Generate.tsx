import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useResolvedSubjects } from '../store/useSubjects';
import { generateFromTopic } from '../lib/geminiProxy';
import type {
  GenerationType,
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
} from '../lib/generator';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { NotesViewer } from '../components/NotesViewer';
import { QuizViewer } from '../components/QuizViewer';
import { saveQuiz, saveNote, saveFlashcardSet, type StoredQuiz, type StoredNote, type StoredFlashcardSet } from '../lib/db';
import { isFirebaseConfigured, saveCloudQuiz, saveCloudNote, saveCloudFlashcardSet } from '../lib/cloudDb';

function friendlyError(raw: string): string {
  if (!raw) return 'Generation failed.';
  if (raw.includes('401') || raw.includes('API_KEY_INVALID'))
    return 'Invalid or expired API key. Check the server configuration.';
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('limit: 0')) {
    const isPerMinute = raw.toLowerCase().includes('per minute') || raw.toLowerCase().includes('rpm');
    if (isPerMinute) return 'Per-minute rate limit hit. Wait 2 minutes and try again.';
    return 'Daily quota exhausted on all models. Try again tomorrow.';
  }
  if (raw.toLowerCase().includes('quota')) return 'Quota limit reached. Try again tomorrow.';
  // No hardcoded "429 → wait 60s" fallback on purpose — geminiProxy.ts now
  // throws the server's actual message for a 429, which already states the
  // real reason and wait time; that falls through to the generic branch
  // below instead of being overridden by a fixed, often-wrong guess.
  if (raw.includes('400')) return 'Bad request — topic too long or unsupported content.';
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
  const { ts } = useLang();
  const { theme } = useTheme();
  const { allSubjects: ALL_SUBJECTS } = useResolvedSubjects();

  const isLight = theme === 'light';
  // In light mode, use warm aesthetic colors; in dark mode, use the neon blue
  const buttonActiveBg = isLight ? '#D97706' : '#3D7EFF';       // burnt orange in light, neon blue in dark
  const buttonActiveText = isLight ? '#3D3428' : '#E6EDF3';     // dark charcoal in light, white in dark
  const buttonActiveIcon = isLight ? '#8B6F47' : '#E6EDF3';     // warm brown icon in light, white in dark

  const [topic, setTopic] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [level, setLevel] = useState<Level>('intermediate');
  const [contentType, setContentType] = useState<GenerationType>('flashcards');

  const [status, setStatus] = useState<GenStatus>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const subject = ALL_SUBJECTS.find(s => s.id === selectedSubjectId);
  const accentColor = subject?.color ?? '#3D7EFF';
  const canGenerate = topic.trim().length >= 3;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStatus('generating');
    setError('');
    setResult(null);
    setSaveState('idle');
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

  // Generate page results have no subjectId/quizId to attach to, so nothing
  // is saved automatically (see QuizViewer's disableResultPersistence) —
  // this lets the user explicitly persist the generated set to a real subject.
  const handleSaveToSubject = async () => {
    if (!result || !selectedSubjectId) return;
    setSaveState('saving');
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const name = result.topic.slice(0, 60);
      const createdAt = Date.now();
      if (result.type === 'quiz' && result.quiz) {
        const quiz: StoredQuiz = { id: `quiz-${id}`, subjectId: selectedSubjectId, name, createdAt, questions: result.quiz };
        if (isFirebaseConfigured) {
          try { await saveCloudQuiz(quiz); } catch { await saveQuiz(quiz); }
        } else {
          await saveQuiz(quiz);
        }
      } else if (result.type === 'flashcards' && result.flashcards) {
        const set: StoredFlashcardSet = { id: `set-${id}`, subjectId: selectedSubjectId, name, createdAt, cards: result.flashcards };
        if (isFirebaseConfigured) {
          try { await saveCloudFlashcardSet(set); } catch { await saveFlashcardSet(set); }
        } else {
          await saveFlashcardSet(set);
        }
      } else if (result.type === 'notes' && result.notes) {
        const note: StoredNote = { id: `note-${id}`, subjectId: selectedSubjectId, name, createdAt, note: result.notes };
        if (isFirebaseConfigured) {
          try { await saveCloudNote(note); } catch { await saveNote(note); }
        } else {
          await saveNote(note);
        }
      }
      setSaveState('saved');
    } catch {
      setSaveState('error');
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
          {ts('AI Generator')}
        </div>
        <h1 className="font-display text-md-on-surface m-0 mb-2 leading-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)' }}>
          {ts('Generate Study Materials')}
        </h1>
        <p className="text-md-on-surface-variant text-sm m-0 leading-relaxed">
          {ts('Type any topic and Gemini will build flashcards, structured notes, or a quiz.')}
        </p>
      </div>

      {/* Config form */}
      <div className="bg-md-surface-container rounded-3xl overflow-hidden border border-md-outline-variant mb-7">

        {/* Topic input */}
        <div className="px-6 py-5 border-b border-md-outline-variant">
          <label className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold block mb-2.5">
            {ts('Topic')}
          </label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder={ts("e.g. Comparative advantage and the Heckscher-Ohlin model, Porter's Five Forces, SWOT analysis...")}
            rows={3}
            className="md-textarea !rounded-2xl !text-sm"
          />
        </div>

        {/* Subject context */}
        <div className="px-6 py-5 border-b border-md-outline-variant">
          <div className="flex items-baseline gap-2.5 mb-3">
            <span className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold">
              {ts('Subject context')}
            </span>
            <span className="text-md-outline text-[10px]">{ts('optional')}</span>
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
              {ts('Level')}
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
                  {ts(l.label)}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-12 bg-md-outline-variant flex-shrink-0" />

          {/* Content type */}
          <div>
            <div className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold mb-2">
              {ts('Generate')}
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
                    <span className="text-xs font-semibold">{ts(tp.label)}</span>
                    <span className="text-[10px] opacity-60 font-normal">{ts(tp.count)}</span>
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
                backgroundColor: canGenerate && status !== 'generating' ? buttonActiveBg : 'var(--color-md-surface-container-high)',
                color: canGenerate && status !== 'generating' ? buttonActiveText : 'var(--color-md-on-surface-variant)',
              }}
            >
              {status === 'generating' ? (
                <><Spinner color={accentColor} />{ts('Generating...')}</>
              ) : (
                <><SparkleIcon color={canGenerate ? buttonActiveIcon : 'var(--color-md-on-surface-variant)'} />{ts('Generate')}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-5 py-4 text-red-400 text-sm mb-6 flex items-start gap-3">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <div>{ts(friendlyError(error))}</div>
            {error && (
              <div className="mt-2 text-[11px] opacity-50 break-all" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {error.slice(0, 220)}
              </div>
            )}
            <button
              onClick={handleGenerate}
              className="mt-3 h-8 px-4 rounded-full text-xs font-semibold cursor-pointer border-0"
              style={{ background: 'rgba(248,81,73,0.18)', color: '#F97979' }}
            >
              {ts('Retry')}
            </button>
          </div>
        </div>
      )}

      {/* Output */}
      {status === 'done' && result && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: result.color }} />
              <span className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-semibold">
                {result.type === 'flashcards' ? ts('{count} Flashcards', { count: result.flashcards?.length ?? 0 })
                  : result.type === 'notes' ? ts('{count} Sections', { count: result.notes?.sections.length ?? 0 })
                  : ts('{count} Questions', { count: result.quiz?.length ?? 0 })}
              </span>
              <span className="text-md-outline text-[10px]">·</span>
              <span className="text-md-on-surface-variant text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                {result.topic}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={handleSaveToSubject}
                disabled={!selectedSubjectId || saveState === 'saving'}
                title={!selectedSubjectId ? ts('Pick a subject above to save to') : undefined}
                className="h-7 px-3 rounded-full text-xs font-semibold border cursor-pointer disabled:cursor-default disabled:opacity-40"
                style={{
                  backgroundColor: saveState === 'saved' ? 'rgba(46,160,67,0.15)' : accentColor + '18',
                  borderColor: saveState === 'saved' ? 'rgba(46,160,67,0.4)' : accentColor + '50',
                  color: saveState === 'saved' ? '#2EA043' : accentColor,
                }}
              >
                {saveState === 'saving' ? ts('Saving…')
                  : saveState === 'saved' ? ts('Saved ✓')
                  : saveState === 'error' ? ts('Save failed — retry')
                  : ts('Save to subject')}
              </button>
              <button
                onClick={() => { setResult(null); setStatus('idle'); setSaveState('idle'); }}
                className="bg-transparent border-none text-md-on-surface-variant text-xs cursor-pointer underline p-0 hover:text-md-on-surface"
              >
                {ts('Clear')}
              </button>
            </div>
          </div>

          {result.flashcards && <FlashcardViewer cards={result.flashcards} color={result.color} />}
          {result.notes && <NotesViewer notes={result.notes} />}
          {result.quiz && <QuizViewer questions={result.quiz} color={result.color} disableResultPersistence />}
        </div>
      )}

      {/* Idle hint */}
      {status === 'idle' && (
        <div className="bg-md-surface-container rounded-3xl p-8 border border-md-outline-variant text-center">
          <div className="flex justify-center mb-3 opacity-30">
            <SparkleIcon color="var(--color-md-on-surface-variant)" />
          </div>
          <div className="text-md-on-surface-variant text-sm">
            {ts('Enter a topic above to generate study materials')}
          </div>
        </div>
      )}
    </div>
  );
}

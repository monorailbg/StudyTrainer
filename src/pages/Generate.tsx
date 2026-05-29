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

// ── Helpers ───────────────────────────────────────────────────────────────

function friendlyError(raw: string): string {
  if (!raw) return 'Generation failed.';
  if (raw.includes('VITE_GEMINI_API_KEY') || raw.includes('not set'))
    return 'Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.';
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('limit: 0') || raw.toLowerCase().includes('quota'))
    return 'API quota exhausted. Your Gemini free-tier limit may be reached.';
  if (raw.includes('429'))
    return 'Rate limit reached. Wait 30 seconds and try again.';
  if (raw.includes('403') || raw.includes('API_KEY_INVALID') || raw.toLowerCase().includes('api key'))
    return 'Invalid API key. Check VITE_GEMINI_API_KEY in your .env file.';
  if (raw.includes('400'))
    return 'Bad request — topic too long or unsupported content.';
  return `Generation failed: ${raw.slice(0, 120)}`;
}

// ── Icons ──────────────────────────────────────────────────────────────────

const SparkleIcon = ({ color = '#d4a843' }: { color?: string }) => (
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

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Generate Page ─────────────────────────────────────────────────────────

export default function Generate() {
  useLang();

  // Form state
  const [topic, setTopic] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [level, setLevel] = useState<Level>('intermediate');
  const [contentType, setContentType] = useState<GenerationType>('flashcards');

  // Generation state
  const [status, setStatus] = useState<GenStatus>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const subject = ALL_SUBJECTS.find(s => s.id === selectedSubjectId);
  const accentColor = subject?.color ?? '#d4a843';
  const canGenerate = topic.trim().length >= 3;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStatus('generating');
    setError('');
    setResult(null);

    try {
      const output = await generateFromTopic(
        topic.trim(),
        contentType,
        subject?.title ?? '',
        level
      );

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
    { key: 'notes', label: 'Notes', count: '4-7 sections' },
    { key: 'quiz', label: 'Quiz', count: '10 questions' },
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '36px 24px 80px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '10px', color: '#d4a843', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
          AI Generator
        </div>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', color: '#f0f4f8', margin: '0 0 8px', lineHeight: 1.2 }}>
          Generate Study Materials
        </h1>
        <p style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: 1.55 }}>
          Type any topic and Claude will build flashcards, structured notes, or a quiz.
        </p>
      </div>

      {/* Config form */}
      <div style={{
        backgroundColor: '#0d1a2e',
        border: '1px solid #1e2d45',
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '28px',
      }}>

        {/* Topic input */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2d45' }}>
          <label style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
            Topic
          </label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Comparative advantage and the Heckscher-Ohlin model, Porter's Five Forces, SWOT analysis..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px', borderRadius: '8px',
              backgroundColor: '#162236', border: '1px solid #4a5568',
              color: '#f0f4f8', fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '14px', lineHeight: 1.55, resize: 'vertical',
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#d4a843')}
            onBlur={e => (e.target.style.borderColor = '#4a5568')}
          />
        </div>

        {/* Subject context */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
              Subject context
            </span>
            <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#2d4465' }}>
              optional — helps Claude focus the output
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ALL_SUBJECTS.map(s => {
              const isSelected = selectedSubjectId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubjectId(isSelected ? '' : s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    height: '30px', padding: '0 12px', borderRadius: '5px',
                    backgroundColor: isSelected ? s.color + '18' : '#162236',
                    border: `1px solid ${isSelected ? s.color + '50' : '#1e2d45'}`,
                    color: isSelected ? s.color : '#4a5a6e',
                    cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                    fontSize: '12px', fontWeight: isSelected ? 600 : 400,
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: s.color, flexShrink: 0 }} />
                  {s.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Level + Type + Generate — bottom row */}
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>

          {/* Level */}
          <div>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
              Level
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {levels.map(l => (
                <button
                  key={l.key}
                  onClick={() => setLevel(l.key)}
                  style={{
                    height: '34px', padding: '0 14px', borderRadius: '7px',
                    backgroundColor: level === l.key ? '#162236' : 'transparent',
                    border: `1px solid ${level === l.key ? '#2d4465' : '#1e2d45'}`,
                    color: level === l.key ? '#f0f4f8' : '#4a5a6e',
                    cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                    fontSize: '12px', fontWeight: level === l.key ? 600 : 400,
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '48px', backgroundColor: '#1e2d45', flexShrink: 0 }} />

          {/* Content type */}
          <div>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
              Generate
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {types.map(tp => {
                const isSelected = contentType === tp.key;
                return (
                  <button
                    key={tp.key}
                    onClick={() => setContentType(tp.key)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      height: '48px', padding: '0 16px', borderRadius: '7px',
                      backgroundColor: isSelected ? accentColor + '14' : 'transparent',
                      border: `1px solid ${isSelected ? accentColor + '45' : '#1e2d45'}`,
                      color: isSelected ? accentColor : '#4a5a6e',
                      cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                      fontSize: '12px', fontWeight: isSelected ? 600 : 400,
                      transition: 'all 0.15s', gap: '2px', justifyContent: 'center',
                    }}
                  >
                    <span>{tp.label}</span>
                    <span style={{ fontSize: '10px', color: isSelected ? accentColor + 'bb' : '#2d4465', fontWeight: 400 }}>
                      {tp.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || status === 'generating'}
              style={{
                height: '48px', padding: '0 28px', borderRadius: '8px',
                backgroundColor: canGenerate && status !== 'generating' ? accentColor : '#162236',
                border: canGenerate && status !== 'generating' ? 'none' : '1px solid #1e2d45',
                color: canGenerate && status !== 'generating' ? '#07111f' : '#2d4465',
                cursor: canGenerate && status !== 'generating' ? 'pointer' : 'default',
                fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}
            >
              {status === 'generating' ? (
                <>
                  <Spinner color={accentColor} />
                  Generating...
                </>
              ) : (
                <>
                  <SparkleIcon color={canGenerate ? '#07111f' : '#2d4465'} />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div style={{
          backgroundColor: '#f8717110', border: '1px solid #f8717130',
          borderRadius: '10px', padding: '14px 18px',
          fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#f87171',
          marginBottom: '24px',
        }}>
          {friendlyError(error)}
        </div>
      )}

      {/* Output */}
      {status === 'done' && result && (
        <div>
          {/* Output header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: result.color }} />
              <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                {result.type === 'flashcards' ? `${result.flashcards?.length} Flashcards` : result.type === 'notes' ? `${result.notes?.sections.length} Sections` : `${result.quiz?.length} Questions`}
              </span>
              <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#1e2d45' }}>·</span>
              <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#4a5a6e', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {result.topic}
              </span>
            </div>
            <button
              onClick={() => { setResult(null); setStatus('idle'); }}
              style={{
                background: 'none', border: 'none', color: '#4a5a6e',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px',
                textDecoration: 'underline', padding: 0,
              }}
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
        <div style={{
          backgroundColor: '#0d1a2e', border: '1px solid #1e2d45',
          borderRadius: '12px', padding: '32px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <SparkleIcon color="#2d4465" />
          </div>
          <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#2d4465' }}>
            Enter a topic above to generate study materials
          </div>
        </div>
      )}
    </div>
  );
}

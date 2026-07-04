import { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../context/LanguageContext';
import type { GeneratedQuizQuestion } from '../lib/generator';
import { saveQuizResult, type QuizResult, type QuizResultQuestion } from '../lib/db';
import { QuizAskAI } from './QuizAskAI';
import { useToast } from './Toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Dynamically maps an option index to its letter (0→A, 1→B, ..., safely
// handling any number of options, e.g. index 5 → F) instead of a fixed list.
const letterFor = (index: number): string => String.fromCharCode(65 + index);
const indexForLetter = (letter: string): number => letter.charCodeAt(0) - 65;

// Per-question edit draft — sits on top of AI-generated data
export interface EditDraft {
  question: string;
  options: string[];
  correct: number;
}

export type QuizMode = 'focused' | 'test' | 'practice';

const LAST_MODE_KEY = 'gbs-last-quiz-mode';

function loadLastMode(): QuizMode {
  try {
    const v = localStorage.getItem(LAST_MODE_KEY);
    if (v === 'focused' || v === 'test' || v === 'practice') return v;
  } catch { /* ignore */ }
  return 'focused';
}

function saveLastMode(mode: QuizMode) {
  try { localStorage.setItem(LAST_MODE_KEY, mode); } catch { /* ignore */ }
}

// Muted, non-distracting reminder shown during and after a practice session.
function PracticeBanner({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-2)' }}>
      <svg viewBox="0 0 14 14" width="12" height="12" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="7" cy="7" r="5.5" stroke="var(--text-2)" strokeWidth="1.2" />
      </svg>
      <span style={{ fontSize: '12px', lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

function useCountUp(target: number, active: boolean, duration = 900) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) { setVal(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setVal(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, active, duration]);

  return val;
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}


function shuffleOptions(q: GeneratedQuizQuestion): GeneratedQuizQuestion {
  const indices = q.options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const newOptions = indices.map(i => q.options[i]);
  // q.correct can come back as a string index from the generator — the rest
  // of this file defensively coerces with Number() before comparing; indexOf
  // does strict equality, so a bare string here always misses and returns -1.
  const newCorrect = indices.indexOf(Number(q.correct));
  return { ...q, options: newOptions, correct: newCorrect };
}

async function persistResult(result: QuizResult) {
  try {
    await saveQuizResult(result);
  } catch { /* best-effort */ }
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, color, onChange, label }: { on: boolean; color: string; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
      <button
        role="switch" aria-checked={on} onClick={onChange}
        style={{
          width: '40px', height: '22px', borderRadius: '999px', flexShrink: 0,
          background: on ? color : 'var(--border-base)',
          border: `1px solid ${on ? color + '80' : 'var(--border-base)'}`,
          cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: '2px', left: on ? '20px' : '2px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: on ? '#fff' : 'var(--text-3)',
          transition: 'left 0.2s, background 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </button>
      <span style={{ fontSize: '13px', color: on ? 'var(--text-1)' : 'var(--text-2)', transition: 'color 0.2s' }}>
        {label}
      </span>
    </label>
  );
}

// ── Setup screen ───────────────────────────────────────────────────────────────

function SetupScreen({ questions, color, onStart, initialMode, onQuestionSaved, onQuestionDeleted }: {
  questions: GeneratedQuizQuestion[];
  color: string;
  onStart: (count: number, shuffle: boolean, mode: QuizMode, overrides: Record<string, EditDraft>) => void;
  initialMode?: QuizMode;
  onQuestionSaved?: (qid: string, draft: EditDraft) => void;
  onQuestionDeleted?: (qid: string) => void;
}) {
  const total = questions.length;
  const { ts } = useLang();
  const rawOptions = [5, 10, 15, 20].filter(n => n < total);
  const countOptions = [...rawOptions, total];
  const defaultCount = countOptions.find(n => n >= Math.min(10, total)) ?? total;
  const [testCount, setTestCount] = useState(defaultCount);
  const [shuffle, setShuffle] = useState(true);
  const [mode, setMode] = useState<QuizMode>(initialMode ?? loadLastMode());
  const [showList, setShowList]         = useState(false);
  const [listEditId, setListEditId]     = useState<string | null>(null);
  const [listEditDraft, setListEditDraft] = useState<EditDraft | null>(null);
  const [listOverrides, setListOverrides] = useState<Record<string, EditDraft>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function requestDelete(qid: string) {
    if (total <= 1) return; // a quiz needs at least one question
    if (confirmDeleteId === qid) {
      onQuestionDeleted?.(qid);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(qid);
    }
  }

  function startListEdit(q: GeneratedQuizQuestion) {
    const ov = listOverrides[q.id];
    const dq = ov ? { ...q, ...ov } : q;
    setListEditDraft({ question: dq.question, options: [...dq.options], correct: dq.correct });
    setListEditId(q.id);
  }
  function cancelListEdit() { setListEditId(null); setListEditDraft(null); }
  function saveListEdit(qid: string) {
    if (!listEditDraft) return;
    onQuestionSaved?.(qid, listEditDraft);
    setListOverrides(prev => ({ ...prev, [qid]: listEditDraft }));
    setListEditId(null);
    setListEditDraft(null);
  }

  const MODES: { id: QuizMode; title: string; desc: string }[] = [
    { id: 'focused',  title: 'Focused',  desc: 'One question at a time' },
    { id: 'test',     title: 'Test',     desc: 'All questions, submit at end' },
    { id: 'practice', title: 'Practice', desc: 'No pressure — results not saved' },
  ];

  return (
    <>
    <div style={{
      minHeight: 'min(640px, calc(100vh - 220px))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: '560px', margin: '0 auto',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '32px',
      }}>
        {/* Hero count */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
            {ts('Ready to study')}
          </div>
          <div className="mono" style={{ fontSize: 'clamp(56px, 12vw, 72px)', fontWeight: 800, lineHeight: 1, color, letterSpacing: '-0.02em' }}>
            {total}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '6px' }}>{ts('questions available')}</div>
          <button
            onClick={() => setShowList(true)}
            style={{
              marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, color: 'var(--text-3)',
              letterSpacing: '0.04em', textDecoration: 'underline', textUnderlineOffset: '2px',
            }}
          >
            {ts('View all questions')} →
          </button>
        </div>

        {/* Mode selector */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px', textAlign: 'center' }}>{ts('Mode')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', width: '100%' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                position: 'relative',
                padding: '12px 14px', borderRadius: '12px',
                border: `1px solid ${mode === m.id ? color + '55' : 'var(--border-light)'}`,
                background: mode === m.id ? color + '12' : 'var(--bg-surface)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
                {m.id === 'practice' && (
                  <span style={{
                    position: 'absolute', top: '8px', right: '8px',
                    padding: '2px 6px', borderRadius: '999px',
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em',
                    background: 'var(--bg-elevated)', color: 'var(--text-2)', border: '1px solid var(--border-base)',
                  }}>
                    {ts('No save')}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                  {m.id === 'practice' && (
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="6" cy="6" r="4.5" stroke={mode === m.id ? color : 'var(--text-2)'} strokeWidth="1.1" />
                    </svg>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: mode === m.id ? color : 'var(--text-2)' }}>
                    {ts(m.title)}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.4 }}>
                  {ts(m.desc)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Question count */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px', textAlign: 'center' }}>{ts('Questions')}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {countOptions.map(n => (
              <button key={n} onClick={() => setTestCount(n)} className="quiz-count-btn" style={{
                height: '36px', padding: '0 16px', borderRadius: '999px',
                background: testCount === n ? color + '18' : 'var(--bg-surface)',
                color: testCount === n ? color : 'var(--text-2)',
                border: `1px solid ${testCount === n ? color + '55' : 'var(--border-light)'}`,
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {n === total ? ts('All {n}', { n }) : n}
              </button>
            ))}
          </div>
        </div>

        {/* Shuffle */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
          <Toggle on={shuffle} color={color} onChange={() => setShuffle(s => !s)} label={ts('Shuffle questions')} />
        </div>

        {/* Begin — disabled with zero questions, otherwise Begin works and
            then crashes on the first question (undefined) with a NaN score. */}
        <button
          onClick={() => { if (total === 0) return; saveLastMode(mode); onStart(testCount, shuffle, mode, listOverrides); }}
          disabled={total === 0}
          style={{
            display: 'block', margin: '0 auto', minWidth: '200px',
            height: '46px', padding: '0 40px', borderRadius: '999px',
            background: total === 0 ? 'var(--bg-elevated)' : color,
            color: total === 0 ? 'var(--text-3)' : '#fff',
            border: total === 0 ? '1px solid var(--border-base)' : 'none',
            fontSize: '14px', fontWeight: 700, letterSpacing: '0.02em',
            cursor: total === 0 ? 'not-allowed' : 'pointer',
            boxShadow: total === 0 ? 'none' : `0 4px 24px ${color}40, 0 1px 0 rgba(255,255,255,0.12) inset`,
            transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onMouseEnter={e => { if (total > 0) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.02)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        >
          {total === 0 ? ts('No questions available') : `${ts('Begin')} →`}
        </button>
      </div>
    </div>

        {/* Full-screen question list overlay */}
        {showList && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'var(--bg-page)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Sticky header */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-page)',
              borderBottom: '1px solid var(--border-light)',
              padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                  {ts('All Questions')}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', marginTop: '2px' }}>
                  {total} {ts('questions')}
                </div>
              </div>
              <button
                onClick={() => { setShowList(false); cancelListEdit(); }}
                style={{
                  height: '34px', padding: '0 16px', borderRadius: '999px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
                  color: 'var(--text-2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                ← {ts('Back to setup')}
              </button>
            </div>

            {/* Question list */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
              {questions.map((q, qi) => {
                const ov = listOverrides[q.id];
                const dq = ov ? { ...q, question: ov.question, options: ov.options, correct: ov.correct } : q;
                const isEditing = listEditId === q.id;

                return (
                  <div key={q.id} style={{
                    background: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden',
                    border: '1px solid var(--border-light)',
                  }}>
                    {isEditing && listEditDraft ? (
                      <InlineEditForm
                        draft={listEditDraft}
                        color={color}
                        onChange={setListEditDraft}
                        onSave={() => saveListEdit(q.id)}
                        onCancel={cancelListEdit}
                      />
                    ) : (
                      <div style={{ padding: '16px 18px' }}>
                        {/* Question row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                          <span className="mono" style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 700, flexShrink: 0, marginTop: '3px' }}>
                            {String(qi + 1).padStart(2, '0')}
                          </span>
                          <div style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                            {dq.question}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {ov && (
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, display: 'inline-block' }} title={ts('Edited')} />
                            )}
                            <button
                              onClick={() => startListEdit(q)}
                              title={ts('Edit this question')}
                              style={{
                                width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
                                color: 'var(--text-3)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; }}
                            >
                              <svg viewBox="0 0 14 14" width="12" height="12" fill="none">
                                <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            {onQuestionDeleted && (
                              <button
                                onClick={() => requestDelete(q.id)}
                                onBlur={() => setConfirmDeleteId(prev => prev === q.id ? null : prev)}
                                disabled={total <= 1}
                                title={total <= 1 ? ts('A quiz needs at least one question') : (confirmDeleteId === q.id ? ts('Click again to confirm delete') : ts('Delete this question'))}
                                style={{
                                  width: confirmDeleteId === q.id ? 'auto' : '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                                  padding: confirmDeleteId === q.id ? '0 10px' : 0,
                                  background: confirmDeleteId === q.id ? 'rgba(248,81,73,0.15)' : 'var(--bg-elevated)',
                                  border: `1px solid ${confirmDeleteId === q.id ? 'rgba(248,81,73,0.5)' : 'var(--border-light)'}`,
                                  color: confirmDeleteId === q.id ? '#F97979' : 'var(--text-3)',
                                  cursor: total <= 1 ? 'not-allowed' : 'pointer',
                                  opacity: total <= 1 ? 0.4 : 1,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                  fontSize: '10px', fontWeight: 700,
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { if (confirmDeleteId !== q.id && total > 1) { (e.currentTarget as HTMLElement).style.color = '#F97979'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,81,73,0.4)'; } }}
                                onMouseLeave={e => { if (confirmDeleteId !== q.id && total > 1) { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; } }}
                              >
                                <svg viewBox="0 0 14 14" width="12" height="12" fill="none" style={{ flexShrink: 0 }}>
                                  <path d="M3 4h8M5.5 4V2.8a.8.8 0 0 1 .8-.8h1.4a.8.8 0 0 1 .8.8V4M4 4l.5 7.2a1 1 0 0 0 1 .8h3a1 1 0 0 0 1-.8L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {confirmDeleteId === q.id && ts('Confirm')}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '24px' }}>
                          {dq.options.map((opt, oi) => {
                            const isCorrect = oi === Number(dq.correct);
                            return (
                              <div key={oi} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 10px', borderRadius: '8px',
                                background: isCorrect ? 'rgba(72,199,142,0.08)' : 'var(--bg-elevated)',
                                border: `1px solid ${isCorrect ? 'rgba(72,199,142,0.3)' : 'var(--border-light)'}`,
                              }}>
                                <span style={{
                                  width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                                  background: isCorrect ? 'rgba(72,199,142,0.2)' : 'transparent',
                                  border: `1px solid ${isCorrect ? 'rgba(72,199,142,0.5)' : 'var(--border-base)'}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '10px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                                  color: isCorrect ? 'rgb(72,199,142)' : 'var(--text-3)',
                                }}>
                                  {isCorrect
                                    ? <svg viewBox="0 0 10 10" width="9" height="9" fill="none"><path d="M2 5l2 2 4-4" stroke="rgb(72,199,142)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    : letterFor(oi)}
                                </span>
                                <span style={{ fontSize: '12px', color: isCorrect ? 'rgb(72,199,142)' : 'var(--text-2)', lineHeight: 1.4 }}>{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </>
  );
}

// ── Inline question editor ─────────────────────────────────────────────────────

function InlineEditForm({
  draft, color, onChange, onSave, onCancel,
}: {
  draft: EditDraft;
  color: string;
  onChange: (d: EditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { ts } = useLang();

  function setOption(i: number, v: string) {
    const opts = [...draft.options];
    opts[i] = v;
    onChange({ ...draft, options: opts });
  }

  const fieldBase: React.CSSProperties = {
    width: '100%', background: 'var(--bg-surface)', color: 'var(--text-1)',
    border: '1px solid var(--border-light)', borderRadius: '10px',
    padding: '9px 13px', fontSize: '14px',
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: 'none', lineHeight: 1.5, boxSizing: 'border-box',
  };

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-3)', padding: '4px', borderRadius: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
      style={{ padding: 'clamp(14px, 3vw, 22px)', background: 'var(--bg-surface)' }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" stroke="var(--text-2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-2)' }}>
            {ts('Edit Question')}
          </span>
        </div>
        <button onClick={onCancel} style={iconBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
        >
          <svg viewBox="0 0 14 14" width="13" height="13" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Question textarea */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: '8px' }}>
          {ts('Question')}
        </div>
        <textarea
          value={draft.question}
          onChange={e => onChange({ ...draft, question: e.target.value })}
          rows={3}
          style={{ ...fieldBase, resize: 'none' as const }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
        />
      </div>

      {/* Answer options */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-3)' }}>
            {ts('Answers')}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-3)', opacity: 0.7 }}>
            {ts('— tap letter to mark correct')}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {draft.options.map((opt, i) => {
            const isCorrect = draft.correct === i;
            const tint = LETTER_TINTS[i % LETTER_TINTS.length];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Clickable badge — tap to mark as correct answer */}
                <button
                  onClick={() => onChange({ ...draft, correct: i })}
                  title={ts('Mark as correct answer')}
                  style={{
                    width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                    background: isCorrect ? tint.bg : 'var(--bg-elevated)',
                    border: `1.5px solid ${isCorrect ? tint.border : 'var(--border-base)'}`,
                    color: isCorrect ? tint.text : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { if (!isCorrect) (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-3)'; }}
                  onMouseLeave={e => { if (!isCorrect) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                >
                  {isCorrect
                    ? <svg viewBox="0 0 12 12" width="13" height="13" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke={tint.text} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : letterFor(i)}
                </button>
                {/* Option text input */}
                <input
                  type="text"
                  value={opt}
                  onChange={e => setOption(i, e.target.value)}
                  style={{ ...fieldBase, flex: 1, padding: '8px 13px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Save / Cancel */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={onCancel}
          style={{
            height: '34px', padding: '0 16px', borderRadius: '999px',
            background: 'transparent', border: '1px solid var(--border-base)',
            color: 'var(--text-2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {ts('Cancel')}
        </button>
        <button
          onClick={onSave}
          style={{
            height: '34px', padding: '0 20px', borderRadius: '999px',
            background: color, border: 'none',
            color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 2px 10px ${color}38`,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          ✓ {ts('Save Edit')}
        </button>
      </div>
    </div>
  );
}

// ── Option button ─────────────────────────────────────────────────────────────

// Per-letter accent tints — gives each option a unique, scannable identity.
// Cycles via modulo so any number of options (5, 6, ...) still gets a tint.
const LETTER_TINTS = [
  { bg: 'rgba(99,179,237,0.15)',  border: 'rgba(99,179,237,0.4)',  text: 'rgb(99,179,237)'  }, // A blue
  { bg: 'rgba(154,117,234,0.15)', border: 'rgba(154,117,234,0.4)', text: 'rgb(154,117,234)' }, // B purple
  { bg: 'rgba(72,199,142,0.15)',  border: 'rgba(72,199,142,0.4)',  text: 'rgb(72,199,142)'  }, // C green
  { bg: 'rgba(246,173,85,0.15)',  border: 'rgba(246,173,85,0.4)',  text: 'rgb(246,173,85)'  }, // D amber
  { bg: 'rgba(236,116,169,0.15)', border: 'rgba(236,116,169,0.4)', text: 'rgb(236,116,169)' }, // E pink
];

function OptionBtn({
  letter, text, state, disabled, onClick, color, compact = false,
}: {
  letter: string; text: string;
  state: 'idle' | 'chosen' | 'right' | 'wrong';
  disabled: boolean; onClick: () => void; color: string; compact?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [pulse, setPulse] = useState(false);

  const tint = LETTER_TINTS[Math.max(0, indexForLetter(letter)) % LETTER_TINTS.length];

  // Card surface + text per state.
  const card = {
    idle:   { bg: 'var(--bg-elevated)', border: 'var(--border-base)', text: 'var(--text-1)'            },
    chosen: { bg: 'var(--bg-elevated)', border: 'var(--text-2)',      text: 'var(--text-1)'             },
    right:  { bg: 'rgba(72,199,142,0.15)',  border: 'rgba(72,199,142,0.70)',  text: 'rgb(72,199,142)'  },
    wrong:  { bg: 'rgba(252,100,100,0.12)', border: 'rgba(252,100,100,0.60)', text: 'rgba(252,100,100,0.90)' },
  }[state];

  // Badge follows letter tint at rest, switches to state colour once revealed/selected.
  const badge =
    state === 'right'  ? { bg: 'rgba(72,199,142,0.22)',  border: 'rgba(72,199,142,0.7)',  text: 'rgb(72,199,142)' }
    : state === 'wrong'  ? { bg: 'rgba(252,100,100,0.2)',  border: 'rgba(252,100,100,0.6)', text: 'rgb(252,100,100)' }
    : state === 'chosen' ? { bg: `${color}33`,             border: color,                   text: color }
    : tint;

  const hovering = hover && !disabled && state === 'idle';
  const cardBg = hovering ? 'var(--bg-surface)' : card.bg;
  const cardBorder = hovering ? 'var(--border-base)' : card.border;

  function handleClick() {
    // A click fires on mouseup even when the mousedown→mouseup was a
    // text-selection drag (e.g. selecting a word to define) rather than a
    // tap — without this guard, selecting text inside an option would also
    // silently lock in that option as the chosen answer.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
    if (!disabled) {
      setPulse(true);
      setTimeout(() => setPulse(false), 200);
    }
    onClick();
  }

  const badgeSize = compact ? 26 : 32;

  return (
    <button
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`${pulse ? 'anim-option-pulse ' : ''}${state === 'right' ? 'anim-correct' : state === 'wrong' ? 'anim-shake' : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: compact ? '12px 14px' : '16px 20px',
        minHeight: compact ? '48px' : '56px',
        borderRadius: '12px',
        border: `1px solid ${cardBorder}`, background: cardBg,
        cursor: disabled ? 'default' : 'pointer', textAlign: 'left', width: '100%',
        transform: hovering && !pulse ? 'translateX(4px)' : 'translateX(0)',
        transition: 'background 180ms ease, border-color 180ms ease, transform 180ms ease',
      }}
    >
      <span style={{
        width: `${badgeSize}px`, height: `${badgeSize}px`,
        borderRadius: '8px', flexShrink: 0,
        background: badge.bg, color: badge.text,
        border: `1px solid ${badge.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
        transition: 'all 0.15s',
      }}>
        {state === 'right' ? (
          <svg viewBox="0 0 12 12" width="13" height="13" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke={badge.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : letter}
      </span>
      <span style={{
        fontSize: compact ? '14px' : '16px', color: card.text,
        lineHeight: 1.5, letterSpacing: '0.01em',
        fontWeight: state === 'idle' ? 500 : 600,
        // Native <button> text is non-selectable by default in every major
        // browser (the UA stylesheet's "appearance" special-case forces
        // user-select:none even though computed style reports "auto") — force
        // it back on so answer text can be selected for the Define toolbar.
        userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
      }}>
        {text}
      </span>
    </button>
  );
}

// ── Explanation panel ─────────────────────────────────────────────────────────

function Explanation({ correct, text }: { correct: boolean; text: string }) {
  const { ts } = useLang();
  return (
    <div className="anim-fadein" style={{
      padding: '14px 16px', borderRadius: '12px',
      background: correct ? 'rgba(46,160,67,0.07)' : 'rgba(248,81,73,0.07)',
      border: `1px solid ${correct ? 'rgba(46,160,67,0.2)' : 'rgba(248,81,73,0.2)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{
          width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
          background: correct ? 'rgba(46,160,67,0.25)' : 'rgba(248,81,73,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {correct
            ? <svg viewBox="0 0 10 10" width="9" height="9" fill="none"><path d="M2 5l2 2 4-4" stroke="#56D364" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            : <svg viewBox="0 0 10 10" width="9" height="9" fill="none"><path d="M3 3l4 4M7 3l-4 4" stroke="#F97979" strokeWidth="1.5" strokeLinecap="round" /></svg>}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: correct ? '#56D364' : '#F97979', letterSpacing: '0.05em' }}>
          {correct ? ts('CORRECT') : ts('INCORRECT')}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
}

// ── Define selection (dictionary lookup for question/answer text) ─────────────

interface DefSelRect { left: number; top: number; bottom: number; width: number }

function DefineToolbar({ rect, onDefine, onDefineJapanese, onDismiss }: {
  rect: DefSelRect;
  onDefine?: () => void;
  onDefineJapanese?: () => void;
  onDismiss: () => void;
}) {
  const { ts } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Same measure-then-position approach as NotesViewer's AnnotationToolbar:
  // render invisibly first so we can read its real size, then place it
  // centered over the selection (flipping below if too close to the top).
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const tw = el.offsetWidth;
      const th = el.offsetHeight;
      if (!tw && !th) { requestAnimationFrame(measure); return; }
      const m = 8;
      let left = rect.left + rect.width / 2 - tw / 2;
      left = Math.max(m, Math.min(left, window.innerWidth - tw - m));
      let top = rect.top - th - 10;
      if (top < m) top = rect.bottom + 10;
      setPos({ left, top });
    };
    measure();
  }, [rect]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onDismiss, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onDismiss, true);
    };
  }, [onDismiss]);

  return createPortal(
    <div
      ref={ref}
      onMouseDown={e => e.preventDefault()}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos ? pos.left : rect.left,
        top: pos ? pos.top : rect.top - 50,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: '2px', padding: '5px 7px',
        background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
        borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        userSelect: 'none',
      }}
    >
      {onDefine && (
        <button
          onClick={onDefine}
          title={ts('Add to dictionary')}
          style={{
            height: '28px', padding: '0 9px', borderRadius: '7px',
            background: 'rgba(61,126,255,0.15)', border: '1px solid rgba(61,126,255,0.3)',
            cursor: 'pointer', color: '#3D7EFF', fontSize: '11px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '5px',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          <svg viewBox="0 0 14 14" width="11" height="11" fill="none">
            <path d="M2 2A1 1 0 013 1h8a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          {ts('Define')}
        </button>
      )}
      {onDefineJapanese && (
        <button
          onClick={onDefineJapanese}
          title="翻訳 (Japanese definition)"
          style={{
            height: '28px', padding: '0 9px', borderRadius: '7px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-base)',
            cursor: 'pointer', color: 'var(--text-2)', fontSize: '11px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '5px',
            flexShrink: 0, whiteSpace: 'nowrap', letterSpacing: '0.02em',
          }}
        >
          <span style={{ fontSize: '13px', lineHeight: 1, fontWeight: 400, opacity: 0.9 }}>あ</span>
          翻訳
        </button>
      )}
    </div>,
    document.body
  );
}

// Wraps question/answer text so selecting a word or phrase inside it shows a
// small "Define"/"翻訳" toolbar — same lookup used in Notes. A no-op wrapper
// (renders children directly) when neither callback is provided.
function DefinableArea({ onDefine, onDefineJapanese, children }: {
  onDefine?: (term: string) => void;
  onDefineJapanese?: (term: string) => void;
  children: React.ReactNode;
}) {
  const [toolbar, setToolbar] = useState<{ rect: DefSelRect; text: string } | null>(null);

  const handleSelectionEnd = useCallback(() => {
    // rAF: Safari finalizes window.getSelection() asynchronously relative to mouseup.
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const text = sel.toString().trim();
      if (text.length < 2) return;
      const range = sel.getRangeAt(0);
      let r = range.getBoundingClientRect();
      if (!r.width && !r.height) {
        const rects = range.getClientRects();
        if (rects.length) r = rects[rects.length - 1];
      }
      if (!r.width && !r.height) return;
      setToolbar({ rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width }, text });
    });
  }, []);

  const dismiss = useCallback(() => setToolbar(null), []);

  if (!onDefine && !onDefineJapanese) return <>{children}</>;

  return (
    // A <span> (not <div>) so this is valid to nest inside inline contexts
    // like the question <p> in TestMode — display:contents makes it
    // transparent to layout either way.
    <span style={{ display: 'contents' }} onMouseUp={handleSelectionEnd} onTouchEnd={handleSelectionEnd}>
      {children}
      {toolbar && (
        <DefineToolbar
          rect={toolbar.rect}
          onDefine={onDefine ? () => { onDefine(toolbar.text); window.getSelection()?.removeAllRanges(); dismiss(); } : undefined}
          onDefineJapanese={onDefineJapanese ? () => { onDefineJapanese(toolbar.text); window.getSelection()?.removeAllRanges(); dismiss(); } : undefined}
          onDismiss={dismiss}
        />
      )}
    </span>
  );
}

// ── Focused mode ───────────────────────────────────────────────────────────────

function FocusedMode({
  questions, color, isRedoMode = false, isPractice = false,
  onDone, onQuestionSaved, onDefine, onDefineJapanese,
}: {
  questions: GeneratedQuizQuestion[];
  color: string;
  isRedoMode?: boolean;
  isPractice?: boolean;
  onDone: (answers: Record<string, number>, timeSec: number) => void;
  onQuestionSaved?: (qid: string, draft: EditDraft) => void;
  onDefine?: (term: string) => void;
  onDefineJapanese?: (term: string) => void;
}) {
  const { ts } = useLang();
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answeredList, setAnsweredList] = useState<{ qi: number; chosen: number }[]>([]);
  const [animKey, setAnimKey] = useState(0);
  const startTime = useRef(Date.now());

  // Inline edit state
  const [overrides, setOverrides] = useState<Record<string, EditDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const q = questions[idx];
  const ov = overrides[q.id];
  // Rendering always uses the overridden version if present
  const currentQ = ov
    ? { ...q, question: ov.question, options: ov.options, correct: ov.correct }
    : q;

  const correct = Number(currentQ.correct);
  const isCorrect = chosen === correct;
  const total = questions.length;
  const progress = (idx / total) * 100;
  const isEditing = editingId === q.id;

  // Correct count also respects overrides
  const doneCount = answeredList.filter(a => {
    const aq = questions[a.qi];
    const aCorrect = overrides[aq.id]?.correct ?? Number(aq.correct);
    return a.chosen === aCorrect;
  }).length;

  function pick(oi: number) {
    if (revealed || isEditing) return;
    setChosen(oi);
    setRevealed(true);
  }

  function next() {
    const updated = [...answeredList, { qi: idx, chosen: chosen! }];
    setAnsweredList(updated);
    if (idx + 1 >= total) {
      const answerMap: Record<string, number> = {};
      updated.forEach(({ qi, chosen }) => { answerMap[questions[qi].id] = chosen; });
      onDone(answerMap, Math.floor((Date.now() - startTime.current) / 1000));
    } else {
      setAnimKey(k => k + 1);
      setIdx(i => i + 1);
      setChosen(null);
      setRevealed(false);
    }
  }

  function startEdit() {
    setEditDraft({
      question: currentQ.question,
      options: [...currentQ.options],
      correct: currentQ.correct,
    });
    setEditingId(q.id);
  }

  function cancelEdit() { setEditingId(null); setEditDraft(null); }

  function saveEdit() {
    if (!editDraft) return;
    setOverrides(prev => ({ ...prev, [q.id]: editDraft }));
    onQuestionSaved?.(q.id, editDraft);
    setEditingId(null);
    setEditDraft(null);
  }

  // Small pencil icon button — reused in header + TestMode
  const editBtnStyle: React.CSSProperties = {
    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
    color: 'var(--text-3)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 8px' }}>
      {isRedoMode && (
        <div className="anim-fadein" style={{
          padding: '8px 16px', borderRadius: '10px', marginBottom: '20px',
          background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#D29922" strokeWidth="1.2"/><path d="M7 4.5v3l1.5 1.5" stroke="#D29922" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#D29922' }}>
            {total !== 1 ? ts('Review mode — {total} missed questions', { total }) : ts('Review mode — {total} missed question', { total })}
          </span>
        </div>
      )}

      {/* Progress header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {ts('Question {n} of {total}', { n: idx + 1, total })}
          </span>
          {!isRedoMode && (
            <span className="mono" style={{ fontSize: '11px', color, fontWeight: 700 }}>
              {ts('{n} correct', { n: doneCount })}
            </span>
          )}
        </div>
        <div style={{ height: '3px', background: 'var(--border-base)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '999px', background: color,
            width: `${progress}%`, transition: 'width 0.4s cubic-bezier(0,0,0.2,1)',
            boxShadow: `0 0 8px ${color}80`,
          }} />
        </div>
        {isPractice && (
          <div style={{ marginTop: '12px' }}>
            <PracticeBanner text={ts("Practice mode — results won't be saved")} />
          </div>
        )}
      </div>

      {/* Card */}
      <div key={animKey} className="anim-fadein" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 2px 20px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset',
      }}>
        {/* Question section with pencil button */}
        <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px) clamp(12px, 2vw, 20px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.5, letterSpacing: '0.005em', whiteSpace: 'pre-wrap' }}>
              <DefinableArea onDefine={onDefine} onDefineJapanese={onDefineJapanese}>
                {currentQ.question}
              </DefinableArea>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* Edited indicator dot */}
              {ov && !isEditing && (
                <span title={ts('Edited')} style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: color, display: 'inline-block', marginTop: '4px',
                }} />
              )}
              {/* Pencil edit button — hidden once answer is revealed */}
              {!revealed && !isEditing && (
                <button
                  onClick={startEdit}
                  title={ts('Edit this question')}
                  style={editBtnStyle}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; }}
                >
                  <svg viewBox="0 0 14 14" width="13" height="13" fill="none">
                    <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border-light)', margin: '0 clamp(12px, 3vw, 28px)' }} />

        {/* Options panel OR inline edit form */}
        {isEditing && editDraft ? (
          <InlineEditForm
            draft={editDraft}
            color={color}
            onChange={setEditDraft}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
        ) : (
          <>
            <div style={{ padding: 'clamp(12px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <DefinableArea onDefine={onDefine} onDefineJapanese={onDefineJapanese}>
                {currentQ.options.map((opt, oi) => {
                  const state = !revealed
                    ? (chosen === oi ? 'chosen' : 'idle')
                    : (oi === correct ? 'right' : (chosen === oi ? 'wrong' : 'idle'));
                  return (
                    <OptionBtn key={oi} letter={letterFor(oi)} text={opt} state={state}
                      color={color} disabled={revealed} onClick={() => pick(oi)} />
                  );
                })}
              </DefinableArea>
            </div>

            {revealed && currentQ.explanation && (
              <div style={{ margin: '0 clamp(10px, 3vw, 20px) clamp(10px, 3vw, 20px)' }}>
                <Explanation correct={isCorrect} text={currentQ.explanation} />
              </div>
            )}
            {revealed && !currentQ.explanation && (
              <div className="anim-fadein" style={{ margin: '0 clamp(10px, 3vw, 20px) 12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: isCorrect ? '#56D364' : '#F97979' }}>
                  {isCorrect ? `✓ ${ts('Correct')}` : `✗ ${ts('Incorrect — correct: {answer}', { answer: currentQ.options[correct] })}`}
                </span>
              </div>
            )}

            {revealed && (
              <div className="anim-fadein" style={{ padding: '0 clamp(10px, 3vw, 20px) clamp(10px, 3vw, 20px)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <QuizAskAI
                  quizContext={{
                    question: currentQ.question,
                    options: currentQ.options,
                    selectedOption: currentQ.options[chosen!],
                    isCorrect,
                    baseExplanation: currentQ.explanation ?? '',
                  }}
                  color={color}
                />
                <button
                  onClick={next}
                  style={{
                    height: '38px', padding: '0 24px', borderRadius: '999px',
                    background: color, color: '#fff', border: 'none',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    boxShadow: `0 2px 12px ${color}40`, letterSpacing: '0.03em',
                    transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                >
                  {idx + 1 >= total ? ts('See Results') : `${ts('Next')} →`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Test mode ──────────────────────────────────────────────────────────────────

function TestMode({ questions, color, isPractice = false, onDone, onQuestionSaved, onDefine, onDefineJapanese }: {
  questions: GeneratedQuizQuestion[];
  color: string;
  isPractice?: boolean;
  onDone: (answers: Record<string, number>, timeSec: number) => void;
  onQuestionSaved?: (qid: string, draft: EditDraft) => void;
  onDefine?: (term: string) => void;
  onDefineJapanese?: (term: string) => void;
}) {
  const { ts } = useLang();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const startTime = useRef(Date.now());

  // Inline edit state
  const [overrides, setOverrides] = useState<Record<string, EditDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  // Options as they were when editing started, so saveEdit can tell whether
  // they actually changed instead of always clearing the user's answer.
  const editOriginalOptionsRef = useRef<string[]>([]);

  function effectiveQ(q: GeneratedQuizQuestion): GeneratedQuizQuestion {
    const ov = overrides[q.id];
    return ov ? { ...q, question: ov.question, options: ov.options, correct: ov.correct } : q;
  }

  function startEdit(q: GeneratedQuizQuestion) {
    const eq = effectiveQ(q);
    editOriginalOptionsRef.current = [...eq.options];
    setEditDraft({
      question: eq.question,
      options: [...eq.options],
      correct: eq.correct,
    });
    setEditingId(q.id);
  }

  function cancelEdit() { setEditingId(null); setEditDraft(null); }

  function saveEdit(qId: string) {
    if (!editDraft) return;
    setOverrides(prev => ({ ...prev, [qId]: editDraft }));
    onQuestionSaved?.(qId, editDraft);
    const original = editOriginalOptionsRef.current;
    const optionsChanged = original.length !== editDraft.options.length
      || original.some((opt, i) => opt !== editDraft.options[i]);
    if (optionsChanged) {
      // The previously chosen index may no longer correspond to the same
      // choice, so it can't be kept — but silently discarding it with no
      // feedback made "Check Answers" quietly refuse to enable.
      setAnswers(a => { const n = { ...a }; delete n[qId]; return n; });
      toast('info', ts('Answer cleared'), ts('This question\'s options changed, so your previous answer for it was cleared.'));
    }
    setEditingId(null);
    setEditDraft(null);
  }

  const answered = Object.keys(answers).length;

  function handleAnswer(qid: string, oi: number) {
    setAnswers(a => ({ ...a, [qid]: oi }));
  }

  function submit() {
    // onDone flips the parent to the results phase, unmounting TestMode
    // immediately — there's no in-place "submitted" view to show here.
    onDone(answers, Math.floor((Date.now() - startTime.current) / 1000));
  }

  const editBtnStyle: React.CSSProperties = {
    width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
    color: 'var(--text-3)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 8px' }}>
      {isPractice && (
        <div style={{ marginBottom: '16px' }}>
          <PracticeBanner text={ts("Practice mode — results won't be saved")} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {questions.map((q, qi) => {
          const eq = effectiveQ(q);
          const chosen = answers[q.id];
          const isEditing = editingId === q.id;
          const ov = overrides[q.id];

          return (
            <div key={q.id} style={{
              background: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden',
              border: '1px solid var(--border-light)',
            }}>
              {/* Question header with edit button */}
              <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <p style={{ flex: 1, margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--text-3)', marginRight: '10px', fontWeight: 700 }}>
                    {String(qi + 1).padStart(2, '0')}
                  </span>
                  <DefinableArea onDefine={onDefine} onDefineJapanese={onDefineJapanese}>
                    {eq.question}
                  </DefinableArea>
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  {ov && !isEditing && (
                    <span title={ts('Edited')} style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(q)}
                      title={ts('Edit this question')}
                      style={editBtnStyle}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; }}
                    >
                      <svg viewBox="0 0 14 14" width="12" height="12" fill="none">
                        <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Inline edit form OR options */}
              {isEditing && editDraft ? (
                <InlineEditForm
                  draft={editDraft}
                  color={color}
                  onChange={setEditDraft}
                  onSave={() => saveEdit(q.id)}
                  onCancel={cancelEdit}
                />
              ) : (
                <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <DefinableArea onDefine={onDefine} onDefineJapanese={onDefineJapanese}>
                    {eq.options.map((opt, oi) => (
                      <OptionBtn key={oi} letter={letterFor(oi)} text={opt}
                        state={chosen === oi ? 'chosen' : 'idle'}
                        color={color} disabled={false} onClick={() => handleAnswer(q.id, oi)}
                        compact />
                    ))}
                  </DefinableArea>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {answered > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={submit}
            disabled={answered < questions.length}
            style={{
              height: '42px', padding: '0 28px', borderRadius: '999px',
              background: answered === questions.length ? color : 'var(--bg-elevated)',
              color: answered === questions.length ? '#fff' : 'var(--text-2)',
              border: 'none', fontSize: '13px', fontWeight: 700,
              cursor: answered < questions.length ? 'not-allowed' : 'pointer',
              opacity: answered < questions.length ? 0.55 : 1,
              boxShadow: answered === questions.length ? `0 2px 16px ${color}40` : 'none',
              transition: 'all 0.15s',
            }}
          >
            {ts('Check Answers')}
          </button>
          {answered < questions.length && (
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{ts('{answered} / {total} answered', { answered, total: questions.length })}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#56D364', '#3D7EFF', '#D29922', '#93B8FF', '#F97979', '#FF8C42'];

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    left: `${(i / 28) * 95 + Math.random() * 5}%`,
    w: 4 + Math.random() * 6,
    h: 4 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: Math.random() > 0.5,
    dur: 1.4 + Math.random() * 0.9,
    delay: Math.random() * 0.6,
  })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left, top: '-12px',
          width: `${p.w}px`, height: `${p.h}px`,
          background: p.color, borderRadius: p.round ? '50%' : '2px',
          animation: `confetti-fall ${p.dur}s ${p.delay}s ease-in both`,
        }} />
      ))}
    </div>
  );
}

// ── Redo results screen ───────────────────────────────────────────────────────

function RedoResultsScreen({
  correct, total, color,
  onRedoAgain, onBack,
}: {
  correct: number; total: number; color: string;
  onRedoAgain: () => void; onBack: () => void;
}) {
  const { ts } = useLang();
  const perfect = correct === total;
  return (
    <div className="anim-fadein" style={{ maxWidth: '420px', margin: '0 auto', position: 'relative' }}>
      {perfect && <Confetti />}
      <div style={{
        padding: '28px', borderRadius: '20px',
        background: perfect ? 'rgba(46,160,67,0.07)' : `radial-gradient(120% 140% at 0% 0%, ${color}0E 0%, var(--bg-surface) 60%)`,
        border: `1px solid ${perfect ? 'rgba(46,160,67,0.3)' : color + '25'}`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
          {ts('Review complete')}
        </div>
        <div className="mono" style={{ fontSize: '2.8rem', fontWeight: 700, color: perfect ? '#56D364' : color, lineHeight: 1, marginBottom: '8px' }}>
          {correct} / {total}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: perfect ? '#56D364' : 'var(--text-1)', marginBottom: '16px' }}>
          {perfect ? ts('All correct! Great improvement.') : ts('{n} still incorrect', { n: total - correct })}
        </div>
        <div style={{ height: '5px', background: 'var(--border-base)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: perfect ? '#2EA043' : color,
            width: `${Math.round((correct / total) * 100)}%`,
            transition: 'width 1s cubic-bezier(0,0,0.2,1)',
            borderRadius: '999px',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!perfect && (
          <button onClick={onRedoAgain} style={{
            height: '38px', padding: '0 20px', borderRadius: '999px',
            background: 'rgba(210,153,34,0.15)', color: '#D29922',
            border: '1px solid rgba(210,153,34,0.4)',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}>
            {ts('Redo remaining')}
          </button>
        )}
        <button onClick={onBack} style={{
          height: '38px', padding: '0 20px', borderRadius: '999px',
          background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-light)',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}>
          {ts('Back to results')}
        </button>
      </div>
    </div>
  );
}

// ── Full results screen ───────────────────────────────────────────────────────

function ResultsScreen({
  result, color, isPractice = false,
  onRetry, onRedoWrong, onRetakeSetup, onStartRated, onExit,
  onDefine, onDefineJapanese,
}: {
  result: QuizResult; color: string;
  isPractice?: boolean;
  onRetry: () => void;
  onRedoWrong: () => void;
  onRetakeSetup: () => void;
  onStartRated?: () => void;
  onExit?: () => void;
  onDefine?: (term: string) => void;
  onDefineJapanese?: (term: string) => void;
}) {
  const { ts } = useLang();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const counted = useCountUp(result.scorePercent, true);

  const gradeColor = result.scorePercent >= 80 ? '#56D364' : result.scorePercent >= 60 ? '#D29922' : '#F97979';
  const grade = result.scorePercent >= 90 ? ts('Excellent') : result.scorePercent >= 75 ? ts('Good job') : result.scorePercent >= 60 ? ts('Decent') : ts('Keep studying');

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const displayQuestions = showAll ? result.questions : result.questions.slice(0, 8);

  return (
    <div className="anim-fadein" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {isPractice && (
        <div style={{ marginBottom: '16px' }}>
          <PracticeBanner text={ts('Practice session — this result has not been saved')} />
        </div>
      )}
      {/* Score header */}
      <div style={{
        padding: '28px', borderRadius: '20px', marginBottom: '16px',
        background: `radial-gradient(130% 150% at 0% 0%, ${color}0E 0%, var(--bg-surface) 60%)`,
        border: `1px solid ${color}25`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px' }}>
          {isPractice ? ts('Practice complete') : ts('Quiz complete')}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <div className="mono" style={{ fontSize: '3.6rem', fontWeight: 700, lineHeight: 1, color: gradeColor, letterSpacing: '-0.02em' }}>
              {result.correctAnswers} <span style={{ fontSize: '2rem', color: 'var(--text-3)' }}>/ {result.totalQuestions}</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: gradeColor, marginTop: '4px' }}>{counted}% · {grade}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{ts('Completed in')} <strong style={{ color: 'var(--text-1)' }}>{formatTime(result.timeTakenSeconds)}</strong></span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{formatDate(result.completedAt)}</span>
          </div>
        </div>

        {/* Bar */}
        <div style={{ display: 'flex', height: '6px', borderRadius: '999px', overflow: 'hidden', background: 'var(--border-base)', marginBottom: '16px' }}>
          <div style={{ width: `${result.scorePercent}%`, background: `linear-gradient(90deg, ${gradeColor}88, ${gradeColor})`, transition: 'width 1s cubic-bezier(0,0,0.2,1)', boxShadow: `0 0 8px ${gradeColor}60` }} />
          <div style={{ flex: 1, background: 'rgba(248,81,73,0.25)' }} />
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { icon: '✅', label: ts('Correct'), val: result.correctAnswers, c: '#56D364' },
            { icon: '❌', label: ts('Wrong'), val: result.incorrectAnswers, c: '#F97979' },
            { icon: '⏱', label: ts('Time'), val: formatTime(result.timeTakenSeconds), c: 'var(--text-2)' },
          ].map(p => (
            <div key={p.label} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '999px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-base)',
            }}>
              <span style={{ fontSize: '11px' }}>{p.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: p.c }}>{p.val}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {isPractice ? (
          <>
            <button onClick={onRetry} style={{
              height: '40px', padding: '0 20px', borderRadius: '999px',
              background: color + '18', color, border: `1px solid ${color}40`,
              fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}>
              {ts('Practice again')}
            </button>
            <button onClick={onStartRated ?? onRetakeSetup} style={{
              height: '40px', padding: '0 20px', borderRadius: '999px',
              background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-light)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>
              {onStartRated ? <>{ts('Start rated quiz')} →</> : ts('New test')}
            </button>
            {onExit && (
              <button onClick={onExit} style={{
                height: '40px', padding: '0 20px', borderRadius: '999px',
                background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-light)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}>
                {ts('Back to subject')}
              </button>
            )}
          </>
        ) : (
          <>
            {result.incorrectAnswers > 0 && (
              <button onClick={onRedoWrong} style={{
                height: '40px', padding: '0 20px', borderRadius: '999px',
                background: 'rgba(210,153,34,0.15)', color: '#D29922',
                border: '1px solid rgba(210,153,34,0.4)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(210,153,34,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(210,153,34,0.15)'; }}
              >
                {ts('Redo wrong answers')} →
              </button>
            )}
            <button onClick={onRetry} style={{
              height: '40px', padding: '0 20px', borderRadius: '999px',
              background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-light)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>
              {ts('Retry same questions')}
            </button>
            <button onClick={onRetakeSetup} style={{
              height: '40px', padding: '0 20px', borderRadius: '999px',
              background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-light)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>
              {ts('New test')}
            </button>
          </>
        )}
      </div>

      {/* Question breakdown */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px' }}>
          {ts('Question breakdown')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {displayQuestions.map((rq, i) => {
            const isOpen = expanded.has(rq.questionId);
            return (
              <div key={rq.questionId} style={{
                borderRadius: '12px', overflow: 'hidden',
                border: `1px solid ${rq.wasCorrect ? 'rgba(46,160,67,0.2)' : 'rgba(248,81,73,0.2)'}`,
                background: rq.wasCorrect ? 'rgba(46,160,67,0.04)' : 'rgba(248,81,73,0.04)',
              }}>
                <button
                  onClick={() => {
                    // Selecting question text to define it also fires this
                    // button's click on mouseup — don't toggle in that case.
                    const sel = window.getSelection();
                    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
                    toggleExpand(rq.questionId);
                  }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px', marginTop: '1px' }}>{rq.wasCorrect ? '✅' : '❌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-1)', fontWeight: 500, lineHeight: 1.45, marginBottom: '2px' }}>
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--text-3)', marginRight: '6px' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <DefinableArea onDefine={onDefine} onDefineJapanese={onDefineJapanese}>
                        {rq.questionText}
                      </DefinableArea>
                    </div>
                    {!rq.wasCorrect && (
                      <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.4 }}>
                        <span style={{ color: '#F97979' }}>{ts('Your answer:')} {rq.userAnswer}</span>
                        <span style={{ color: 'var(--text-3)', margin: '0 4px' }}>·</span>
                        <span style={{ color: '#56D364' }}>{ts('Correct:')} {rq.correctAnswer}</span>
                      </div>
                    )}
                    {rq.wasCorrect && (
                      <div style={{ fontSize: '11px', color: '#56D364' }}>{ts('Your answer:')} {rq.userAnswer}</div>
                    )}
                  </div>
                  <svg viewBox="0 0 10 6" width="10" height="10" fill="none" style={{ flexShrink: 0, marginTop: '4px', transform: isOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>
                    <path d="M1 1l4 4 4-4" stroke="var(--text-3)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="anim-fadein" style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ height: '1px', background: 'var(--border-light)', marginBottom: '8px' }} />
                    <DefinableArea onDefine={onDefine} onDefineJapanese={onDefineJapanese}>
                    {rq.options.map((opt, oi) => {
                      const isCorrect = rq.correctAnswerIndex !== undefined ? oi === rq.correctAnswerIndex : opt === rq.correctAnswer;
                      const isChosen = rq.userAnswerIndex !== undefined ? oi === rq.userAnswerIndex : opt === rq.userAnswer;
                      let bg = 'transparent', border = 'var(--border-base)', color = 'var(--text-2)';
                      if (isCorrect) { bg = 'rgba(46,160,67,0.08)'; border = 'rgba(46,160,67,0.3)'; color = '#56D364'; }
                      if (isChosen && !isCorrect) { bg = 'rgba(248,81,73,0.08)'; border = 'rgba(248,81,73,0.3)'; color = '#F97979'; }
                      return (
                        <div key={oi} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', borderRadius: '8px',
                          border: `1px solid ${border}`, background: bg,
                        }}>
                          <span style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, background: isCorrect ? 'rgba(46,160,67,0.2)' : (isChosen ? 'rgba(248,81,73,0.2)' : 'var(--bg-elevated)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>
                            {letterFor(oi)}
                          </span>
                          <span style={{ fontSize: '11px', color, lineHeight: 1.4 }}>{opt}</span>
                          {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#56D364', fontWeight: 700 }}>✓ {ts('Correct')}</span>}
                          {isChosen && !isCorrect && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#F97979', fontWeight: 700 }}>✗ {ts('Wrong')}</span>}
                        </div>
                      );
                    })}
                    </DefinableArea>
                    {rq.explanation && (
                      <div style={{ marginTop: '6px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(61,126,255,0.05)', border: '1px solid rgba(61,126,255,0.15)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.55 }}>{rq.explanation}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {result.questions.length > 8 && (
          <button onClick={() => setShowAll(s => !s)} style={{
            marginTop: '10px', width: '100%', padding: '10px',
            background: 'transparent', border: '1px dashed var(--border-base)', borderRadius: '10px',
            fontSize: '11px', color: 'var(--text-2)', cursor: 'pointer', fontWeight: 600,
          }}>
            {showAll ? ts('Show less') : ts('Show all {n} questions', { n: result.questions.length })}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main QuizViewer ───────────────────────────────────────────────────────────

type Phase = 'setup' | 'playing' | 'results' | 'redo' | 'redo-results';

export function QuizViewer({
  questions, color,
  quizId = 'quiz', quizTitle = 'Quiz', subjectId = '',
  disableResultPersistence = false,
  onComplete,
  initialRedoResult,
  onExit,
  onQuestionEdit,
  onQuestionDelete,
  onDefine,
  onDefineJapanese,
}: {
  questions: GeneratedQuizQuestion[];
  color: string;
  quizId?: string;
  quizTitle?: string;
  subjectId?: string;
  // Skips saveQuizResult/onComplete regardless of the user's chosen play
  // mode — for callers with no real subject/quiz to attach a result to
  // (e.g. the standalone Generate page), where persisting would just leave
  // behind orphaned quizId:'quiz'/subjectId:'' history entries.
  disableResultPersistence?: boolean;
  onComplete?: (result: QuizResult) => void;
  initialRedoResult?: QuizResult;
  onExit?: () => void;
  onQuestionEdit?: (questionId: string, draft: EditDraft) => void;
  onQuestionDelete?: (questionId: string) => void;
  onDefine?: (term: string) => void;
  onDefineJapanese?: (term: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>(initialRedoResult ? 'redo' : 'setup');
  const [activeQuestions, setActiveQuestions] = useState<GeneratedQuizQuestion[]>(
    initialRedoResult
      ? buildRedoQuestions(initialRedoResult).map(shuffleOptions)
      : []
  );
  const [quizMode, setQuizMode] = useState<QuizMode>('focused');
  // When non-null, the setup screen pre-selects this mode (e.g. coming back from
  // a practice session via "Start rated quiz"). Otherwise it remembers last used.
  const [setupMode, setSetupMode] = useState<QuizMode | undefined>(initialRedoResult ? 'focused' : undefined);
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);
  const [redoQuestions, setRedoQuestions] = useState<GeneratedQuizQuestion[]>(
    initialRedoResult ? buildRedoQuestions(initialRedoResult).map(shuffleOptions) : []
  );
  const [redoDoneStats, setRedoDoneStats] = useState<{ correct: number; total: number } | null>(null);

  function buildResult(
    qs: GeneratedQuizQuestion[],
    answerMap: Record<string, number>,
    timeSec: number,
  ): QuizResult {
    const resultQs: QuizResultQuestion[] = qs.map(q => {
      const chosenIdx = answerMap[q.id] ?? -1;
      const correctIdx = Number(q.correct);
      return {
        questionId:      q.id,
        questionText:    q.question,
        userAnswer:      chosenIdx >= 0 ? q.options[chosenIdx] : '',
        correctAnswer:   q.options[correctIdx],
        userAnswerIndex:    chosenIdx >= 0 ? chosenIdx : undefined,
        correctAnswerIndex: correctIdx,
        wasCorrect:      chosenIdx === correctIdx,
        options:         [...q.options],
        explanation:     q.explanation || undefined,
      };
    });
    const correct = resultQs.filter(r => r.wasCorrect).length;
    return {
      id:               `result-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      subjectId,
      quizId,
      quizTitle,
      completedAt:      Date.now(),
      totalQuestions:   qs.length,
      correctAnswers:   correct,
      incorrectAnswers: qs.length - correct,
      scorePercent:     Math.round((correct / qs.length) * 100),
      timeTakenSeconds: timeSec,
      questions:        resultQs,
    };
  }

  function handlePlayDone(answerMap: Record<string, number>, timeSec: number) {
    const result = buildResult(activeQuestions, answerMap, timeSec);
    setLastResult(result);
    setPhase('results');
    // Practice mode: zero persistence. No storage write, no activity feed,
    // no effect on averages or quiz history (onComplete is what updates those).
    if (quizMode === 'practice' || disableResultPersistence) return;
    persistResult(result);
    onComplete?.(result);
  }

  function handleRedoDone(answerMap: Record<string, number>) {
    const correct = redoQuestions.filter(q => answerMap[q.id] === Number(q.correct)).length;
    setRedoDoneStats({ correct, total: redoQuestions.length });
    const stillWrong = redoQuestions.filter(q => answerMap[q.id] !== Number(q.correct));
    setRedoQuestions(stillWrong.map(shuffleOptions));
    setPhase('redo-results');
  }

  function startRedoAgain() {
    setPhase('redo');
  }

  // Mid-quiz edits (FocusedMode/TestMode's "Save Edit") previously only
  // updated mode-local override state, so in-session feedback reflected the
  // edit but buildResult() still graded against the stale activeQuestions —
  // the results screen, persisted result, and redo pool all used the
  // pre-edit answer/options. Apply the edit to activeQuestions too so
  // grading is consistent everywhere, in addition to persisting it.
  function handleQuestionSaved(qid: string, draft: EditDraft) {
    setActiveQuestions(prev => prev.map(q =>
      q.id === qid ? { ...q, question: draft.question, options: draft.options, correct: draft.correct } : q
    ));
    onQuestionEdit?.(qid, draft);
  }

  if (phase === 'setup') {
    return (
      <SetupScreen
        questions={questions}
        color={color}
        initialMode={setupMode}
        onQuestionSaved={onQuestionEdit}
        onQuestionDeleted={onQuestionDelete}
        onStart={(count, shuffle, mode, overrides) => {
          // Merge in edits made from the setup screen's question list — it
          // only tracked them in display-only local state, so Begin used to
          // build the pool from the original, pre-edit questions prop.
          const effective = questions.map(q => {
            const ov = overrides[q.id];
            return ov ? { ...q, question: ov.question, options: ov.options, correct: ov.correct } : q;
          });
          const pool = shuffle ? [...effective].sort(() => Math.random() - 0.5) : [...effective];
          setActiveQuestions(pool.slice(0, count));
          setQuizMode(mode);
          setSetupMode(undefined);
          setPhase('playing');
        }}
      />
    );
  }

  if (phase === 'playing') {
    const isPractice = quizMode === 'practice' || disableResultPersistence;
    return quizMode === 'test'
      ? <TestMode key={activeQuestions.map(q => q.id).join('')} questions={activeQuestions} color={color} isPractice={isPractice} onDone={handlePlayDone} onQuestionSaved={handleQuestionSaved} onDefine={onDefine} onDefineJapanese={onDefineJapanese} />
      : <FocusedMode key={activeQuestions.map(q => q.id).join('')} questions={activeQuestions} color={color} isPractice={isPractice} onDone={handlePlayDone} onQuestionSaved={handleQuestionSaved} onDefine={onDefine} onDefineJapanese={onDefineJapanese} />;
  }

  if (phase === 'results' && lastResult) {
    const isPractice = quizMode === 'practice' || disableResultPersistence;
    return (
      <ResultsScreen
        result={lastResult}
        color={color}
        isPractice={isPractice}
        onDefine={onDefine}
        onDefineJapanese={onDefineJapanese}
        onRetry={() => {
          setPhase('playing');
        }}
        onRedoWrong={() => {
          const wrongQs = buildRedoQuestions(lastResult);
          setRedoQuestions(wrongQs.map(shuffleOptions));
          setPhase('redo');
        }}
        onRetakeSetup={() => setPhase('setup')}
        onStartRated={disableResultPersistence ? undefined : () => { setSetupMode('focused'); setPhase('setup'); }}
        onExit={onExit}
      />
    );
  }

  if (phase === 'redo') {
    return (
      <FocusedMode
        key={redoQuestions.map(q => q.id).join('')}
        questions={redoQuestions}
        color={color}
        isRedoMode
        onDone={(answerMap) => handleRedoDone(answerMap)}
        onDefine={onDefine}
        onDefineJapanese={onDefineJapanese}
      />
    );
  }

  if (phase === 'redo-results' && redoDoneStats) {
    return (
      <RedoResultsScreen
        correct={redoDoneStats.correct}
        total={redoDoneStats.total}
        color={color}
        onRedoAgain={startRedoAgain}
        onBack={() => (lastResult ? setPhase('results') : onExit?.())}
      />
    );
  }

  return null;
}

// ── Helper: reconstruct redo questions from a saved result ────────────────────

function buildRedoQuestions(result: QuizResult): GeneratedQuizQuestion[] {
  return result.questions
    .filter(rq => !rq.wasCorrect)
    .map(rq => ({
      id:          rq.questionId,
      question:    rq.questionText,
      options:     rq.options,
      correct:     rq.correctAnswerIndex !== undefined ? rq.correctAnswerIndex : rq.options.indexOf(rq.correctAnswer),
      explanation: rq.explanation ?? '',
    }));
}

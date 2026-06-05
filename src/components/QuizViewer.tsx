import { useState, useRef, useMemo } from 'react';
import type { GeneratedQuizQuestion } from '../lib/generator';
import { saveQuizResult, type QuizResult, type QuizResultQuestion } from '../lib/db';
import { isFirebaseConfigured, saveCloudQuizResult } from '../lib/cloudDb';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function useCountUp(target: number, active: boolean, duration = 900) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(0);
  const prevTarget = useRef(-1);

  useMemo(() => {
    if (!active) { setVal(0); prevTarget.current = -1; return; }
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setVal(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, active]);

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
  const indices = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const newOptions = indices.map(i => q.options[i]) as [string, string, string, string];
  const newCorrect = indices.indexOf(q.correct) as 0 | 1 | 2 | 3;
  return { ...q, options: newOptions, correct: newCorrect };
}

async function persistResult(result: QuizResult) {
  try {
    if (isFirebaseConfigured) {
      await saveCloudQuizResult(result);
    } else {
      await saveQuizResult(result);
    }
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
          background: on ? color : '#21262D',
          border: `1px solid ${on ? color + '80' : '#30363D'}`,
          cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: '2px', left: on ? '20px' : '2px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: on ? '#fff' : '#8B949E',
          transition: 'left 0.2s, background 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </button>
      <span style={{ fontSize: '13px', color: on ? '#E6EDF3' : '#8B949E', transition: 'color 0.2s' }}>
        {label}
      </span>
    </label>
  );
}

// ── Setup screen ───────────────────────────────────────────────────────────────

function SetupScreen({ total, color, onStart }: {
  total: number;
  color: string;
  onStart: (count: number, shuffle: boolean, mode: 'focused' | 'test') => void;
}) {
  const rawOptions = [5, 10, 15, 20].filter(n => n < total);
  const countOptions = [...rawOptions, total];
  const defaultCount = countOptions.find(n => n >= Math.min(10, total)) ?? total;
  const [testCount, setTestCount] = useState(defaultCount);
  const [shuffle, setShuffle] = useState(true);
  const [mode, setMode] = useState<'focused' | 'test'>('focused');

  return (
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
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#484F58', marginBottom: '8px' }}>
            Ready to study
          </div>
          <div className="mono" style={{ fontSize: 'clamp(56px, 12vw, 72px)', fontWeight: 800, lineHeight: 1, color, letterSpacing: '-0.02em' }}>
            {total}
          </div>
          <div style={{ fontSize: '13px', color: '#8B949E', marginTop: '6px' }}>questions available</div>
        </div>

        {/* Mode selector */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '12px', textAlign: 'center' }}>Mode</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
            {(['focused', 'test'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '12px 16px', borderRadius: '12px',
                border: `1px solid ${mode === m ? color + '55' : '#21262D'}`,
                background: mode === m ? color + '12' : '#161B22',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: mode === m ? color : '#8B949E', marginBottom: '3px' }}>
                  {m === 'focused' ? 'Focused' : 'Test'}
                </div>
                <div style={{ fontSize: '11px', color: '#484F58', lineHeight: 1.4 }}>
                  {m === 'focused' ? 'One question at a time' : 'All questions, submit at end'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Question count */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '12px', textAlign: 'center' }}>Questions</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {countOptions.map(n => (
              <button key={n} onClick={() => setTestCount(n)} style={{
                height: '36px', padding: '0 16px', borderRadius: '999px',
                background: testCount === n ? color + '18' : '#161B22',
                color: testCount === n ? color : '#8B949E',
                border: `1px solid ${testCount === n ? color + '55' : '#21262D'}`,
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {n === total ? `All ${n}` : n}
              </button>
            ))}
          </div>
        </div>

        {/* Shuffle */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
          <Toggle on={shuffle} color={color} onChange={() => setShuffle(s => !s)} label="Shuffle questions" />
        </div>

        {/* Begin */}
        <button
          onClick={() => onStart(testCount, shuffle, mode)}
          style={{
            display: 'block', margin: '0 auto', minWidth: '200px',
            height: '46px', padding: '0 40px', borderRadius: '999px',
            background: color, color: '#fff', border: 'none',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em',
            boxShadow: `0 4px 24px ${color}40, 0 1px 0 rgba(255,255,255,0.12) inset`,
            transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.02)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        >
          Begin →
        </button>
      </div>
    </div>
  );
}

// ── Option button ─────────────────────────────────────────────────────────────

function OptionBtn({
  letter, text, state, disabled, onClick, compact = false,
}: {
  letter: string; text: string;
  state: 'idle' | 'chosen' | 'right' | 'wrong';
  disabled: boolean; onClick: () => void; compact?: boolean;
}) {
  const colors = {
    idle:   { bg: 'transparent', border: '#21262D', text: '#8B949E', lb: '#21262D', lc: '#8B949E' },
    chosen: { bg: '#3D7EFF0F',   border: '#3D7EFF55', text: '#E6EDF3', lb: '#3D7EFF22', lc: '#3D7EFF' },
    right:  { bg: 'rgba(46,160,67,0.09)', border: 'rgba(46,160,67,0.4)', text: '#56D364', lb: 'rgba(46,160,67,0.25)', lc: '#56D364' },
    wrong:  { bg: 'rgba(248,81,73,0.09)', border: 'rgba(248,81,73,0.4)', text: '#F97979', lb: 'rgba(248,81,73,0.25)', lc: '#F97979' },
  }[state];

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={state === 'right' ? 'anim-correct' : state === 'wrong' ? 'anim-shake' : ''}
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? '10px' : '14px',
        padding: compact ? '10px 12px' : '16px 20px',
        minHeight: compact ? undefined : '56px',
        borderRadius: compact ? '10px' : '12px',
        border: `1px solid ${colors.border}`, background: colors.bg,
        cursor: disabled ? 'default' : 'pointer', textAlign: 'left', width: '100%',
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={e => { if (!disabled && state === 'idle') { const el = e.currentTarget as HTMLElement; el.style.background = '#3D7EFF08'; el.style.borderColor = '#3D7EFF33'; }}}
      onMouseLeave={e => { if (!disabled && state === 'idle') { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = '#21262D'; }}}
    >
      <span style={{
        width: compact ? '24px' : '28px', height: compact ? '24px' : '28px',
        borderRadius: compact ? '6px' : '8px', flexShrink: 0,
        background: colors.lb, color: colors.lc,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
        transition: 'all 0.12s',
      }}>
        {state === 'right' ? (
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke={colors.lc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : letter}
      </span>
      <span style={{ fontSize: compact ? '12px' : '15px', color: colors.text, lineHeight: 1.5, fontWeight: state === 'chosen' || state === 'right' ? 500 : 400 }}>
        {text}
      </span>
    </button>
  );
}

// ── Explanation panel ─────────────────────────────────────────────────────────

function Explanation({ correct, text }: { correct: boolean; text: string }) {
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
          {correct ? 'CORRECT' : 'INCORRECT'}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: '#8B949E', lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
}

// ── Focused mode ───────────────────────────────────────────────────────────────

function FocusedMode({
  questions, color, isRedoMode = false,
  onDone,
}: {
  questions: GeneratedQuizQuestion[];
  color: string;
  isRedoMode?: boolean;
  onDone: (answers: Record<string, number>, timeSec: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answeredList, setAnsweredList] = useState<{ qi: number; chosen: number }[]>([]);
  const [animKey, setAnimKey] = useState(0);
  const startTime = useRef(Date.now());

  const q = questions[idx];
  const correct = Number(q.correct);
  const isCorrect = chosen === correct;
  const total = questions.length;
  const progress = (idx / total) * 100;
  const doneCount = answeredList.filter(a => a.chosen === Number(questions[a.qi].correct)).length;

  function pick(oi: number) {
    if (revealed) return;
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
            Review mode — {total} missed question{total !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Progress header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#484F58', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Question {idx + 1} of {total}
          </span>
          {!isRedoMode && (
            <span className="mono" style={{ fontSize: '11px', color, fontWeight: 700 }}>
              {doneCount} correct
            </span>
          )}
        </div>
        <div style={{ height: '3px', background: '#161B22', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '999px', background: color,
            width: `${progress}%`, transition: 'width 0.4s cubic-bezier(0,0,0.2,1)',
            boxShadow: `0 0 8px ${color}80`,
          }} />
        </div>
      </div>

      {/* Card */}
      <div key={animKey} className="anim-fadein" style={{
        background: '#161B22', border: '1px solid #21262D', borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 2px 20px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset',
      }}>
        <div style={{ padding: '32px 36px 24px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#E6EDF3', lineHeight: 1.5 }}>
            {q.question}
          </div>
        </div>
        <div style={{ height: '1px', background: '#21262D', margin: '0 28px' }} />

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {q.options.map((opt, oi) => {
            const state = !revealed
              ? (chosen === oi ? 'chosen' : 'idle')
              : (oi === correct ? 'right' : (chosen === oi ? 'wrong' : 'idle'));
            return (
              <OptionBtn key={oi} letter={LETTERS[oi]} text={opt} state={state}
                disabled={revealed} onClick={() => pick(oi)} />
            );
          })}
        </div>

        {revealed && q.explanation && (
          <div style={{ margin: '0 20px 20px' }}>
            <Explanation correct={isCorrect} text={q.explanation} />
          </div>
        )}
        {revealed && !q.explanation && (
          <div className="anim-fadein" style={{ margin: '0 20px 12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: isCorrect ? '#56D364' : '#F97979' }}>
              {isCorrect ? '✓ Correct' : `✗ Incorrect — correct: ${q.options[correct]}`}
            </span>
          </div>
        )}

        {revealed && (
          <div className="anim-fadein" style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={next}
              style={{
                height: '38px', padding: '0 24px', borderRadius: '999px',
                background: color, color: '#fff', border: 'none',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 2px 12px ${color}40`, letterSpacing: '0.03em',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
            >
              {idx + 1 >= total ? 'See Results' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Test mode ──────────────────────────────────────────────────────────────────

function TestMode({ questions, color, onDone }: {
  questions: GeneratedQuizQuestion[];
  color: string;
  onDone: (answers: Record<string, number>, timeSec: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [shakingId, setShakingId] = useState<string | null>(null);
  const startTime = useRef(Date.now());

  const score = submitted ? questions.filter(q => answers[q.id] === Number(q.correct)).length : 0;
  const pct = submitted && questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const answered = Object.keys(answers).length;
  const counted = useCountUp(pct, submitted);

  function handleAnswer(qid: string, oi: number, correctIndex: number) {
    setAnswers(a => ({ ...a, [qid]: oi }));
    if (oi !== correctIndex) {
      setShakingId(qid);
      setTimeout(() => setShakingId(null), 400);
    }
  }

  function submit() {
    setSubmitted(true);
    onDone(answers, Math.floor((Date.now() - startTime.current) / 1000));
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 8px' }}>
      {submitted && (
        <div className="anim-fadein" style={{
          padding: '20px 24px', borderRadius: '16px', marginBottom: '20px',
          background: `radial-gradient(120% 140% at 0% 0%, ${color}0E 0%, #161B22 55%)`,
          border: `1px solid ${color}28`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span className="mono" style={{ fontSize: '2.8rem', color, lineHeight: 1, fontWeight: 700 }}>{counted}%</span>
              <span style={{ fontSize: '13px', color: '#8B949E' }}>{score} / {questions.length} correct</span>
            </div>
            <button
              onClick={() => { setAnswers({}); setSubmitted(false); }}
              style={{ height: '32px', padding: '0 14px', borderRadius: '999px', background: '#1F2937', color: '#E6EDF3', border: '1px solid #30363D', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
          <div style={{ display: 'flex', height: '6px', borderRadius: '999px', overflow: 'hidden', background: '#1F2937' }}>
            <div style={{ width: `${pct}%`, background: '#2EA043', transition: 'width 1s cubic-bezier(0,0,0.2,1)' }} />
            <div style={{ width: `${100 - pct}%`, background: 'rgba(248,81,73,0.5)', transition: 'width 1s cubic-bezier(0,0,0.2,1)' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {questions.map((q, qi) => {
          const chosen = answers[q.id];
          const reveal = submitted;
          const isCorrect = reveal && chosen === Number(q.correct);
          const answeredCorrectly = chosen !== undefined && chosen === Number(q.correct);
          const shaking = shakingId === q.id;

          return (
            <div key={q.id} className={shaking ? 'anim-shake' : ''} style={{
              background: '#161B22', borderRadius: '16px', overflow: 'hidden',
              border: `1px solid ${submitted && chosen !== undefined ? (isCorrect ? 'rgba(46,160,67,0.3)' : 'rgba(248,81,73,0.3)') : '#21262D'}`,
              transition: 'border-color 0.2s',
            }}>
              <div style={{ padding: '18px 20px 14px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#E6EDF3', lineHeight: 1.6 }}>
                  <span className="mono" style={{ fontSize: '10px', color: '#484F58', marginRight: '10px', fontWeight: 700 }}>
                    {String(qi + 1).padStart(2, '0')}
                  </span>
                  {q.question}
                </p>
              </div>
              <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {q.options.map((opt, oi) => {
                  const state = !reveal
                    ? (chosen === oi ? 'chosen' : 'idle')
                    : (oi === Number(q.correct) ? 'right' : (chosen === oi ? 'wrong' : 'idle'));
                  return (
                    <OptionBtn key={oi} letter={LETTERS[oi]} text={opt}
                      state={state as 'idle' | 'chosen' | 'right' | 'wrong'}
                      disabled={submitted} onClick={() => handleAnswer(q.id, oi, Number(q.correct))}
                      compact />
                  );
                })}
              </div>
              {reveal && q.explanation && (
                <div style={{ margin: '0 12px 14px' }}>
                  <Explanation correct={answeredCorrectly} text={q.explanation} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && answered > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={submit}
            disabled={answered < questions.length}
            style={{
              height: '42px', padding: '0 28px', borderRadius: '999px',
              background: answered === questions.length ? color : '#1F2937',
              color: answered === questions.length ? '#fff' : '#8B949E',
              border: 'none', fontSize: '13px', fontWeight: 700,
              cursor: answered < questions.length ? 'not-allowed' : 'pointer',
              opacity: answered < questions.length ? 0.55 : 1,
              boxShadow: answered === questions.length ? `0 2px 16px ${color}40` : 'none',
              transition: 'all 0.15s',
            }}
          >
            Check Answers
          </button>
          {answered < questions.length && (
            <span style={{ fontSize: '12px', color: '#484F58' }}>{answered} / {questions.length} answered</span>
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
  const perfect = correct === total;
  return (
    <div className="anim-fadein" style={{ maxWidth: '420px', margin: '0 auto', position: 'relative' }}>
      {perfect && <Confetti />}
      <div style={{
        padding: '28px', borderRadius: '20px',
        background: perfect ? 'rgba(46,160,67,0.07)' : `radial-gradient(120% 140% at 0% 0%, ${color}0E 0%, #161B22 60%)`,
        border: `1px solid ${perfect ? 'rgba(46,160,67,0.3)' : color + '25'}`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#484F58', marginBottom: '8px' }}>
          Review complete
        </div>
        <div className="mono" style={{ fontSize: '2.8rem', fontWeight: 700, color: perfect ? '#56D364' : color, lineHeight: 1, marginBottom: '8px' }}>
          {correct} / {total}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: perfect ? '#56D364' : '#E6EDF3', marginBottom: '16px' }}>
          {perfect ? 'All correct! Great improvement.' : `${total - correct} still incorrect`}
        </div>
        <div style={{ height: '5px', background: '#21262D', borderRadius: '999px', overflow: 'hidden' }}>
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
            Redo remaining
          </button>
        )}
        <button onClick={onBack} style={{
          height: '38px', padding: '0 20px', borderRadius: '999px',
          background: '#161B22', color: '#8B949E', border: '1px solid #21262D',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}>
          Back to results
        </button>
      </div>
    </div>
  );
}

// ── Full results screen ───────────────────────────────────────────────────────

function ResultsScreen({
  result, color,
  onRetry, onRedoWrong, onRetakeSetup,
}: {
  result: QuizResult; color: string;
  onRetry: () => void;
  onRedoWrong: () => void;
  onRetakeSetup: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const counted = useCountUp(result.scorePercent, true);

  const gradeColor = result.scorePercent >= 80 ? '#56D364' : result.scorePercent >= 60 ? '#D29922' : '#F97979';
  const grade = result.scorePercent >= 90 ? 'Excellent' : result.scorePercent >= 75 ? 'Good job' : result.scorePercent >= 60 ? 'Decent' : 'Keep studying';

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
      {/* Score header */}
      <div style={{
        padding: '28px', borderRadius: '20px', marginBottom: '16px',
        background: `radial-gradient(130% 150% at 0% 0%, ${color}0E 0%, #161B22 60%)`,
        border: `1px solid ${color}25`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <div className="mono" style={{ fontSize: '3.6rem', fontWeight: 700, lineHeight: 1, color: gradeColor, letterSpacing: '-0.02em' }}>
              {result.correctAnswers} <span style={{ fontSize: '2rem', color: '#484F58' }}>/ {result.totalQuestions}</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: gradeColor, marginTop: '4px' }}>{counted}% · {grade}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '11px', color: '#8B949E' }}>Completed in <strong style={{ color: '#E6EDF3' }}>{formatTime(result.timeTakenSeconds)}</strong></span>
            <span style={{ fontSize: '11px', color: '#484F58' }}>{formatDate(result.completedAt)}</span>
          </div>
        </div>

        {/* Bar */}
        <div style={{ display: 'flex', height: '6px', borderRadius: '999px', overflow: 'hidden', background: '#21262D', marginBottom: '16px' }}>
          <div style={{ width: `${result.scorePercent}%`, background: `linear-gradient(90deg, ${gradeColor}88, ${gradeColor})`, transition: 'width 1s cubic-bezier(0,0,0.2,1)', boxShadow: `0 0 8px ${gradeColor}60` }} />
          <div style={{ flex: 1, background: 'rgba(248,81,73,0.25)' }} />
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { icon: '✅', label: 'Correct', val: result.correctAnswers, c: '#56D364' },
            { icon: '❌', label: 'Wrong', val: result.incorrectAnswers, c: '#F97979' },
            { icon: '⏱', label: 'Time', val: formatTime(result.timeTakenSeconds), c: '#8B949E' },
          ].map(p => (
            <div key={p.label} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '999px',
              background: '#0D1117', border: '1px solid #21262D',
            }}>
              <span style={{ fontSize: '11px' }}>{p.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: p.c }}>{p.val}</span>
              <span style={{ fontSize: '10px', color: '#484F58' }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
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
            Redo wrong answers →
          </button>
        )}
        <button onClick={onRetry} style={{
          height: '40px', padding: '0 20px', borderRadius: '999px',
          background: '#161B22', color: '#8B949E', border: '1px solid #21262D',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}>
          Retry same questions
        </button>
        <button onClick={onRetakeSetup} style={{
          height: '40px', padding: '0 20px', borderRadius: '999px',
          background: '#161B22', color: '#8B949E', border: '1px solid #21262D',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}>
          New test
        </button>
      </div>

      {/* Question breakdown */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '12px' }}>
          Question breakdown
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
                  onClick={() => toggleExpand(rq.questionId)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px', marginTop: '1px' }}>{rq.wasCorrect ? '✅' : '❌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#E6EDF3', fontWeight: 500, lineHeight: 1.45, marginBottom: '2px' }}>
                      <span className="mono" style={{ fontSize: '10px', color: '#484F58', marginRight: '6px' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {rq.questionText}
                    </div>
                    {!rq.wasCorrect && (
                      <div style={{ fontSize: '11px', color: '#8B949E', lineHeight: 1.4 }}>
                        <span style={{ color: '#F97979' }}>Your answer: {rq.userAnswer}</span>
                        <span style={{ color: '#484F58', margin: '0 4px' }}>·</span>
                        <span style={{ color: '#56D364' }}>Correct: {rq.correctAnswer}</span>
                      </div>
                    )}
                    {rq.wasCorrect && (
                      <div style={{ fontSize: '11px', color: '#56D364' }}>Your answer: {rq.userAnswer}</div>
                    )}
                  </div>
                  <svg viewBox="0 0 10 6" width="10" height="10" fill="none" style={{ flexShrink: 0, marginTop: '4px', transform: isOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>
                    <path d="M1 1l4 4 4-4" stroke="#484F58" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="anim-fadein" style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ height: '1px', background: '#21262D', marginBottom: '8px' }} />
                    {rq.options.map((opt, oi) => {
                      const isCorrect = opt === rq.correctAnswer;
                      const isChosen = opt === rq.userAnswer;
                      let bg = 'transparent', border = '#21262D', color = '#8B949E';
                      if (isCorrect) { bg = 'rgba(46,160,67,0.08)'; border = 'rgba(46,160,67,0.3)'; color = '#56D364'; }
                      if (isChosen && !isCorrect) { bg = 'rgba(248,81,73,0.08)'; border = 'rgba(248,81,73,0.3)'; color = '#F97979'; }
                      return (
                        <div key={oi} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', borderRadius: '8px',
                          border: `1px solid ${border}`, background: bg,
                        }}>
                          <span style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, background: isCorrect ? 'rgba(46,160,67,0.2)' : (isChosen ? 'rgba(248,81,73,0.2)' : '#21262D'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>
                            {LETTERS[oi]}
                          </span>
                          <span style={{ fontSize: '11px', color, lineHeight: 1.4 }}>{opt}</span>
                          {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#56D364', fontWeight: 700 }}>✓ Correct</span>}
                          {isChosen && !isCorrect && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#F97979', fontWeight: 700 }}>✗ Wrong</span>}
                        </div>
                      );
                    })}
                    {rq.explanation && (
                      <div style={{ marginTop: '6px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(61,126,255,0.05)', border: '1px solid rgba(61,126,255,0.15)' }}>
                        <span style={{ fontSize: '11px', color: '#8B949E', lineHeight: 1.55 }}>{rq.explanation}</span>
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
            background: 'transparent', border: '1px dashed #30363D', borderRadius: '10px',
            fontSize: '11px', color: '#8B949E', cursor: 'pointer', fontWeight: 600,
          }}>
            {showAll ? 'Show less' : `Show all ${result.questions.length} questions`}
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
  onComplete,
  initialRedoResult,
}: {
  questions: GeneratedQuizQuestion[];
  color: string;
  quizId?: string;
  quizTitle?: string;
  subjectId?: string;
  onComplete?: (result: QuizResult) => void;
  initialRedoResult?: QuizResult;
}) {
  const [phase, setPhase] = useState<Phase>(initialRedoResult ? 'redo' : 'setup');
  const [activeQuestions, setActiveQuestions] = useState<GeneratedQuizQuestion[]>(
    initialRedoResult
      ? buildRedoQuestions(initialRedoResult).map(shuffleOptions)
      : []
  );
  const [quizMode, setQuizMode] = useState<'focused' | 'test'>('focused');
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
        questionId:    q.id,
        questionText:  q.question,
        userAnswer:    chosenIdx >= 0 ? q.options[chosenIdx] : '',
        correctAnswer: q.options[correctIdx],
        wasCorrect:    chosenIdx === correctIdx,
        options:       [...q.options],
        explanation:   q.explanation || undefined,
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
    persistResult(result);
    setLastResult(result);
    setPhase('results');
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

  if (phase === 'setup') {
    return (
      <SetupScreen
        total={questions.length}
        color={color}
        onStart={(count, shuffle, mode) => {
          const pool = shuffle ? [...questions].sort(() => Math.random() - 0.5) : [...questions];
          setActiveQuestions(pool.slice(0, count));
          setQuizMode(mode);
          setPhase('playing');
        }}
      />
    );
  }

  if (phase === 'playing') {
    return quizMode === 'focused'
      ? <FocusedMode key={activeQuestions.map(q => q.id).join('')} questions={activeQuestions} color={color} onDone={handlePlayDone} />
      : <TestMode key={activeQuestions.map(q => q.id).join('')} questions={activeQuestions} color={color} onDone={handlePlayDone} />;
  }

  if (phase === 'results' && lastResult) {
    return (
      <ResultsScreen
        result={lastResult}
        color={color}
        onRetry={() => {
          setPhase('playing');
        }}
        onRedoWrong={() => {
          const wrongQs = buildRedoQuestions(lastResult);
          setRedoQuestions(wrongQs.map(shuffleOptions));
          setPhase('redo');
        }}
        onRetakeSetup={() => setPhase('setup')}
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
        onBack={() => setPhase('results')}
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
      options:     rq.options.slice(0, 4) as [string, string, string, string],
      correct:     rq.options.indexOf(rq.correctAnswer) as 0 | 1 | 2 | 3,
      explanation: rq.explanation ?? '',
    }));
}

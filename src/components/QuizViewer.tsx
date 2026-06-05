import { useState, useEffect, useRef } from 'react';
import type { GeneratedQuizQuestion } from '../lib/generator';

function useCountUp(target: number, active: boolean, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setVal(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return val;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, color, onChange, label }: { on: boolean; color: string; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
      <button
        role="switch"
        aria-checked={on}
        onClick={onChange}
        style={{
          width: '40px', height: '22px', borderRadius: '999px', flexShrink: 0,
          background: on ? color : '#21262D',
          border: `1px solid ${on ? color + '80' : '#30363D'}`,
          cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s ease, border-color 0.2s ease',
        }}
      >
        <span style={{
          position: 'absolute', top: '2px',
          left: on ? '20px' : '2px',
          width: '16px', height: '16px',
          borderRadius: '50%', background: on ? '#fff' : '#8B949E',
          transition: 'left 0.2s ease, background 0.2s ease',
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
    <div style={{ maxWidth: '460px', paddingTop: '8px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#484F58', marginBottom: '6px' }}>
          Ready to study
        </div>
        <div className="mono" style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1, color, letterSpacing: '-0.02em' }}>
          {total}
        </div>
        <div style={{ fontSize: '13px', color: '#8B949E', marginTop: '4px' }}>
          questions available
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '12px' }}>
          Mode
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {(['focused', 'test'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '12px 16px', borderRadius: '12px', border: `1px solid ${mode === m ? color + '55' : '#21262D'}`,
                background: mode === m ? color + '12' : '#161B22',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
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

      {/* Count selector */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '12px' }}>
          Questions
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {countOptions.map(n => (
            <button
              key={n}
              onClick={() => setTestCount(n)}
              style={{
                height: '36px', padding: '0 16px', borderRadius: '999px',
                background: testCount === n ? color + '18' : '#161B22',
                color: testCount === n ? color : '#8B949E',
                border: `1px solid ${testCount === n ? color + '55' : '#21262D'}`,
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {n === total ? `All ${n}` : n}
            </button>
          ))}
        </div>
      </div>

      {/* Shuffle */}
      <div style={{ marginBottom: '32px' }}>
        <Toggle on={shuffle} color={color} onChange={() => setShuffle(s => !s)} label="Shuffle questions" />
      </div>

      <button
        onClick={() => onStart(testCount, shuffle, mode)}
        style={{
          height: '46px', padding: '0 40px', borderRadius: '999px',
          background: color, color: '#fff',
          border: 'none', fontSize: '14px', fontWeight: 700,
          cursor: 'pointer',
          boxShadow: `0 4px 24px ${color}40, 0 1px 0 rgba(255,255,255,0.12) inset`,
          transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.02)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
      >
        Begin →
      </button>
    </div>
  );
}

// ── Focused mode (one question at a time) ─────────────────────────────────────

function FocusedMode({ questions, color, onComplete }: {
  questions: GeneratedQuizQuestion[];
  color: string;
  onComplete: (pct: number, score: number, total: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const q = questions[idx];
  const correct = Number(q.correct);
  const isCorrect = chosen === correct;
  const total = questions.length;
  const progress = (idx / total) * 100;

  const score = scores.filter(Boolean).length;
  const finalPct = Math.round((score / total) * 100);
  const counted = useCountUp(finalPct, done);

  function pick(oi: number) {
    if (revealed) return;
    setChosen(oi);
    setRevealed(true);
  }

  function next() {
    const newScores = [...scores, chosen === correct];
    setScores(newScores);
    if (idx + 1 >= total) {
      const s = newScores.filter(Boolean).length;
      const p = Math.round((s / total) * 100);
      setDone(true);
      onComplete(p, s, total);
    } else {
      setAnimKey(k => k + 1);
      setIdx(i => i + 1);
      setChosen(null);
      setRevealed(false);
    }
  }

  if (done) {
    const s = scores.filter(Boolean).length;
    return <ScoreScreen score={s} total={total} pct={counted} color={color} onRetry={() => { setIdx(0); setChosen(null); setRevealed(false); setScores([]); setDone(false); setAnimKey(k => k + 1); }} />;
  }

  return (
    <div style={{ maxWidth: '620px' }}>
      {/* Progress header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#484F58', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Question {idx + 1} of {total}
          </span>
          <span className="mono" style={{ fontSize: '11px', color: color, fontWeight: 700 }}>
            {scores.filter(Boolean).length} correct
          </span>
        </div>
        <div style={{ height: '3px', background: '#161B22', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '999px',
            background: color,
            width: `${progress}%`,
            transition: 'width 0.4s cubic-bezier(0,0,0.2,1)',
            boxShadow: `0 0 8px ${color}80`,
          }} />
        </div>
      </div>

      {/* Question card */}
      <div
        key={animKey}
        ref={cardRef}
        className="anim-fadein"
        style={{
          background: '#161B22', border: '1px solid #21262D', borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 2px 20px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Question */}
        <div style={{ padding: '28px 28px 24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#E6EDF3', lineHeight: 1.65 }}>
            {q.question}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#21262D', margin: '0 28px' }} />

        {/* Options */}
        <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {q.options.map((opt, oi) => {
            const isChosen = chosen === oi;
            const isRight = revealed && oi === correct;
            const isWrong = revealed && isChosen && !isRight;

            let bg = 'transparent';
            let border = '#21262D';
            let textCol = '#8B949E';
            let letterBg = '#21262D';
            let letterCol = '#8B949E';

            if (isChosen && !revealed) {
              bg = color + '0F'; border = color + '55'; textCol = '#E6EDF3';
              letterBg = color + '22'; letterCol = color;
            }
            if (isRight) {
              bg = 'rgba(46,160,67,0.09)'; border = 'rgba(46,160,67,0.4)'; textCol = '#56D364';
              letterBg = 'rgba(46,160,67,0.25)'; letterCol = '#56D364';
            }
            if (isWrong) {
              bg = 'rgba(248,81,73,0.09)'; border = 'rgba(248,81,73,0.4)'; textCol = '#F97979';
              letterBg = 'rgba(248,81,73,0.25)'; letterCol = '#F97979';
            }

            return (
              <button
                key={oi}
                disabled={revealed}
                onClick={() => pick(oi)}
                className={isRight ? 'anim-correct' : isWrong ? 'anim-shake' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', borderRadius: '12px',
                  border: `1px solid ${border}`, background: bg,
                  cursor: revealed ? 'default' : 'pointer',
                  textAlign: 'left', width: '100%',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => { if (!revealed) { (e.currentTarget as HTMLElement).style.background = color + '08'; (e.currentTarget as HTMLElement).style.borderColor = color + '33'; }}}
                onMouseLeave={e => { if (!revealed) { (e.currentTarget as HTMLElement).style.background = bg; (e.currentTarget as HTMLElement).style.borderColor = border; }}}
              >
                <span style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: letterBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 800, color: letterCol,
                  transition: 'all 0.15s ease',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {isRight ? (
                    <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
                      <path d="M2 6l2.5 2.5L10 3.5" stroke={letterCol} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : LETTERS[oi]}
                </span>
                <span style={{ fontSize: '13px', color: textCol, fontWeight: isChosen || isRight ? 500 : 400, lineHeight: 1.5 }}>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {revealed && q.explanation && (
          <div
            className="anim-fadein"
            style={{
              margin: '0 20px 20px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: isCorrect ? 'rgba(46,160,67,0.07)' : 'rgba(248,81,73,0.07)',
              border: `1px solid ${isCorrect ? 'rgba(46,160,67,0.2)' : 'rgba(248,81,73,0.2)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{
                width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                background: isCorrect ? 'rgba(46,160,67,0.25)' : 'rgba(248,81,73,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isCorrect ? (
                  <svg viewBox="0 0 10 10" width="9" height="9" fill="none"><path d="M2 5l2 2 4-4" stroke="#56D364" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg viewBox="0 0 10 10" width="9" height="9" fill="none"><path d="M3 3l4 4M7 3l-4 4" stroke="#F97979" strokeWidth="1.5" strokeLinecap="round" /></svg>
                )}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: isCorrect ? '#56D364' : '#F97979', letterSpacing: '0.05em' }}>
                {isCorrect ? 'CORRECT' : 'INCORRECT'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#8B949E', lineHeight: 1.6, margin: 0 }}>
              {q.explanation}
            </p>
          </div>
        )}

        {/* Next button */}
        {revealed && (
          <div className="anim-fadein" style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={next}
              style={{
                height: '38px', padding: '0 24px', borderRadius: '999px',
                background: color, color: '#fff', border: 'none',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 2px 12px ${color}40`,
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                letterSpacing: '0.03em',
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

// ── Score screen ───────────────────────────────────────────────────────────────

function ScoreScreen({ score, total, pct, color, onRetry }: {
  score: number; total: number; pct: number; color: string; onRetry: () => void;
}) {
  const grade = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good job' : pct >= 60 ? 'Decent' : 'Keep studying';
  const gradeColor = pct >= 90 ? '#56D364' : pct >= 75 ? color : pct >= 60 ? '#D29922' : '#F97979';

  return (
    <div className="anim-fadein" style={{ maxWidth: '420px' }}>
      <div style={{
        padding: '32px', borderRadius: '20px',
        background: `radial-gradient(130% 150% at 0% 0%, ${color}0E 0%, #161B22 60%)`,
        border: `1px solid ${color}25`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
        marginBottom: '20px',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#484F58', marginBottom: '8px' }}>
            Quiz complete
          </div>
          <div className="mono" style={{ fontSize: '4rem', fontWeight: 700, lineHeight: 1, color: gradeColor, letterSpacing: '-0.02em' }}>
            {pct}%
          </div>
          <div style={{ fontSize: '14px', color: gradeColor, marginTop: '6px', fontWeight: 600 }}>
            {grade}
          </div>
        </div>

        {/* Bar */}
        <div style={{ height: '6px', background: '#21262D', borderRadius: '999px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{
            height: '100%', borderRadius: '999px',
            background: `linear-gradient(90deg, ${gradeColor}88, ${gradeColor})`,
            width: `${pct}%`,
            transition: 'width 1s cubic-bezier(0,0,0.2,1)',
            boxShadow: `0 0 10px ${gradeColor}60`,
          }} />
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <div>
            <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#56D364' }}>{score}</div>
            <div style={{ fontSize: '11px', color: '#484F58' }}>correct</div>
          </div>
          <div style={{ width: '1px', background: '#21262D', alignSelf: 'stretch' }} />
          <div>
            <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#F97979' }}>{total - score}</div>
            <div style={{ fontSize: '11px', color: '#484F58' }}>incorrect</div>
          </div>
          <div style={{ width: '1px', background: '#21262D', alignSelf: 'stretch' }} />
          <div>
            <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#E6EDF3' }}>{total}</div>
            <div style={{ fontSize: '11px', color: '#484F58' }}>total</div>
          </div>
        </div>
      </div>

      <button
        onClick={onRetry}
        style={{
          height: '42px', padding: '0 28px', borderRadius: '999px',
          background: color + '18', color, border: `1px solid ${color}40`,
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = color + '28'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = color + '18'; }}
      >
        Try again
      </button>
    </div>
  );
}

// ── Test mode (all at once) ────────────────────────────────────────────────────

function TestMode({ questions, color, onComplete }: {
  questions: GeneratedQuizQuestion[];
  color: string;
  onComplete: (pct: number, score: number, total: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [shakingId, setShakingId] = useState<string | null>(null);

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
    const s = questions.filter(q => answers[q.id] === Number(q.correct)).length;
    const p = questions.length > 0 ? Math.round((s / questions.length) * 100) : 0;
    setSubmitted(true);
    onComplete(p, s, questions.length);
  }

  return (
    <div>
      {/* Score banner */}
      {submitted && (
        <div className="anim-fadein" style={{
          padding: '20px 24px', borderRadius: '16px', marginBottom: '20px',
          background: `radial-gradient(120% 140% at 0% 0%, ${color}0E 0%, #161B22 55%)`,
          border: `1px solid ${color}28`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span className="mono" style={{ fontSize: '2.8rem', color, lineHeight: 1, fontWeight: 700 }}>{counted}%</span>
              <span style={{ fontSize: '13px', color: '#8B949E' }}>{score} / {questions.length} correct</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setAnswers({}); setSubmitted(false); }}
                style={{ height: '32px', padding: '0 14px', borderRadius: '999px', background: '#1F2937', color: '#E6EDF3', border: '1px solid #30363D', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
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
          const isAnswered = chosen !== undefined;
          const reveal = submitted;
          const isCorrect = reveal && chosen === Number(q.correct);
          const answeredCorrectly = isAnswered && chosen === Number(q.correct);
          const isShaking = shakingId === q.id;

          return (
            <div
              key={q.id}
              className={isShaking ? 'anim-shake' : ''}
              style={{
                background: '#161B22',
                border: `1px solid ${submitted && isAnswered ? (isCorrect ? 'rgba(46,160,67,0.3)' : 'rgba(248,81,73,0.3)') : '#21262D'}`,
                borderRadius: '16px', overflow: 'hidden',
                transition: 'border-color 0.2s ease',
              }}
            >
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
                  const isChosen = chosen === oi;
                  const isRight = reveal && oi === Number(q.correct);
                  const isWrong = reveal && isChosen && !isRight;

                  let bg = 'transparent';
                  let border = '#21262D';
                  let textCol = '#8B949E';
                  let letterBg = '#21262D';
                  let letterCol = '#8B949E';

                  if (isChosen && !submitted) { bg = color + '0F'; border = color + '44'; textCol = '#E6EDF3'; letterBg = color + '22'; letterCol = color; }
                  if (isRight) { bg = 'rgba(46,160,67,0.08)'; border = 'rgba(46,160,67,0.35)'; textCol = '#56D364'; letterBg = 'rgba(46,160,67,0.2)'; letterCol = '#56D364'; }
                  if (isWrong) { bg = 'rgba(248,81,73,0.08)'; border = 'rgba(248,81,73,0.35)'; textCol = '#F97979'; letterBg = 'rgba(248,81,73,0.2)'; letterCol = '#F97979'; }

                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => handleAnswer(q.id, oi, Number(q.correct))}
                      className={isRight ? 'anim-correct' : ''}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '10px',
                        border: `1px solid ${border}`, background: bg,
                        cursor: submitted ? 'default' : 'pointer',
                        textAlign: 'left', width: '100%',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span style={{
                        width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                        background: letterBg, color: letterCol,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {isRight ? (
                          <svg viewBox="0 0 10 10" width="9" height="9" fill="none"><path d="M2 5l2 2 4-4" stroke={letterCol} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : LETTERS[oi]}
                      </span>
                      <span style={{ fontSize: '12px', color: textCol, lineHeight: 1.4 }}>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {reveal && q.explanation && (
                <div className="anim-fadein" style={{
                  margin: '0 12px 14px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: answeredCorrectly ? 'rgba(46,160,67,0.07)' : 'rgba(248,81,73,0.07)',
                  border: `1px solid ${answeredCorrectly ? 'rgba(46,160,67,0.18)' : 'rgba(248,81,73,0.18)'}`,
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: answeredCorrectly ? '#56D364' : '#F97979', marginRight: '6px' }}>
                    {answeredCorrectly ? '✓ Correct.' : '✗ Incorrect.'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#8B949E', lineHeight: 1.55 }}>{q.explanation}</span>
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
              transition: 'all 0.15s ease',
              boxShadow: answered === questions.length ? `0 2px 16px ${color}40` : 'none',
            }}
          >
            Check Answers
          </button>
          {answered < questions.length && (
            <span style={{ fontSize: '12px', color: '#484F58' }}>
              {answered} / {questions.length} answered
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function QuizViewer({ questions, color, onComplete }: {
  questions: GeneratedQuizQuestion[];
  color: string;
  onComplete?: (pct: number, score: number, total: number) => void;
}) {
  const [started, setStarted] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [quizMode, setQuizMode] = useState<'focused' | 'test'>('focused');

  function startTest(count: number, shuffle: boolean, mode: 'focused' | 'test') {
    const pool = shuffle ? [...questions].sort(() => Math.random() - 0.5) : [...questions];
    setActiveQuestions(pool.slice(0, count));
    setQuizMode(mode);
    setStarted(true);
  }

  if (!started) {
    return <SetupScreen total={questions.length} color={color} onStart={startTest} />;
  }

  if (quizMode === 'focused') {
    return (
      <FocusedMode
        key={activeQuestions.map(q => q.id).join(',')}
        questions={activeQuestions}
        color={color}
        onComplete={(pct, score, total) => onComplete?.(pct, score, total)}
      />
    );
  }

  return (
    <TestMode
      key={activeQuestions.map(q => q.id).join(',')}
      questions={activeQuestions}
      color={color}
      onComplete={(pct, score, total) => onComplete?.(pct, score, total)}
    />
  );
}

import { useState, useEffect } from 'react';
import type { GeneratedQuizQuestion } from '../lib/generator';

function useCountUp(target: number, active: boolean, duration = 1000) {
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

// ── Setup screen ───────────────────────────────────────────────────────────────

function Toggle({ on, color, onChange, label }: { on: boolean; color: string; onChange: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button
        onClick={onChange}
        style={{
          width: '36px', height: '20px', borderRadius: '999px',
          background: on ? color : '#30363D',
          border: 'none', cursor: 'pointer', position: 'relative',
          flexShrink: 0, transition: 'background 0.25s ease',
        }}
        aria-label={label}
      >
        <span style={{
          position: 'absolute', top: '2px',
          left: on ? '18px' : '2px',
          width: '16px', height: '16px',
          borderRadius: '50%', background: '#E6EDF3',
          transition: 'left 0.25s ease',
        }} />
      </button>
      <span style={{ fontSize: '13px', color: on ? '#E6EDF3' : '#8B949E', transition: 'color 0.2s' }}>
        {label}
      </span>
    </div>
  );
}

function SetupScreen({
  total, color, onStart,
}: {
  total: number;
  color: string;
  onStart: (count: number, shuffle: boolean, immediate: boolean) => void;
}) {
  const rawOptions = [5, 10, 15, 20].filter(n => n < total);
  const countOptions = [...rawOptions, total];
  const defaultCount = countOptions.find(n => n >= Math.min(10, total)) ?? total;
  const [testCount, setTestCount] = useState(defaultCount);
  const [shuffle, setShuffle] = useState(true);
  const [immediate, setImmediate] = useState(false);

  return (
    <div style={{ maxWidth: '420px', paddingTop: '8px' }}>
      {/* Stat */}
      <div style={{ marginBottom: '28px' }}>
        <div className="mono" style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color }}>
          {total}
        </div>
        <div style={{ fontSize: '13px', color: '#8B949E', marginTop: '4px' }}>
          questions ready
        </div>
      </div>

      {/* Count selector */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '10px' }}>
          How many questions?
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {countOptions.map(n => (
            <button
              key={n}
              onClick={() => setTestCount(n)}
              style={{
                height: '38px', padding: '0 18px',
                borderRadius: '999px',
                background: testCount === n ? color + '1A' : '#161B22',
                color: testCount === n ? color : '#8B949E',
                border: `1px solid ${testCount === n ? color + '55' : '#30363D'}`,
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {n === total ? `All ${n}` : n}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
        <Toggle on={shuffle} color={color} onChange={() => setShuffle(s => !s)} label="Shuffle questions" />
        <Toggle on={immediate} color={color} onChange={() => setImmediate(s => !s)} label="Reveal answer after each question" />
      </div>

      {/* Start */}
      <button
        onClick={() => onStart(testCount, shuffle, immediate)}
        style={{
          height: '44px', padding: '0 36px',
          borderRadius: '999px',
          background: color,
          color: '#0D1117',
          border: 'none',
          fontSize: '14px', fontWeight: 700,
          cursor: 'pointer',
          boxShadow: `0 4px 20px ${color}44, 0 1px 0 rgba(255,255,255,0.15) inset`,
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.02)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
      >
        Start Test
      </button>
    </div>
  );
}

// ── Quiz viewer ────────────────────────────────────────────────────────────────

export function QuizViewer({ questions, color }: { questions: GeneratedQuizQuestion[]; color: string }) {
  const [started, setStarted] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [shakingId, setShakingId] = useState<string | null>(null);
  const [immediateReveal, setImmediateReveal] = useState(false);

  const score = submitted ? activeQuestions.filter(q => answers[q.id] === Number(q.correct)).length : 0;
  const pct = submitted && activeQuestions.length > 0 ? Math.round((score / activeQuestions.length) * 100) : 0;
  const answered = Object.keys(answers).length;
  const countedScore = useCountUp(pct, submitted);

  function startTest(count: number, shuffle: boolean, immediate: boolean) {
    const pool = shuffle ? [...questions].sort(() => Math.random() - 0.5) : [...questions];
    setActiveQuestions(pool.slice(0, count));
    setAnswers({});
    setSubmitted(false);
    setImmediateReveal(immediate);
    setStarted(true);
  }

  function reset() {
    setAnswers({});
    setSubmitted(false);
    setStarted(false);
  }

  function handleAnswer(questionId: string, optionIndex: number, correctIndex: number) {
    setAnswers(a => ({ ...a, [questionId]: optionIndex }));
    if (optionIndex !== correctIndex) {
      setShakingId(questionId);
      setTimeout(() => setShakingId(null), 400);
    }
  }

  if (!started) {
    return <SetupScreen total={questions.length} color={color} onStart={startTest} />;
  }

  return (
    <div>
      {/* Score banner */}
      {submitted && (
        <div
          className="rounded-xl px-6 py-4 mb-5 flex items-center justify-between anim-fadein"
          style={{
            background: '#161B22',
            border: `1px solid ${color}30`,
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-baseline gap-2">
            <span className="mono leading-none" style={{ fontSize: '3rem', color }}>{countedScore}%</span>
            <span className="text-sm" style={{ color: '#8B949E' }}>
              {score} / {activeQuestions.length} correct
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setAnswers({}); setSubmitted(false); }}
              className="h-8 px-4 text-xs font-medium cursor-pointer transition-colors duration-150"
              style={{ background: '#1F2937', color: '#E6EDF3', border: '1px solid #30363D', borderRadius: '999px' }}
            >
              Retry same
            </button>
            <button
              onClick={reset}
              className="h-8 px-4 text-xs font-medium cursor-pointer transition-colors duration-150"
              style={{ background: color + '18', color, border: `1px solid ${color}40`, borderRadius: '999px' }}
            >
              New test
            </button>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="flex flex-col gap-3">
        {activeQuestions.map((q, qi) => {
          const chosen = answers[q.id];
          const isAnswered = chosen !== undefined;
          const reveal = submitted || (immediateReveal && isAnswered);
          const isCorrect = reveal && chosen === Number(q.correct);
          const answeredCorrectly = isAnswered && chosen === Number(q.correct);
          const isShaking = shakingId === q.id;

          return (
            <div
              key={q.id}
              className={`rounded-xl p-5 border transition-colors duration-200${isShaking ? ' anim-shake' : ''}`}
              style={{
                background: '#161B22',
                borderColor: submitted && isAnswered
                  ? (isCorrect ? 'rgba(46,160,67,0.35)' : 'rgba(248,81,73,0.35)')
                  : '#30363D',
                boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
              }}
            >
              <p className="text-sm font-medium leading-relaxed m-0 mb-4" style={{ color: '#E6EDF3' }}>
                <span className="mono text-xs mr-2.5" style={{ color: '#8B949E' }}>
                  {String(qi + 1).padStart(2, '0')}
                </span>
                {q.question}
              </p>

              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isRight = reveal && oi === Number(q.correct);
                  const isWrong = reveal && isChosen && !isRight;

                  let bg = '#1F2937';
                  let border = '#30363D';
                  let textCol = '#8B949E';
                  let badgeColor = border;

                  if (isChosen && !submitted) { bg = color + '12'; border = color + '55'; textCol = '#E6EDF3'; badgeColor = color; }
                  if (isRight) { bg = 'rgba(46,160,67,0.1)'; border = 'rgba(46,160,67,0.45)'; textCol = '#56D364'; badgeColor = '#2EA043'; }
                  if (isWrong) { bg = 'rgba(248,81,73,0.1)'; border = 'rgba(248,81,73,0.45)'; textCol = '#F97979'; badgeColor = '#F85149'; }

                  return (
                    <button
                      key={oi}
                      disabled={submitted || (immediateReveal && isAnswered)}
                      onClick={() => handleAnswer(q.id, oi, Number(q.correct))}
                      className={`flex items-center gap-3 w-full text-left px-3.5 py-3 border text-sm cursor-pointer disabled:cursor-default transition-all duration-150${isRight ? ' anim-correct' : ''}`}
                      style={{ background: bg, borderColor: border, color: textCol, borderRadius: '8px', minHeight: '44px' }}
                    >
                      <span
                        className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-[10px] font-bold rounded"
                        style={{ background: (isRight || isWrong) ? badgeColor : 'transparent', border: `1px solid ${badgeColor}`, color: (isRight || isWrong) ? '#E6EDF3' : textCol }}
                      >
                        {isRight ? (
                          <svg viewBox="0 0 12 12" width="9" height="9" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke="#E6EDF3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {reveal && q.explanation && (
                <div
                  className="mt-3 px-3.5 py-3 rounded-lg text-xs leading-relaxed anim-fadein"
                  style={{
                    background: answeredCorrectly ? 'rgba(46,160,67,0.08)' : 'rgba(248,81,73,0.08)',
                    border: `1px solid ${answeredCorrectly ? 'rgba(46,160,67,0.2)' : 'rgba(248,81,73,0.2)'}`,
                    color: '#8B949E',
                  }}
                >
                  <span className="font-semibold mr-1" style={{ color: answeredCorrectly ? '#56D364' : '#F97979' }}>
                    {answeredCorrectly ? '✓ Correct.' : '✗ Incorrect.'}
                  </span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      {!submitted && answered > 0 && (
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={() => setSubmitted(true)}
            disabled={answered < activeQuestions.length}
            className="h-10 px-6 text-sm font-semibold border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all duration-150"
            style={{
              background: answered === activeQuestions.length ? '#3D7EFF' : '#1F2937',
              color: answered === activeQuestions.length ? '#E6EDF3' : '#8B949E',
              borderRadius: '999px',
            }}
          >
            Check Answers
          </button>
          {answered < activeQuestions.length && (
            <span className="text-xs" style={{ color: '#8B949E' }}>
              {answered} / {activeQuestions.length} answered
            </span>
          )}
        </div>
      )}
    </div>
  );
}

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

export function QuizViewer({ questions, color }: { questions: GeneratedQuizQuestion[]; color: string }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [shakingId, setShakingId] = useState<string | null>(null);

  // q.correct can arrive as a string ("1") from the model even though the type
  // says number — coerce at every comparison so strict === never silently fails.
  const score = submitted ? questions.filter(q => answers[q.id] === Number(q.correct)).length : 0;
  const pct = submitted ? Math.round((score / questions.length) * 100) : 0;
  const answered = Object.keys(answers).length;
  const countedScore = useCountUp(pct, submitted);
  const reset = () => { setAnswers({}); setSubmitted(false); };

  function handleAnswer(questionId: string, optionIndex: number, correctIndex: number) {
    setAnswers(a => ({ ...a, [questionId]: optionIndex }));
    if (optionIndex !== correctIndex) {
      setShakingId(questionId);
      setTimeout(() => setShakingId(null), 400);
    }
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
              {score} / {questions.length} correct
            </span>
          </div>
          <button
            onClick={reset}
            className="h-8 px-4 text-xs font-medium border cursor-pointer transition-colors duration-150"
            style={{ background: '#1F2937', color: '#E6EDF3', border: '1px solid #30363D', borderRadius: '7px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Questions */}
      <div className="flex flex-col gap-3">
        {questions.map((q, qi) => {
          const chosen = answers[q.id];
          const isAnswered = chosen !== undefined;
          const isCorrect = submitted && chosen === Number(q.correct);
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
                  const isRight = submitted && oi === Number(q.correct);
                  const isWrong = submitted && isChosen && !isRight;

                  let bg = '#1F2937';
                  let border = '#30363D';
                  let textCol = '#8B949E';
                  let badgeColor = border;

                  if (isChosen && !submitted) {
                    bg = color + '12';
                    border = color + '55';
                    textCol = '#E6EDF3';
                    badgeColor = color;
                  }
                  if (isRight) {
                    bg = 'rgba(46,160,67,0.1)';
                    border = 'rgba(46,160,67,0.45)';
                    textCol = '#56D364';
                    badgeColor = '#2EA043';
                  }
                  if (isWrong) {
                    bg = 'rgba(248,81,73,0.1)';
                    border = 'rgba(248,81,73,0.45)';
                    textCol = '#F97979';
                    badgeColor = '#F85149';
                  }

                  return (
                    <button
                      key={oi}
                      disabled={submitted}
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

              {/* Explanation — slides down after answer */}
              {isAnswered && q.explanation && (
                <div
                  className="mt-3 px-3.5 py-3 rounded-lg text-xs leading-relaxed anim-fadein"
                  style={{
                    background: isCorrect ? 'rgba(46,160,67,0.08)' : 'rgba(248,81,73,0.08)',
                    border: `1px solid ${isCorrect ? 'rgba(46,160,67,0.2)' : 'rgba(248,81,73,0.2)'}`,
                    color: '#8B949E',
                  }}
                >
                  <span className="font-semibold mr-1" style={{ color: isCorrect ? '#56D364' : '#F97979' }}>
                    {isCorrect ? '✓ Correct.' : '✗ Incorrect.'}
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
            disabled={answered < questions.length}
            className="h-10 px-6 text-sm font-semibold border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all duration-150"
            style={{
              background: answered === questions.length ? '#3D7EFF' : '#1F2937',
              color: answered === questions.length ? '#E6EDF3' : '#8B949E',
              borderRadius: '8px',
            }}
          >
            Check Answers
          </button>
          {answered < questions.length && (
            <span className="text-xs" style={{ color: '#8B949E' }}>
              {answered} / {questions.length} answered
            </span>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { GeneratedQuizQuestion } from '../lib/generator';

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
    <path d="M3 8l3.5 3.5L13 5" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function QuizViewer({ questions, color }: { questions: GeneratedQuizQuestion[]; color: string }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = submitted ? questions.filter(q => answers[q.id] === q.correct).length : 0;
  const answered = Object.keys(answers).length;
  const reset = () => { setAnswers({}); setSubmitted(false); };

  return (
    <div>
      {/* Score banner (post-submit) */}
      {submitted && (
        <div
          className="rounded-3xl px-6 py-4 mb-5 flex items-center justify-between border"
          style={{
            backgroundColor: '#1D1B20',
            borderColor: color + '30',
          }}
        >
          <div className="flex items-baseline gap-2">
            <span className="tabular-nums text-5xl leading-none font-display" style={{ color }}>
              {score}
            </span>
            <span className="text-md-on-surface-variant text-sm">
              / {questions.length} correct
            </span>
          </div>
          <button
            onClick={reset}
            className="h-9 px-5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer bg-md-surface-container text-md-on-surface border-md-outline-variant hover:bg-md-surface-container-high"
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
          const isCorrect = submitted && chosen === q.correct;

          return (
            <div
              key={q.id}
              className="bg-md-surface-container rounded-3xl p-5 border transition-all duration-300"
              style={{
                borderColor: submitted && isAnswered
                  ? (isCorrect ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)')
                  : 'var(--color-md-outline-variant)',
              }}
            >
              <div className="text-md-on-surface text-sm font-medium leading-relaxed mb-4">
                <span className="tabular-nums text-md-on-surface-variant text-xs font-normal mr-2.5">
                  {String(qi + 1).padStart(2, '0')}
                </span>
                {q.question}
              </div>

              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isRight = submitted && oi === q.correct;

                  let bg = 'var(--color-md-surface-container-high)';
                  let border = 'var(--color-md-outline-variant)';
                  let textCol = 'var(--color-md-on-surface-variant)';

                  if (isChosen && !submitted) {
                    bg = color + '15';
                    border = color + '60';
                    textCol = 'var(--color-md-on-surface)';
                  }
                  if (isRight) {
                    bg = 'rgba(74,222,128,0.10)';
                    border = 'rgba(74,222,128,0.35)';
                    textCol = '#4ade80';
                  }
                  if (submitted && isChosen && !isRight) {
                    bg = 'rgba(248,113,113,0.10)';
                    border = 'rgba(248,113,113,0.35)';
                    textCol = '#f87171';
                  }

                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                      className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 rounded-2xl text-sm border transition-all duration-200 cursor-pointer disabled:cursor-default min-h-[44px]"
                      style={{ backgroundColor: bg, borderColor: border, color: textCol }}
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold border transition-all duration-200"
                        style={{ borderColor: border, color: textCol }}
                      >
                        {isRight ? <CheckIcon /> : String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {submitted && isAnswered && !isCorrect && q.explanation && (
                <div className="mt-3 px-4 py-2.5 bg-md-surface-container-high rounded-2xl text-xs text-md-on-surface-variant leading-relaxed">
                  <span className="text-md-primary font-semibold">Note: </span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {!submitted && answered > 0 && (
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={() => setSubmitted(true)}
            disabled={answered < questions.length}
            className="h-11 px-8 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-default border-0"
            style={{
              backgroundColor: answered === questions.length ? '#D0BCFF' : 'var(--color-md-surface-container-high)',
              color: answered === questions.length ? '#381E72' : 'var(--color-md-on-surface-variant)',
            }}
          >
            Check Answers
          </button>
          {answered < questions.length && (
            <span className="text-md-on-surface-variant text-xs">
              {answered} / {questions.length} answered
            </span>
          )}
        </div>
      )}
    </div>
  );
}

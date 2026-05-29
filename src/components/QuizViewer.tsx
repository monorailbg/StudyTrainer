import { useState } from 'react';
import type { GeneratedQuizQuestion } from '../lib/generator';

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
    <path d="M3 8l3.5 3.5L13 5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
      {/* Score bar (post-submit) */}
      {submitted && (
        <div style={{
          backgroundColor: '#0d1a2e',
          border: `1px solid ${color}30`,
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '2.4rem', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px', color: '#4a5a6e' }}>
              / {questions.length} correct
            </span>
          </div>
          <button
            onClick={reset}
            style={{
              height: '36px', padding: '0 16px', borderRadius: '8px',
              backgroundColor: '#162236', border: '1px solid #2d4465',
              color: '#94a3b8', cursor: 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {questions.map((q, qi) => {
          const chosen = answers[q.id];
          const isAnswered = chosen !== undefined;
          const isCorrect = submitted && chosen === q.correct;

          return (
            <div
              key={q.id}
              style={{
                backgroundColor: '#0d1a2e',
                border: `1px solid ${submitted && isAnswered ? (isCorrect ? '#4ade8030' : '#f8717130') : '#1e2d45'}`,
                borderRadius: '12px',
                padding: '18px 20px',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: '14px', fontWeight: 500, color: '#f0f4f8',
                marginBottom: '14px', lineHeight: 1.5,
              }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#4a5a6e', fontWeight: 400, marginRight: '10px', fontVariantNumeric: 'tabular-nums' }}>
                  {String(qi + 1).padStart(2, '0')}
                </span>
                {q.question}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isRight = submitted && oi === q.correct;
                  let borderColor = '#1e2d45';
                  let bgColor = '#162236';
                  let textColor = '#94a3b8';
                  if (isChosen && !submitted) { borderColor = color + '50'; bgColor = color + '12'; textColor = '#f0f4f8'; }
                  if (isRight) { borderColor = '#4ade8030'; bgColor = '#4ade8010'; textColor = '#4ade80'; }
                  if (submitted && isChosen && !isRight) { borderColor = '#f8717130'; bgColor = '#f8717110'; textColor = '#f87171'; }

                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', textAlign: 'left',
                        padding: '9px 14px', borderRadius: '8px',
                        backgroundColor: bgColor, border: `1px solid ${borderColor}`,
                        color: textColor, cursor: submitted ? 'default' : 'pointer',
                        fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px',
                        transition: 'all 0.15s', minHeight: '44px',
                      }}
                    >
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        border: `1.5px solid ${borderColor}`, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace',
                        transition: 'border-color 0.15s',
                      }}>
                        {isRight ? <CheckIcon /> : String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {submitted && isAnswered && !isCorrect && q.explanation && (
                <div style={{
                  marginTop: '10px', padding: '10px 14px',
                  backgroundColor: '#162236', borderRadius: '8px', borderLeft: 'none',
                  fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#94a3b8', lineHeight: 1.55,
                }}>
                  <span style={{ color: '#d4a843', fontWeight: 600 }}>Note: </span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      {!submitted && answered > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => setSubmitted(true)}
            disabled={answered < questions.length}
            style={{
              height: '44px', padding: '0 32px', borderRadius: '8px',
              backgroundColor: answered === questions.length ? '#d4a843' : '#162236',
              border: answered === questions.length ? 'none' : '1px solid #1e2d45',
              color: answered === questions.length ? '#07111f' : '#2d4465',
              cursor: answered === questions.length ? 'pointer' : 'default',
              fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            Check Answers
          </button>
          {answered < questions.length && (
            <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#4a5a6e' }}>
              {answered} / {questions.length} answered
            </span>
          )}
        </div>
      )}
    </div>
  );
}

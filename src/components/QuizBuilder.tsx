import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import type { GeneratedQuizQuestion } from '../lib/generator';

// ── Manual quiz builder ───────────────────────────────────────────────────
//
// Modal for composing a quiz by hand — no AI, no source file. Questions are
// written from scratch and saved through the same StoredQuiz/CloudQuiz path
// as generated quizzes, so everything downstream (viewer, history, redo,
// folders) works on them unchanged.

interface DraftQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const emptyQuestion = (): DraftQuestion => ({ question: '', options: ['', ''], correct: 0, explanation: '' });

export function QuizBuilder({ color, onSave, onClose }: {
  color: string;
  onSave: (name: string, questions: GeneratedQuizQuestion[]) => void;
  onClose: () => void;
}) {
  const { ts } = useLang();
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);

  const updateQuestion = (qi: number, patch: Partial<DraftQuestion>) => {
    setQuestions(prev => prev.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  };
  const updateOption = (qi: number, oi: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qi) return q;
      const options = q.options.map((o, j) => (j === oi ? value : o));
      return { ...q, options };
    }));
  };
  const addOption = (qi: number) => {
    setQuestions(prev => prev.map((q, i) => (i === qi && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q)));
  };
  const removeOption = (qi: number, oi: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qi || q.options.length <= 2) return q;
      const options = q.options.filter((_, j) => j !== oi);
      // Keep the correct marker on the same option, or clamp it if that
      // option was the one removed.
      const correct = q.correct === oi ? 0 : q.correct > oi ? q.correct - 1 : q.correct;
      return { ...q, options, correct };
    }));
  };
  const removeQuestion = (qi: number) => {
    setQuestions(prev => (prev.length > 1 ? prev.filter((_, i) => i !== qi) : prev));
  };

  const questionValid = (q: DraftQuestion) =>
    q.question.trim().length > 0 &&
    q.options.filter(o => o.trim().length > 0).length >= 2 &&
    q.options[q.correct]?.trim().length > 0;

  const canSave = name.trim().length > 0 && questions.length > 0 && questions.every(questionValid);

  const save = () => {
    if (!canSave) return;
    const built: GeneratedQuizQuestion[] = questions.map((q, i) => {
      // Drop blank trailing options; remap the correct index onto the kept set.
      const keptIdx = q.options.map((o, j) => (o.trim() ? j : -1)).filter(j => j !== -1);
      return {
        id: `manual-${Date.now()}-${i}`,
        question: q.question.trim(),
        options: keptIdx.map(j => q.options[j].trim()),
        correct: keptIdx.indexOf(q.correct),
        explanation: q.explanation.trim(),
      };
    });
    onSave(name.trim(), built);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-base)',
    borderRadius: '8px', padding: '8px 12px', fontSize: '13px',
    color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '680px', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
          borderRadius: '20px', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{ts('Create your own quiz')}</div>
          <button
            onClick={onClose}
            aria-label={ts('Close')}
            style={{
              width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
              color: 'var(--text-3)', fontSize: '13px', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
            {ts('Quiz name')}
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={ts('e.g. Chapter 4 review')}
            autoFocus
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
          {questions.map((q, qi) => (
            <div key={qi} style={{ borderRadius: '14px', border: '1px solid var(--border-light)', background: 'var(--bg-elevated)', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="mono" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)' }}>
                  {String(qi + 1).padStart(2, '0')}
                </span>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qi)}
                    style={{ background: 'none', border: 'none', color: '#F97979', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    {ts('Remove question')}
                  </button>
                )}
              </div>
              <textarea
                value={q.question}
                onChange={e => updateQuestion(qi, { question: e.target.value })}
                placeholder={ts('Question text')}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px', background: 'var(--bg-surface)' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct === oi}
                      onChange={() => updateQuestion(qi, { correct: oi })}
                      title={ts('Mark as correct answer')}
                      style={{ accentColor: color, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <input
                      value={opt}
                      onChange={e => updateOption(qi, oi, e.target.value)}
                      placeholder={`${ts('Option')} ${String.fromCharCode(65 + oi)}`}
                      style={{ ...inputStyle, background: 'var(--bg-surface)' }}
                    />
                    {q.options.length > 2 && (
                      <button
                        onClick={() => removeOption(qi, oi)}
                        aria-label={ts('Remove option')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '13px', padding: '0 2px', flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                {q.options.length < 6 ? (
                  <button
                    onClick={() => addOption(qi)}
                    style={{ background: 'none', border: 'none', color, fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    + {ts('Add option')}
                  </button>
                ) : <span />}
                <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{ts('Select the radio button next to the correct answer')}</span>
              </div>
              <input
                value={q.explanation}
                onChange={e => updateQuestion(qi, { explanation: e.target.value })}
                placeholder={ts('Explanation (optional)')}
                style={{ ...inputStyle, marginTop: '8px', background: 'var(--bg-surface)', fontSize: '12px' }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <button
            onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
            style={{
              height: '36px', padding: '0 16px', borderRadius: '999px', cursor: 'pointer',
              background: 'var(--bg-elevated)', color: 'var(--text-1)', border: '1px solid var(--border-base)',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            + {ts('Add question')}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                height: '36px', padding: '0 16px', borderRadius: '999px', cursor: 'pointer',
                background: 'none', color: 'var(--text-2)', border: '1px solid var(--border-light)',
                fontSize: '12px', fontWeight: 600,
              }}
            >
              {ts('Cancel')}
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              style={{
                height: '36px', padding: '0 20px', borderRadius: '999px',
                background: canSave ? color : 'var(--bg-elevated)',
                color: canSave ? '#fff' : 'var(--text-3)',
                border: 'none', fontSize: '12px', fontWeight: 700,
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {ts('Save quiz')} ({questions.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

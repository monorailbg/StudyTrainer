import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import quizData from '../data/quiz.json';
import type { QuizQuestion } from '../types';

const questions = quizData as QuizQuestion[];
const allTopics = ['All', ...Array.from(new Set(questions.map((q) => q.topic)))];

type Mode = 'setup' | 'quiz' | 'results';
type QuizMode = 'timed' | 'practice';

interface Answer {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  topic: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz() {
  const { addQuizScore } = useStore();
  const [mode, setMode] = useState<Mode>('setup');
  const [quizMode, setQuizMode] = useState<QuizMode>('practice');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [retryWrong, setRetryWrong] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState<string[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ = quizQuestions[currentIndex];

  const startQuiz = useCallback(() => {
    let pool = selectedTopic === 'All' ? questions : questions.filter((q) => q.topic === selectedTopic);
    if (retryWrong && wrongAnswers.length > 0) {
      pool = questions.filter((q) => wrongAnswers.includes(q.id));
    }
    const shuffled = shuffle(pool);
    setQuizQuestions(shuffled);
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setAnswers([]);
    setTimeLeft(30);
    setTimedOut(false);
    setMode('quiz');
  }, [selectedTopic, retryWrong, wrongAnswers]);

  useEffect(() => {
    if (mode !== 'quiz' || quizMode !== 'timed' || selectedOption !== null || timedOut) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setTimedOut(true);
          setShowExplanation(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [mode, quizMode, currentIndex, selectedOption, timedOut]);

  const handleSelect = useCallback((optionIndex: number) => {
    if (selectedOption !== null || timedOut) return;
    clearInterval(timerRef.current!);
    const correct = optionIndex === currentQ.correctIndex;
    setSelectedOption(optionIndex);
    setShowExplanation(true);
    setAnswers((prev) => [...prev, {
      questionId: currentQ.id,
      selectedIndex: optionIndex,
      correct,
      topic: currentQ.topic,
    }]);
  }, [selectedOption, timedOut, currentQ]);

  const handleNext = useCallback(() => {
    if (currentIndex >= quizQuestions.length - 1) {
      const finalAnswers = answers;
      const topics = [...new Set(finalAnswers.map((a) => a.topic))];
      topics.forEach((topic) => {
        const topicAnswers = finalAnswers.filter((a) => a.topic === topic);
        addQuizScore(topic, topicAnswers.filter((a) => a.correct).length, topicAnswers.length);
      });
      const wrong = quizQuestions
        .filter((_, i) => !finalAnswers[i]?.correct)
        .map((q) => q.id);
      setWrongAnswers(wrong);
      setMode('results');
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setShowExplanation(false);
      setTimedOut(false);
      setTimeLeft(30);
    }
  }, [currentIndex, quizQuestions, answers, selectedOption, timedOut, addQuizScore]);

  const handleTimedOut = useCallback(() => {
    if (!timedOut) return;
    setAnswers((prev) => [...prev, {
      questionId: currentQ.id,
      selectedIndex: -1,
      correct: false,
      topic: currentQ.topic,
    }]);
  }, [timedOut, currentQ]);

  useEffect(() => {
    if (timedOut && !answers.find((a) => a.questionId === currentQ?.id)) {
      handleTimedOut();
    }
  }, [timedOut, handleTimedOut, answers, currentQ]);

  const score = answers.filter((a) => a.correct).length;
  const total = quizQuestions.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const topicBreakdown = [...new Set(quizQuestions.map((q) => q.topic))].map((topic) => {
    const topicAnswers = answers.filter((a) => a.topic === topic);
    const correct = topicAnswers.filter((a) => a.correct).length;
    return { topic, correct, total: topicAnswers.length };
  });

  if (mode === 'setup') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div style={{ color: '#8896a8', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '6px' }}>
          Study Mode
        </div>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: '#f0f4f8', margin: '0 0 32px' }}>
          Multiple Choice Quiz
        </h1>

        <div style={{ backgroundColor: '#1a2436', border: '1px solid #243048', borderRadius: '16px', padding: '32px' }}>
          {/* Mode selection */}
          <div className="mb-8">
            <div style={{ color: '#8896a8', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '12px' }}>
              Quiz Mode
            </div>
            <div className="flex gap-4">
              {(['practice', 'timed'] as QuizMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setQuizMode(m)}
                  style={{
                    flex: 1,
                    padding: '16px',
                    backgroundColor: quizMode === m ? 'rgba(201,168,76,0.12)' : '#243048',
                    border: `2px solid ${quizMode === m ? '#c9a84c' : '#4a5568'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontFamily: 'DM Serif Display, serif', color: quizMode === m ? '#c9a84c' : '#f0f4f8', fontSize: '1.1rem', marginBottom: '4px' }}>
                    {m === 'practice' ? 'Practice Mode' : 'Timed Mode'}
                  </div>
                  <div style={{ color: '#8896a8', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    {m === 'practice' ? 'No time limit — learn at your own pace' : '30 seconds per question — test under pressure'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Topic filter */}
          <div className="mb-8">
            <div style={{ color: '#8896a8', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '12px' }}>
              Topic Filter
            </div>
            <div className="flex flex-wrap gap-3">
              {allTopics.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTopic(t)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: selectedTopic === t ? 'rgba(201,168,76,0.12)' : '#243048',
                    border: `1px solid ${selectedTopic === t ? '#c9a84c' : '#4a5568'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: selectedTopic === t ? '#c9a84c' : '#8896a8',
                    fontSize: '13px',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    fontWeight: selectedTopic === t ? 600 : 400,
                  }}
                >
                  {t}
                  <span style={{ color: '#4a5568', marginLeft: '6px', fontSize: '11px' }}>
                    ({t === 'All' ? questions.length : questions.filter((q) => q.topic === t).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Retry wrong option */}
          {wrongAnswers.length > 0 && (
            <div className="mb-8">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={retryWrong}
                  onChange={(e) => setRetryWrong(e.target.checked)}
                  style={{ accentColor: '#c9a84c', width: '16px', height: '16px' }}
                />
                <span style={{ color: '#f0f4f8', fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Retry wrong answers only
                  <span style={{ color: '#8896a8', marginLeft: '8px', fontSize: '12px' }}>({wrongAnswers.length} questions)</span>
                </span>
              </label>
            </div>
          )}

          <button
            onClick={startQuiz}
            style={{
              width: '100%',
              backgroundColor: '#c9a84c',
              color: '#0f1623',
              border: 'none',
              borderRadius: '10px',
              padding: '16px',
              fontSize: '15px',
              fontWeight: 700,
              fontFamily: 'IBM Plex Sans, sans-serif',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            Start Quiz →
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'results') {
    const grade = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Fair' : 'Needs Work';
    const gradeColor = pct >= 80 ? '#6dab8a' : pct >= 60 ? '#c9a84c' : pct >= 40 ? '#7c9fc4' : '#e08080';

    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: '#f0f4f8', margin: '0 0 32px' }}>
          Quiz Results
        </h1>

        {/* Score card */}
        <div
          style={{ backgroundColor: '#1a2436', border: `2px solid ${gradeColor}`, borderRadius: '16px', padding: '40px', textAlign: 'center', marginBottom: '28px' }}
        >
          <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '5rem', color: gradeColor, lineHeight: 1 }}>
            {pct}%
          </div>
          <div style={{ color: gradeColor, fontSize: '14px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', marginTop: '8px' }}>
            {grade}
          </div>
          <div style={{ color: '#8896a8', fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', marginTop: '12px' }}>
            {score} correct out of {total} questions
          </div>
        </div>

        {/* Topic breakdown */}
        <div style={{ backgroundColor: '#1a2436', border: '1px solid #243048', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ color: '#8896a8', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '16px' }}>
            Breakdown by Topic
          </div>
          <div className="flex flex-col gap-4">
            {topicBreakdown.map(({ topic, correct, total: t }) => {
              const topicPct = t > 0 ? Math.round((correct / t) * 100) : 0;
              const barColor = topicPct >= 75 ? '#6dab8a' : topicPct >= 50 ? '#c9a84c' : '#e08080';
              return (
                <div key={topic}>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{ color: '#f0f4f8', fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif' }}>{topic}</span>
                    <span style={{ color: barColor, fontSize: '13px', fontWeight: 600, fontFamily: 'IBM Plex Sans, sans-serif' }}>{correct}/{t} ({topicPct}%)</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: '#243048', borderRadius: '2px' }}>
                    <div style={{ height: '100%', backgroundColor: barColor, borderRadius: '2px', width: `${topicPct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => setMode('setup')}
            style={{
              flex: 1,
              backgroundColor: '#243048',
              color: '#f0f4f8',
              border: '1px solid #4a5568',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '14px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ← Back to Setup
          </button>
          {wrongAnswers.length > 0 && (
            <button
              onClick={() => {
                setRetryWrong(true);
                setMode('setup');
              }}
              style={{
                flex: 1,
                backgroundColor: 'rgba(201,168,76,0.12)',
                color: '#c9a84c',
                border: '1px solid #c9a84c',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '14px',
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry {wrongAnswers.length} Wrong →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Quiz mode
  const progress = ((currentIndex) / quizQuestions.length) * 100;
  const isAnswered = selectedOption !== null || timedOut;
  const isCorrect = selectedOption === currentQ?.correctIndex;
  const timerPct = (timeLeft / 30) * 100;
  const timerColor = timeLeft > 15 ? '#6dab8a' : timeLeft > 8 ? '#c9a84c' : '#e08080';

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div style={{ color: '#8896a8', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Question {currentIndex + 1} of {quizQuestions.length}
          </div>
          <div style={{ color: '#c9a84c', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 500 }}>
            {currentQ?.topic}
          </div>
        </div>
        <div style={{ color: '#8896a8', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Score: <span style={{ color: '#6dab8a', fontWeight: 600 }}>{score}</span> / {answers.length}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '2px', backgroundColor: '#243048', borderRadius: '1px', marginBottom: '24px' }}>
        <div style={{ height: '100%', backgroundColor: '#c9a84c', borderRadius: '1px', width: `${progress}%`, transition: 'width 0.3s' }} />
      </div>

      {/* Timer */}
      {quizMode === 'timed' && (
        <div className="flex items-center gap-3 mb-6">
          <div style={{ flex: 1, height: '6px', backgroundColor: '#243048', borderRadius: '3px' }}>
            <div style={{ height: '100%', backgroundColor: timerColor, borderRadius: '3px', width: `${isAnswered ? 0 : timerPct}%`, transition: 'width 1s linear, background-color 0.5s' }} />
          </div>
          <div style={{ color: timerColor, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>
            {isAnswered ? '—' : `${timeLeft}s`}
          </div>
        </div>
      )}

      {/* Question card */}
      <div style={{ backgroundColor: '#1a2436', border: '1px solid #243048', borderRadius: '16px', padding: '32px', marginBottom: '20px' }}>
        <p style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.1rem, 2vw, 1.35rem)', color: '#f0f4f8', lineHeight: 1.5, margin: '0 0 28px' }}>
          {currentQ?.question}
        </p>

        <div className="flex flex-col gap-3">
          {currentQ?.options.map((option, i) => {
            let bg = '#243048';
            let border = '#4a5568';
            let color = '#f0f4f8';

            if (isAnswered) {
              if (i === currentQ.correctIndex) {
                bg = 'rgba(109,171,138,0.15)';
                border = '#6dab8a';
                color = '#6dab8a';
              } else if (i === selectedOption && !isCorrect) {
                bg = 'rgba(224,128,128,0.15)';
                border = '#e08080';
                color = '#e08080';
              } else {
                bg = '#1a2436';
                border = '#243048';
                color = '#4a5568';
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={isAnswered}
                style={{
                  textAlign: 'left',
                  backgroundColor: bg,
                  border: `1px solid ${border}`,
                  borderRadius: '8px',
                  padding: '14px 18px',
                  cursor: isAnswered ? 'default' : 'pointer',
                  color,
                  fontSize: '14px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: `1px solid ${border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                  backgroundColor: isAnswered && i === currentQ.correctIndex ? '#6dab8a' : isAnswered && i === selectedOption && !isCorrect ? '#e08080' : 'transparent',
                  color: isAnswered && (i === currentQ.correctIndex || (i === selectedOption && !isCorrect)) ? '#0f1623' : color,
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div
          style={{
            backgroundColor: isCorrect ? 'rgba(109,171,138,0.08)' : timedOut ? 'rgba(124,159,196,0.08)' : 'rgba(224,128,128,0.08)',
            border: `1px solid ${isCorrect ? 'rgba(109,171,138,0.3)' : timedOut ? 'rgba(124,159,196,0.3)' : 'rgba(224,128,128,0.3)'}`,
            borderRadius: '10px',
            padding: '20px 24px',
            marginBottom: '20px',
          }}
        >
          <div style={{ color: isCorrect ? '#6dab8a' : timedOut ? '#7c9fc4' : '#e08080', fontWeight: 700, fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '8px', letterSpacing: '0.05em' }}>
            {timedOut ? "⏱ Time's up!" : isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <p style={{ color: '#d0d8e4', fontSize: '13px', lineHeight: 1.7, fontFamily: 'IBM Plex Sans, sans-serif', margin: 0 }}>
            {currentQ?.explanation}
          </p>
        </div>
      )}

      {/* Next button */}
      {isAnswered && (
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            backgroundColor: '#c9a84c',
            color: '#0f1623',
            border: 'none',
            borderRadius: '10px',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: 'IBM Plex Sans, sans-serif',
            cursor: 'pointer',
          }}
        >
          {currentIndex >= quizQuestions.length - 1 ? 'See Results →' : 'Next Question →'}
        </button>
      )}
    </div>
  );
}

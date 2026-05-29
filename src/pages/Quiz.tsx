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
  const [shakingIdx, setShakingIdx] = useState<number | null>(null);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
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
    if (!correct) {
      setShakingIdx(optionIndex);
      setTimeout(() => setShakingIdx(null), 400);
    }
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
  }, [currentIndex, quizQuestions, answers, addQuizScore]);

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

  // ── Setup screen ─────────────────────────────────────────────────────────────

  if (mode === 'setup') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-md-on-surface-variant text-[10px] tracking-[0.2em] uppercase mb-1.5 font-medium">
          Study Mode
        </div>
        <h1 className="font-display text-md-on-surface m-0 mb-8" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}>
          Multiple Choice Quiz
        </h1>

        <div className="bg-md-surface-container rounded-3xl p-8 border border-md-outline-variant">
          {/* Mode selection */}
          <div className="mb-8">
            <div className="text-md-on-surface-variant text-xs tracking-widest uppercase mb-3 font-medium">
              Quiz Mode
            </div>
            <div className="flex gap-3">
              {(['practice', 'timed'] as QuizMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setQuizMode(m)}
                  className={`flex-1 p-5 rounded-3xl text-left cursor-pointer border transition-all duration-200 ${
                    quizMode === m
                      ? 'bg-md-primary-container text-md-on-primary-container'
                      : 'bg-md-surface-container-high border-md-outline-variant text-md-on-surface hover:border-md-outline'
                  }`}
                  style={quizMode === m ? { borderColor: 'rgba(61,126,255,0.4)', boxShadow: '0 0 0 1px rgba(61,126,255,0.15), 0 4px 16px rgba(61,126,255,0.12)' } : {}}
                >
                  <div className="font-display text-lg mb-1">
                    {m === 'practice' ? 'Practice Mode' : 'Timed Mode'}
                  </div>
                  <div className="text-[13px] opacity-70">
                    {m === 'practice' ? 'No time limit — learn at your own pace' : '30 seconds per question — test under pressure'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Topic filter */}
          <div className="mb-8">
            <div className="text-md-on-surface-variant text-xs tracking-widest uppercase mb-3 font-medium">
              Topic Filter
            </div>
            <div className="flex flex-wrap gap-2">
              {allTopics.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTopic(t)}
                  className={`px-4 py-2 rounded-full text-sm border cursor-pointer transition-all duration-200 ${
                    selectedTopic === t
                      ? 'bg-md-primary-container text-md-on-primary-container border-md-primary/30 font-medium'
                      : 'bg-transparent text-md-on-surface-variant border-md-outline-variant hover:bg-md-surface-container-high'
                  }`}
                >
                  {t}
                  <span className="text-md-on-surface-variant/60 ml-1.5 text-xs">
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
                  style={{ accentColor: '#3D7EFF', width: '16px', height: '16px' }}
                />
                <span className="text-md-on-surface text-sm">
                  Retry wrong answers only
                  <span className="text-md-on-surface-variant ml-2 text-xs">({wrongAnswers.length} questions)</span>
                </span>
              </label>
            </div>
          )}

          <button
            onClick={startQuiz}
            className="w-full h-12 rounded-full text-sm font-semibold border-0 cursor-pointer transition-all duration-150 btn-accent"
            style={{ backgroundColor: '#3D7EFF', color: '#E6EDF3' }}
          >
            Start Quiz →
          </button>
        </div>
      </div>
    );
  }

  // ── Results screen ───────────────────────────────────────────────────────────

  if (mode === 'results') {
    const grade = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Fair' : 'Needs Work';
    const gradeColor = pct >= 80 ? '#4ade80' : pct >= 60 ? '#3D7EFF' : pct >= 40 ? '#60a5fa' : '#f87171';

    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-display text-md-on-surface m-0 mb-8" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}>
          Quiz Results
        </h1>

        {/* Score card */}
        <div
          className="rounded-3xl p-10 text-center mb-5 border-2"
          style={{
            backgroundColor: '#161B22',
            borderColor: gradeColor + '50',
          }}
        >
          <div className="font-display leading-none mb-2" style={{ fontSize: '5rem', color: gradeColor }}>
            {pct}%
          </div>
          <div className="text-sm font-semibold tracking-[0.1em] uppercase mb-3" style={{ color: gradeColor }}>
            {grade}
          </div>
          <div className="text-md-on-surface-variant text-sm">
            {score} correct out of {total} questions
          </div>
        </div>

        {/* Topic breakdown */}
        <div className="bg-md-surface-container rounded-3xl p-6 border border-md-outline-variant mb-5">
          <div className="text-md-on-surface-variant text-[10px] tracking-[0.2em] uppercase mb-4 font-medium">
            Breakdown by Topic
          </div>
          <div className="flex flex-col gap-4">
            {topicBreakdown.map(({ topic, correct, total: t }) => {
              const topicPct = t > 0 ? Math.round((correct / t) * 100) : 0;
              const barColor = topicPct >= 75 ? '#4ade80' : topicPct >= 50 ? '#3D7EFF' : '#f87171';
              return (
                <div key={topic}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-md-on-surface text-sm">{topic}</span>
                    <span className="text-sm font-semibold" style={{ color: barColor }}>{correct}/{t} ({topicPct}%)</span>
                  </div>
                  <div className="h-1.5 bg-md-outline-variant rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${topicPct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setMode('setup')}
            className="flex-1 h-11 rounded-full text-sm font-medium border cursor-pointer transition-all duration-200 bg-transparent text-md-on-surface border-md-outline-variant hover:bg-md-surface-container"
          >
            ← Back to Setup
          </button>
          {wrongAnswers.length > 0 && (
            <button
              onClick={() => { setRetryWrong(true); setMode('setup'); }}
              className="flex-1 h-11 rounded-full text-sm font-semibold border-0 cursor-pointer transition-all duration-150 btn-accent"
              style={{ backgroundColor: '#1D3461', color: '#93B8FF' }}
            >
              Retry {wrongAnswers.length} Wrong →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Quiz screen ──────────────────────────────────────────────────────────────

  const progress = (currentIndex / quizQuestions.length) * 100;
  const isAnswered = selectedOption !== null || timedOut;
  const isCorrect = selectedOption === currentQ?.correctIndex;
  const timerPct = (timeLeft / 30) * 100;
  const timerColor = timeLeft > 15 ? '#4ade80' : timeLeft > 8 ? '#3D7EFF' : '#f87171';

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-md-on-surface-variant text-xs">
            Question {currentIndex + 1} of {quizQuestions.length}
          </div>
          <div className="text-md-primary text-xs font-medium mt-0.5">
            {currentQ?.topic}
          </div>
        </div>
        <div className="text-md-on-surface-variant text-xs">
          Score: <span className="text-green-400 font-semibold">{score}</span> / {answers.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-md-outline-variant rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-md-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer */}
      {quizMode === 'timed' && (
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-1.5 bg-md-outline-variant rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${isAnswered ? 0 : timerPct}%`,
                backgroundColor: timerColor,
                transition: 'width 1s linear, background-color 0.5s',
              }}
            />
          </div>
          <div className="text-sm font-bold min-w-[36px] text-right" style={{ color: timerColor }}>
            {isAnswered ? '—' : `${timeLeft}s`}
          </div>
        </div>
      )}

      {/* Question card */}
      <div className="bg-md-surface-container rounded-3xl p-8 border border-md-outline-variant mb-5">
        <p className="font-display text-md-on-surface leading-relaxed m-0 mb-7" style={{ fontSize: 'clamp(1.1rem, 2vw, 1.3rem)' }}>
          {currentQ?.question}
        </p>

        <div className="flex flex-col gap-2.5">
          {currentQ?.options.map((option, i) => {
            const isRight = isAnswered && i === currentQ.correctIndex;
            const isWrong = isAnswered && i === selectedOption && !isCorrect;

            let bg = 'var(--color-md-surface-container-high)';
            let border = 'var(--color-md-outline-variant)';
            let textCol = 'var(--color-md-on-surface)';
            let badgeBg = 'transparent';

            if (isRight) {
              bg = 'rgba(74,222,128,0.10)';
              border = 'rgba(74,222,128,0.4)';
              textCol = '#4ade80';
              badgeBg = '#4ade80';
            } else if (isWrong) {
              bg = 'rgba(248,113,113,0.10)';
              border = 'rgba(248,113,113,0.4)';
              textCol = '#f87171';
              badgeBg = '#f87171';
            } else if (!isAnswered) {
              if (hoveredOption === i) {
                bg = 'rgba(255,255,255,0.045)';
                border = '#484F58';
              } else {
                bg = 'var(--color-md-surface-container-high)';
                border = 'var(--color-md-outline-variant)';
              }
            } else {
              bg = 'var(--color-md-surface-container-low)';
              border = 'var(--color-md-outline-variant)';
              textCol = 'var(--color-md-on-surface-variant)';
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={isAnswered}
                className={`flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-2xl border transition-all duration-150 cursor-pointer disabled:cursor-default text-sm${isWrong && shakingIdx === i ? ' anim-shake' : ''}`}
                style={{ backgroundColor: bg, borderColor: border, color: textCol }}
                onMouseEnter={() => !isAnswered && setHoveredOption(i)}
                onMouseLeave={() => setHoveredOption(null)}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold border transition-all duration-200"
                  style={{
                    borderColor: border,
                    backgroundColor: (isRight || isWrong) ? badgeBg : 'transparent',
                    color: (isRight || isWrong) ? '#0D1117' : textCol,
                  }}
                >
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
          className="rounded-3xl px-6 py-5 mb-5 border"
          style={{
            backgroundColor: isCorrect
              ? 'rgba(74,222,128,0.08)'
              : timedOut
                ? 'rgba(96,165,250,0.08)'
                : 'rgba(248,113,113,0.08)',
            borderColor: isCorrect
              ? 'rgba(74,222,128,0.3)'
              : timedOut
                ? 'rgba(96,165,250,0.3)'
                : 'rgba(248,113,113,0.3)',
          }}
        >
          <div
            className="text-xs font-semibold tracking-wide mb-2"
            style={{ color: isCorrect ? '#4ade80' : timedOut ? '#60a5fa' : '#f87171' }}
          >
            {timedOut ? "⏱ Time's up!" : isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <p className="text-md-on-surface text-sm leading-relaxed m-0">
            {currentQ?.explanation}
          </p>
        </div>
      )}

      {/* Next button */}
      {isAnswered && (
        <button
          onClick={handleNext}
          className="w-full h-12 rounded-full text-sm font-semibold border-0 cursor-pointer transition-all duration-150 btn-accent"
          style={{ backgroundColor: '#3D7EFF', color: '#E6EDF3' }}
        >
          {currentIndex >= quizQuestions.length - 1 ? 'See Results →' : 'Next Question →'}
        </button>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GeneratedFlashcard } from '../lib/generator';
import { useSRS } from '../store/useSRS';
import { useLang } from '../context/LanguageContext';
import type { Rating } from '../lib/srs';

// ── Vocabulary card helpers ────────────────────────────────────────────────

interface VocabData {
  reading:     string;
  meaning:     string;
  example:     string;
  translation: string;
}

function parseVocab(back: string): VocabData | null {
  if (!back.startsWith('__vocab__')) return null;
  try {
    return JSON.parse(back.slice('__vocab__'.length)) as VocabData;
  } catch {
    return null;
  }
}

function VocabBack({ vocab, color }: { vocab: VocabData; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
      {/* Reading / pinyin */}
      {vocab.reading && (
        <div style={{
          fontFamily: "'LXGW WenKai Mono TC', 'JetBrains Mono', monospace",
          fontSize: '17px',
          color: '#8B949E',
          letterSpacing: '0.06em',
          textAlign: 'center',
        }}>
          {vocab.reading}
        </div>
      )}

      {/* Meaning */}
      <div style={{
        fontFamily: "'LXGW WenKai Mono TC', monospace",
        fontWeight: 700,
        fontSize: 'clamp(26px, 5vw, 40px)',
        color: '#E6EDF3',
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        {vocab.meaning}
      </div>

      {/* Divider */}
      {(vocab.example || vocab.translation) && (
        <div style={{ width: '36px', height: '1px', background: color + '40', margin: '2px 0' }} />
      )}

      {/* Example sentence — Chinese/source language */}
      {vocab.example && (
        <div style={{
          fontFamily: "'LXGW WenKai Mono TC', serif",
          fontSize: '16px',
          color: '#C9D1D9',
          textAlign: 'center',
          lineHeight: 1.8,
          letterSpacing: '0.02em',
        }}>
          {vocab.example}
        </div>
      )}

      {/* Translation of example */}
      {vocab.translation && (
        <div style={{
          fontFamily: "'LXGW WenKai Mono TC', monospace",
          fontWeight: 300,
          fontSize: '14px',
          color: '#8B949E',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          {vocab.translation}
        </div>
      )}
    </div>
  );
}

const RATINGS: { key: Rating; label: string; hint: string; color: string }[] = [
  { key: 'again', label: 'Again', hint: '1', color: '#F85149' },
  { key: 'hard',  label: 'Hard',  hint: '2', color: '#fb923c' },
  { key: 'good',  label: 'Good',  hint: '3', color: '#3D7EFF' },
  { key: 'easy',  label: 'Easy',  hint: '4', color: '#2EA043' },
];

export function FlashcardViewer({ cards, color, subjectId, onSessionEnd, onGoToQuiz, onBack }: {
  cards: GeneratedFlashcard[];
  color: string;
  subjectId?: string;
  onSessionEnd?: (reviewedCount: number) => void;
  onGoToQuiz?: () => void;
  onBack?: () => void;
}) {
  const { ts } = useLang();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [done, setDone] = useState(false);
  const card = cards[index];
  const progress = ((index + 1) / cards.length) * 100;
  const srsMode = !!subjectId;
  const rate = useSRS(s => s.rate);
  // Report the session (count of cards rated) exactly once — on completion or
  // when the viewer unmounts mid-way.
  const reviewedRef = useRef(0);
  const reportedRef = useRef(false);
  const report = useCallback(() => {
    if (reportedRef.current || reviewedRef.current === 0) return;
    reportedRef.current = true;
    onSessionEnd?.(reviewedRef.current);
  }, [onSessionEnd]);
  useEffect(() => report, [report]);

  const prev = () => { setIndex(i => Math.max(0, i - 1)); setFlipped(false); };
  const next = () => { setIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); };
  const flip = () => setFlipped(f => !f);

  const handleRate = useCallback((rating: Rating) => {
    if (subjectId) rate(card.id, subjectId, rating);
    const n = reviewed + 1;
    setReviewed(n);
    reviewedRef.current = n;
    if (index >= cards.length - 1) { setDone(true); report(); }
    else next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, rate, card, reviewed, index, cards.length, report]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (srsMode && flipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(RATINGS[Number(e.key) - 1].key);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      if (!srsMode && e.key === 'ArrowRight') next();
      if (!srsMode && e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (srsMode && done) {
    return (
      <>
      <div className="anim-fadein" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '14px', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: color + '1A', border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '18px', color: '#E6EDF3' }}>{ts('Session complete')}</div>
        <div style={{ fontSize: '13px', color: '#8B949E' }}>{ts('You reviewed {n} card{s}. Schedule updated.', { n: reviewed, s: reviewed !== 1 ? 's' : '' })}</div>
        <button
          onClick={() => { setIndex(0); setFlipped(false); setReviewed(0); setDone(false); reviewedRef.current = 0; reportedRef.current = false; }}
          className="h-10 px-6 text-sm font-semibold cursor-pointer"
          style={{ marginTop: '6px', background: color + '18', color, border: `1px solid ${color}45`, borderRadius: '999px' }}
        >
          {ts('Review again')}
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="h-10 px-6 text-sm font-semibold cursor-pointer"
            style={{ background: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '999px' }}
          >
            {ts('← Back to list')}
          </button>
        )}
        {onGoToQuiz && (
          <button
            onClick={onGoToQuiz}
            className="h-10 px-6 text-sm font-semibold cursor-pointer"
            style={{ background: '#1D3461', color: '#93B8FF', border: '1px solid rgba(61,126,255,0.4)', borderRadius: '999px' }}
          >
            {ts('Test your Knowledge →')}
          </button>
        )}
      </div>
      </>
    );
  }

  const cardW = 'min(740px, 96vw)';
  const vocab = parseVocab(card.back);
  const isVocabCard = vocab !== null;

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '70vh', justifyContent: 'center', paddingTop: '12px', paddingBottom: '24px' }}>
      {/* Progress bar — full width */}
      <div className="flashcard-progress-bar-track h-px mb-5 overflow-hidden" style={{ width: '100%', background: '#30363D', borderRadius: '1px' }}>
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: color,
            borderRadius: '1px',
            transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>

      {/* Counter + topic */}
      <div className="flashcard-meta flex items-center justify-between mb-4" style={{ width: cardW }}>
        <span className="mono text-xs" style={{ color: '#8B949E' }}>
          {index + 1} / {cards.length}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: color + '10', color, border: `1px solid ${color}20` }}>
          {card.topic}
        </span>
      </div>

      {/* Flip card */}
      <div
        className="flashcard-card flip-card cursor-pointer mb-5"
        style={{ width: cardW, minHeight: '320px' }}
        onClick={flip}
        role="button"
        tabIndex={0}
        aria-label={flipped ? ts('Showing answer — click to flip back') : ts('Showing question — click to reveal answer')}
        onKeyDown={e => (e.key === 'Enter') && flip()}
      >
        <div className={`flip-card-inner${flipped ? ' flipped' : ''}`}>
          {/* Front */}
          <div
            className="flip-card-front flex flex-col items-center justify-center gap-4"
            style={{
              padding: 'clamp(32px, 5vw, 52px) clamp(28px, 5vw, 52px)',
              borderRadius: '12px',
              background: '#161B22',
              border: `1px solid ${isVocabCard ? color + '35' : color + '25'}`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.4)',
              transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#8B949E' }}>
              {isVocabCard ? ts('Word') : ts('Question')}
            </div>
            {isVocabCard ? (
              <div style={{
                fontFamily: "'LXGW WenKai Mono TC', monospace",
                fontWeight: 700,
                fontSize: 'clamp(40px, 12vw, 72px)',
                color: '#E6EDF3',
                textAlign: 'center',
                lineHeight: 1.1,
                letterSpacing: '0.06em',
              }}>
                {card.front}
              </div>
            ) : (
              <div className="text-center leading-relaxed" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 'clamp(18px, 2.5vw, 26px)', color: '#E6EDF3', lineHeight: 1.45 }}>
                {card.front}
              </div>
            )}
            <div className="hidden md:flex text-xs mt-1 items-center gap-1.5" style={{ color: '#484F58' }}>
              <kbd className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>Space</kbd>
              {ts('to reveal')}
            </div>
          </div>

          {/* Back */}
          <div
            className="flip-card-back flex flex-col items-center justify-center gap-4"
            style={{
              padding: isVocabCard ? 'clamp(32px, 5vw, 52px) clamp(28px, 5vw, 52px)' : 'clamp(32px, 5vw, 52px) clamp(28px, 5vw, 52px)',
              borderRadius: '12px',
              background: isVocabCard
                ? `linear-gradient(135deg, ${color}14 0%, #161B22 100%)`
                : 'linear-gradient(135deg, #1D3461 0%, #161B22 100%)',
              border: `1px solid ${color}40`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 16px rgba(0,0,0,0.4)',
              transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: isVocabCard ? color : '#3D7EFF' }}>
              {isVocabCard ? ts('Meaning') : ts('Answer')}
            </div>
            {isVocabCard && vocab ? (
              <VocabBack vocab={vocab} color={color} />
            ) : (
              <div className="text-center" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', color: '#E6EDF3', lineHeight: 1.65 }}>
                {card.back}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls — constrained to card width */}
      <div className="flashcard-controls" style={{ width: cardW }}>
        {srsMode ? (
          flipped ? (
            <div>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => handleRate(r.key)}
                    className="h-11 text-sm font-semibold cursor-pointer transition-transform duration-150"
                    style={{ background: r.color + '1A', color: r.color, border: `1px solid ${r.color}55`, borderRadius: '12px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                    aria-label={ts('Rate {label}', { label: ts(r.label) })}
                  >
                    {ts(r.label)}
                    <span className="ml-1.5 text-[10px] opacity-60">{r.hint}</span>
                  </button>
                ))}
              </div>
              <div className="hidden md:block text-center mt-3 text-xs" style={{ color: '#484F58' }}>
                {ts('How well did you recall this?')} <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>1</kbd>–<kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>4</kbd>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={flip}
                className="h-11 px-8 text-sm font-semibold cursor-pointer"
                style={{ background: '#1D3461', color: '#93B8FF', border: '1px solid rgba(61,126,255,0.4)', borderRadius: '9999px' }}
              >
                {ts('Show answer')}
              </button>
              <span className="text-xs" style={{ color: '#484F58' }}>{ts('{n} reviewed this session', { n: reviewed })}</span>
            </div>
          )
        ) : (
          <>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={prev}
                disabled={index === 0}
                className="h-10 px-5 text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ background: '#161B22', color: '#8B949E', border: '1px solid #30363D', borderRadius: '9999px', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 3px rgba(0,0,0,0.3)' }}
                aria-label={ts('Previous card')}
              >
                {ts('← Prev')}
              </button>

              <button
                onClick={flip}
                className="h-10 px-7 text-sm font-semibold transition-all duration-150 cursor-pointer btn-accent"
                style={{ background: '#1D3461', color: '#93B8FF', border: '1px solid rgba(61,126,255,0.4)', borderRadius: '9999px' }}
              >
                {ts('Flip card')}
              </button>

              <button
                onClick={next}
                disabled={index === cards.length - 1}
                className="h-10 px-5 text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ background: '#161B22', color: '#8B949E', border: '1px solid #30363D', borderRadius: '9999px', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 3px rgba(0,0,0,0.3)' }}
                aria-label={ts('Next card')}
              >
                {ts('Next →')}
              </button>
            </div>

            {/* Keyboard hint */}
            <div className="text-center mt-3 text-xs" style={{ color: '#484F58' }}>
              <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>←</kbd>
              {' '}/{' '}
              <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>→</kbd>
              {' '}{ts('navigate')}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}

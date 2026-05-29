import { useState, useEffect } from 'react';
import type { GeneratedFlashcard } from '../lib/generator';

export function FlashcardViewer({ cards, color }: { cards: GeneratedFlashcard[]; color: string }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const progress = ((index + 1) / cards.length) * 100;

  const prev = () => { setIndex(i => Math.max(0, i - 1)); setFlipped(false); };
  const next = () => { setIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); };
  const flip = () => setFlipped(f => !f);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div>
      {/* Progress bar — top */}
      <div className="h-px mb-5 overflow-hidden" style={{ background: '#30363D', borderRadius: '1px' }}>
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
      <div className="flex items-center justify-between mb-4">
        <span className="mono text-xs" style={{ color: '#8B949E' }}>
          {index + 1} / {cards.length}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: color + '15', color, border: `1px solid ${color}30` }}>
          {card.topic}
        </span>
      </div>

      {/* Flip card */}
      <div
        className="flip-card cursor-pointer mb-5"
        style={{ height: '280px' }}
        onClick={flip}
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Showing answer — click to flip back' : 'Showing question — click to reveal answer'}
        onKeyDown={e => (e.key === 'Enter') && flip()}
      >
        <div className={`flip-card-inner${flipped ? ' flipped' : ''}`}>
          {/* Front */}
          <div
            className="flip-card-front flex flex-col items-center justify-center p-10 gap-4"
            style={{
              borderRadius: '12px',
              background: '#161B22',
              border: `1px solid ${color}25`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#8B949E' }}>
              Question
            </div>
            <div className="text-center leading-relaxed max-w-xl" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', color: '#E6EDF3', lineHeight: 1.4 }}>
              {card.front}
            </div>
            <div className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#484F58' }}>
              <kbd className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>Space</kbd>
              to reveal
            </div>
          </div>

          {/* Back */}
          <div
            className="flip-card-back flex flex-col items-center justify-center p-10 gap-4"
            style={{
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1D3461 0%, #161B22 100%)',
              border: `1px solid ${color}40`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#3D7EFF' }}>
              Answer
            </div>
            <div className="text-center leading-relaxed max-w-xl" style={{ fontSize: '15px', color: '#E6EDF3', lineHeight: 1.6 }}>
              {card.back}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 justify-center">
        <button
          onClick={prev}
          disabled={index === 0}
          className="h-9 px-4 text-sm font-medium border transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default"
          style={{ background: '#161B22', color: '#8B949E', border: '1px solid #30363D', borderRadius: '7px' }}
          aria-label="Previous card"
        >
          ← Prev
        </button>

        <button
          onClick={flip}
          className="h-9 px-5 text-sm font-medium transition-colors duration-150 cursor-pointer"
          style={{ background: '#1D3461', color: '#93B8FF', border: '1px solid rgba(61,126,255,0.3)', borderRadius: '7px' }}
        >
          Flip
        </button>

        <button
          onClick={next}
          disabled={index === cards.length - 1}
          className="h-9 px-4 text-sm font-medium border transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default"
          style={{ background: '#161B22', color: '#8B949E', border: '1px solid #30363D', borderRadius: '7px' }}
          aria-label="Next card"
        >
          Next →
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="text-center mt-3 text-xs" style={{ color: '#484F58' }}>
        <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>←</kbd>
        {' '}/{' '}
        <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>→</kbd>
        {' '}navigate
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { GeneratedFlashcard } from '../lib/generator';

export function FlashcardViewer({ cards, color }: { cards: GeneratedFlashcard[]; color: string }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  const prev = () => { setIndex(i => Math.max(0, i - 1)); setFlipped(false); };
  const next = () => { setIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); };

  return (
    <div>
      {/* Counter + topic */}
      <div className="flex items-center justify-between mb-5">
        <div className="tabular-nums text-md-on-surface-variant text-xs">
          {index + 1} / {cards.length}
        </div>
        <div className="text-xs font-medium" style={{ color }}>
          {card.topic}
        </div>
      </div>

      {/* Flip card */}
      <div
        className="flip-card cursor-pointer mb-6"
        onClick={() => setFlipped(f => !f)}
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Show question' : 'Show answer'}
        onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}
      >
        <div className={`flip-card-inner${flipped ? ' flipped' : ''}`} style={{ minHeight: '240px' }}>
          {/* Front */}
          <div
            className="flip-card-front rounded-3xl flex flex-col items-center justify-center p-10 gap-3 border"
            style={{
              backgroundColor: '#1D1B20',
              borderColor: color + '30',
              borderTopWidth: '3px',
              borderTopColor: color,
            }}
          >
            <div className="text-md-on-surface-variant text-[10px] tracking-widest uppercase">
              Question
            </div>
            <div className="font-display text-md-on-surface text-xl text-center leading-relaxed max-w-xl">
              {card.front}
            </div>
            <div className="text-md-outline text-xs mt-1">
              click to reveal answer
            </div>
          </div>

          {/* Back */}
          <div
            className="flip-card-back rounded-3xl flex flex-col items-center justify-center p-10 gap-3 border"
            style={{
              backgroundColor: '#211F26',
              borderColor: color + '50',
              borderTopWidth: '3px',
              borderTopColor: color,
            }}
          >
            <div className="text-md-on-surface-variant text-[10px] tracking-widest uppercase">
              Answer
            </div>
            <div className="text-md-on-surface text-[15px] text-center leading-relaxed max-w-xl">
              {card.back}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-md-outline-variant rounded-full mb-5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / cards.length) * 100}%`, backgroundColor: color }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={prev}
          disabled={index === 0}
          className="h-10 px-6 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default bg-md-surface-container text-md-on-surface border-md-outline-variant hover:bg-md-surface-container-high"
        >
          ← Prev
        </button>
        <button
          onClick={next}
          disabled={index === cards.length - 1}
          className="h-10 px-6 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default bg-md-surface-container text-md-on-surface border-md-outline-variant hover:bg-md-surface-container-high"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

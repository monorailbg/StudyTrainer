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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#4a5a6e', fontVariantNumeric: 'tabular-nums' }}>
          {index + 1} / {cards.length}
        </div>
        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: color, fontWeight: 500 }}>
          {card.topic}
        </div>
      </div>

      <div
        className="flip-card"
        style={{ cursor: 'pointer', marginBottom: '24px' }}
        onClick={() => setFlipped(f => !f)}
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Show question' : 'Show answer'}
        onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}
      >
        <div className={`flip-card-inner${flipped ? ' flipped' : ''}`} style={{ minHeight: '220px' }}>
          <div className="flip-card-front" style={{
            backgroundColor: '#0d1a2e',
            border: `1px solid ${color}28`,
            borderTop: `3px solid ${color}`,
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '44px 40px',
            gap: '14px',
          }}>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '10px', color: '#4a5a6e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Question
            </div>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', color: '#f0f4f8', textAlign: 'center', lineHeight: 1.45, maxWidth: '560px' }}>
              {card.front}
            </div>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#2d4465', marginTop: '4px' }}>
              click to reveal answer
            </div>
          </div>
          <div className="flip-card-back" style={{
            backgroundColor: '#0d1a2e',
            border: `1px solid ${color}50`,
            borderTop: `3px solid ${color}`,
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '44px 40px',
            gap: '14px',
          }}>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '10px', color: '#4a5a6e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Answer
            </div>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '15px', color: '#f0f4f8', textAlign: 'center', lineHeight: 1.65, maxWidth: '560px' }}>
              {card.back}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '2px', backgroundColor: '#1e2d45', borderRadius: '0', marginBottom: '20px' }}>
        <div style={{
          height: '100%',
          width: `${((index + 1) / cards.length) * 100}%`,
          backgroundColor: color,
          transition: 'width 0.25s ease-out',
        }} />
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={prev}
          disabled={index === 0}
          style={{
            height: '40px', padding: '0 24px', borderRadius: '8px',
            backgroundColor: '#162236', border: '1px solid #1e2d45',
            color: index === 0 ? '#2d4465' : '#94a3b8',
            cursor: index === 0 ? 'default' : 'pointer',
            fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 500,
            transition: 'color 0.15s',
          }}
        >
          ← Prev
        </button>
        <button
          onClick={next}
          disabled={index === cards.length - 1}
          style={{
            height: '40px', padding: '0 24px', borderRadius: '8px',
            backgroundColor: '#162236', border: '1px solid #1e2d45',
            color: index === cards.length - 1 ? '#2d4465' : '#94a3b8',
            cursor: index === cards.length - 1 ? 'default' : 'pointer',
            fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 500,
            transition: 'color 0.15s',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

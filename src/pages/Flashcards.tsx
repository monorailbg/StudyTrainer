import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import flashcardsData from '../data/flashcards.json';
import type { Flashcard } from '../types';

const cards = flashcardsData as Flashcard[];
const allTopics = ['All', ...Array.from(new Set(cards.map((c) => c.topic)))];
const allChapters = ['All', ...Array.from(new Set(cards.map((c) => c.chapter)))];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Flashcards() {
  const { flashcardsKnown, flashcardsStudied, markFlashcardKnown, markFlashcardReview, markFlashcardStudied } = useStore();
  const [topic, setTopic] = useState('All');
  const [chapter, setChapter] = useState('All');
  const [showKnown, setShowKnown] = useState(true);
  const [shuffled, setShuffled] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const filtered = useMemo(() => {
    let result = cards;
    if (topic !== 'All') result = result.filter((c) => c.topic === topic);
    if (chapter !== 'All') result = result.filter((c) => c.chapter === chapter);
    if (!showKnown) result = result.filter((c) => !flashcardsKnown.includes(c.id));
    return shuffled ? shuffle(result) : result;
  }, [topic, chapter, showKnown, shuffled, flashcardsKnown]);

  const card = filtered[index] ?? null;
  const isKnown = card ? flashcardsKnown.includes(card.id) : false;

  const goTo = (i: number) => {
    setIndex(Math.max(0, Math.min(i, filtered.length - 1)));
    setFlipped(false);
    if (card) markFlashcardStudied(card.id);
  };

  const handleShuffle = () => {
    setShuffled((s) => !s);
    setIndex(0);
    setFlipped(false);
  };

  const progress = filtered.length > 0 ? ((index + 1) / filtered.length) * 100 : 0;
  const knownCount = filtered.filter((c) => flashcardsKnown.includes(c.id)).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div style={{ color: '#8896a8', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '6px' }}>
          Study Mode
        </div>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: '#f0f4f8', margin: 0 }}>
          Flashcards
        </h1>
      </div>

      {/* Filters */}
      <div
        style={{ backgroundColor: '#1a2436', border: '1px solid #243048', borderRadius: '10px', padding: '16px' }}
        className="flex flex-wrap gap-4 items-center mb-8"
      >
        <div className="flex items-center gap-2">
          <label style={{ color: '#8896a8', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Topic
          </label>
          <select
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setIndex(0); setFlipped(false); }}
            style={{ backgroundColor: '#243048', color: '#f0f4f8', border: '1px solid #4a5568', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            {allTopics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label style={{ color: '#8896a8', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Chapter
          </label>
          <select
            value={chapter}
            onChange={(e) => { setChapter(e.target.value); setIndex(0); setFlipped(false); }}
            style={{ backgroundColor: '#243048', color: '#f0f4f8', border: '1px solid #4a5568', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            {allChapters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer" style={{ color: '#8896a8', fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          <input
            type="checkbox"
            checked={!showKnown}
            onChange={() => { setShowKnown((v) => !v); setIndex(0); setFlipped(false); }}
            style={{ accentColor: '#c9a84c' }}
          />
          Hide known cards
        </label>

        <button
          onClick={handleShuffle}
          style={{
            backgroundColor: shuffled ? 'rgba(201,168,76,0.15)' : '#243048',
            color: shuffled ? '#c9a84c' : '#8896a8',
            border: `1px solid ${shuffled ? '#c9a84c' : '#4a5568'}`,
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontWeight: 500,
          }}
        >
          {shuffled ? '✓ Shuffled' : 'Shuffle'}
        </button>

        <div style={{ marginLeft: 'auto', color: '#8896a8', fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          <span style={{ color: '#c9a84c', fontWeight: 600 }}>{knownCount}</span> / {filtered.length} known
        </div>
      </div>

      {/* Card */}
      {card ? (
        <>
          {/* Progress bar */}
          <div style={{ height: '2px', backgroundColor: '#243048', borderRadius: '1px', marginBottom: '24px' }}>
            <div
              style={{ height: '100%', backgroundColor: '#c9a84c', borderRadius: '1px', transition: 'width 0.3s', width: `${progress}%` }}
            />
          </div>

          <div style={{ color: '#8896a8', fontSize: '12px', textAlign: 'center', marginBottom: '20px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Card {index + 1} of {filtered.length} &nbsp;·&nbsp;
            <span style={{ color: '#c9a84c' }}>{card.topic}</span> &nbsp;·&nbsp; {card.chapter}
          </div>

          {/* Flip card */}
          <div
            className="flip-card"
            style={{ height: '340px', cursor: 'pointer', marginBottom: '24px' }}
            onClick={() => {
              setFlipped((f) => !f);
              markFlashcardStudied(card.id);
            }}
          >
            <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div
                className="flip-card-front"
                style={{
                  backgroundColor: '#1a2436',
                  border: isKnown ? '2px solid rgba(109,171,138,0.4)' : '2px solid #243048',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  textAlign: 'center',
                }}
              >
                <div style={{ color: '#4a5568', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '20px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Term / Concept
                </div>
                <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', color: '#f0f4f8', lineHeight: 1.3 }}>
                  {card.front}
                </div>
                <div style={{ color: '#4a5568', fontSize: '12px', marginTop: '32px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Click to reveal definition
                </div>
                {isKnown && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'rgba(109,171,138,0.15)', color: '#6dab8a', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    ✓ Known
                  </div>
                )}
              </div>

              {/* Back */}
              <div
                className="flip-card-back"
                style={{
                  backgroundColor: '#1a2436',
                  border: '2px solid #c9a84c',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  textAlign: 'center',
                }}
              >
                <div style={{ color: '#c9a84c', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Definition
                </div>
                <div style={{ color: '#f0f4f8', fontSize: '15px', lineHeight: '1.65', fontFamily: 'IBM Plex Sans, sans-serif', maxWidth: '520px' }}>
                  {card.back}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-3">
              <button
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                style={{
                  backgroundColor: '#243048',
                  color: index === 0 ? '#4a5568' : '#f0f4f8',
                  border: '1px solid #4a5568',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontWeight: 500,
                }}
              >
                ← Previous
              </button>
              <button
                onClick={() => goTo(index + 1)}
                disabled={index >= filtered.length - 1}
                style={{
                  backgroundColor: '#243048',
                  color: index >= filtered.length - 1 ? '#4a5568' : '#f0f4f8',
                  border: '1px solid #4a5568',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: index >= filtered.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontWeight: 500,
                }}
              >
                Next →
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  markFlashcardReview(card.id);
                }}
                style={{
                  backgroundColor: isKnown ? '#243048' : 'rgba(176, 90, 90, 0.15)',
                  color: '#e08080',
                  border: '1px solid rgba(176,90,90,0.3)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontWeight: 500,
                }}
              >
                Review Again
              </button>
              <button
                onClick={() => {
                  markFlashcardKnown(card.id);
                }}
                style={{
                  backgroundColor: isKnown ? 'rgba(109,171,138,0.2)' : 'rgba(109,171,138,0.1)',
                  color: '#6dab8a',
                  border: `1px solid ${isKnown ? '#6dab8a' : 'rgba(109,171,138,0.3)'}`,
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontWeight: 500,
                }}
              >
                {isKnown ? '✓ Known' : 'Mark as Known'}
              </button>
            </div>
          </div>

          {/* Progress summary */}
          <div
            style={{ backgroundColor: '#1a2436', border: '1px solid #243048', borderRadius: '8px', padding: '14px 20px', marginTop: '32px' }}
            className="flex flex-wrap gap-6"
          >
            {[
              { label: 'Total in filter', value: filtered.length, color: '#8896a8' },
              { label: 'Studied', value: filtered.filter((c) => flashcardsStudied.includes(c.id)).length, color: '#7c9fc4' },
              { label: 'Known', value: knownCount, color: '#6dab8a' },
              { label: 'Remaining', value: filtered.length - knownCount, color: '#c9a84c' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ color, fontSize: '1.2rem', fontFamily: 'DM Serif Display, serif' }}>{value}</div>
                <div style={{ color: '#8896a8', fontSize: '11px', fontFamily: 'IBM Plex Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          style={{ backgroundColor: '#1a2436', border: '1px solid #243048', borderRadius: '16px', padding: '60px', textAlign: 'center' }}
        >
          <div style={{ fontFamily: 'DM Serif Display, serif', color: '#f0f4f8', fontSize: '1.3rem', marginBottom: '8px' }}>
            No cards match your filters
          </div>
          <div style={{ color: '#8896a8', fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Try adjusting the topic, chapter, or showing known cards.
          </div>
        </div>
      )}
    </div>
  );
}

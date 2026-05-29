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
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="text-md-on-surface-variant text-[10px] tracking-[0.2em] uppercase mb-1.5 font-medium">
          Study Mode
        </div>
        <h1 className="font-display text-md-on-surface m-0" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}>
          Flashcards
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-md-surface-container rounded-3xl p-5 border border-md-outline-variant flex flex-wrap gap-4 items-center mb-8">
        <div className="flex items-center gap-2">
          <label className="text-md-on-surface-variant text-xs tracking-widest uppercase">Topic</label>
          <select
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setIndex(0); setFlipped(false); }}
            className="md-select !w-auto !px-3 !py-1.5 !text-sm !rounded-xl"
          >
            {allTopics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-md-on-surface-variant text-xs tracking-widest uppercase">Chapter</label>
          <select
            value={chapter}
            onChange={(e) => { setChapter(e.target.value); setIndex(0); setFlipped(false); }}
            className="md-select !w-auto !px-3 !py-1.5 !text-sm !rounded-xl"
          >
            {allChapters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-md-on-surface-variant text-sm">
          <input
            type="checkbox"
            checked={!showKnown}
            onChange={() => { setShowKnown((v) => !v); setIndex(0); setFlipped(false); }}
            style={{ accentColor: '#3D7EFF' }}
          />
          Hide known cards
        </label>

        <button
          onClick={handleShuffle}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer ${
            shuffled
              ? 'bg-md-primary-container text-md-on-primary-container border-md-primary/30'
              : 'bg-transparent text-md-on-surface-variant border-md-outline-variant hover:bg-md-surface-container-high'
          }`}
        >
          {shuffled ? '✓ Shuffled' : 'Shuffle'}
        </button>

        <div className="ml-auto text-md-on-surface-variant text-sm">
          <span className="text-md-primary font-semibold">{knownCount}</span> / {filtered.length} known
        </div>
      </div>

      {card ? (
        <>
          {/* Progress bar */}
          <div className="h-0.5 bg-md-outline-variant rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-md-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-md-on-surface-variant text-xs text-center mb-5">
            Card {index + 1} of {filtered.length} &nbsp;·&nbsp;
            <span className="text-md-primary">{card.topic}</span> &nbsp;·&nbsp; {card.chapter}
          </div>

          {/* Flip card */}
          <div
            className="flip-card cursor-pointer mb-6"
            style={{ height: '340px' }}
            onClick={() => { setFlipped((f) => !f); markFlashcardStudied(card.id); }}
          >
            <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div
                className="flip-card-front rounded-3xl flex flex-col items-center justify-center p-10 text-center relative"
                style={{
                  background: '#161B22',
                  border: `1px solid ${isKnown ? 'rgba(46,160,67,0.4)' : '#30363D'}`,
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                <div className="text-[10px] tracking-[0.12em] uppercase mb-5 font-medium" style={{ color: '#8B949E' }}>
                  Term / Concept
                </div>
                <div className="text-md-on-surface leading-snug" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)' }}>
                  {card.front}
                </div>
                <div className="text-xs mt-8 flex items-center gap-1.5" style={{ color: '#484F58' }}>
                  <kbd className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: '#1F2937', border: '1px solid #30363D', color: '#8B949E' }}>Space</kbd>
                  to reveal
                </div>
                {isKnown && (
                  <div className="absolute top-4 right-4 text-[10px] px-2.5 py-1 rounded font-semibold" style={{ background: 'rgba(46,160,67,0.12)', color: '#56D364', border: '1px solid rgba(46,160,67,0.25)' }}>
                    ✓ Known
                  </div>
                )}
              </div>

              {/* Back */}
              <div
                className="flip-card-back rounded-3xl flex flex-col items-center justify-center p-10 text-center"
                style={{ background: 'linear-gradient(135deg, #1D3461 0%, #161B22 100%)', border: '1px solid rgba(61,126,255,0.35)', boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 16px rgba(0,0,0,0.4)' }}
              >
                <div className="text-md-primary text-[10px] tracking-[0.2em] uppercase mb-4">
                  Definition
                </div>
                <div className="text-md-on-surface text-[15px] leading-relaxed max-w-xl">
                  {card.back}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="h-10 px-5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default bg-md-surface-container text-md-on-surface border-md-outline-variant hover:bg-md-surface-container-high"
              >
                ← Previous
              </button>
              <button
                onClick={() => goTo(index + 1)}
                disabled={index >= filtered.length - 1}
                className="h-10 px-5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default bg-md-surface-container text-md-on-surface border-md-outline-variant hover:bg-md-surface-container-high"
              >
                Next →
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => markFlashcardReview(card.id)}
                className="h-10 px-5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Review Again
              </button>
              <button
                onClick={() => markFlashcardKnown(card.id)}
                className={`h-10 px-5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer ${
                  isKnown
                    ? 'bg-green-900/20 text-green-400 border-green-400/50'
                    : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                }`}
                style={isKnown ? { boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(74,222,128,0.12), 0 2px 10px rgba(74,222,128,0.2)' } : {}}
              >
                {isKnown ? '✓ Known' : 'Mark as Known'}
              </button>
            </div>
          </div>

          {/* Progress summary */}
          <div className="grid grid-cols-4 gap-4 bg-md-surface-container rounded-3xl p-5 border border-md-outline-variant mt-8">
            {[
              { label: 'Total in filter', value: filtered.length, color: 'text-md-on-surface-variant' },
              { label: 'Studied', value: filtered.filter((c) => flashcardsStudied.includes(c.id)).length, color: 'text-blue-400' },
              { label: 'Known', value: knownCount, color: 'text-green-400' },
              { label: 'Remaining', value: filtered.length - knownCount, color: 'text-md-primary' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`font-display text-2xl ${color}`}>{value}</div>
                <div className="text-md-on-surface-variant text-[10px] uppercase tracking-wide mt-1">{label}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-md-surface-container rounded-3xl p-16 border border-md-outline-variant text-center">
          <div className="font-display text-md-on-surface text-xl mb-2">No cards match your filters</div>
          <div className="text-md-on-surface-variant text-sm">
            Try adjusting the topic, chapter, or showing known cards.
          </div>
        </div>
      )}
    </div>
  );
}

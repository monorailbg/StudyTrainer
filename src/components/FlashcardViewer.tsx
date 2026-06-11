import { useState, useEffect, useRef, useCallback } from 'react';
import type { GeneratedFlashcard } from '../lib/generator';
import { useSRS, subjectSrsStats } from '../store/useSRS';
import { useLang } from '../context/LanguageContext';
import type { Rating, CardState } from '../lib/srs';

// ── SRS state colours & chip ───────────────────────────────────────────────
const STATE_COLOR: Record<CardState, string> = {
  NEW:        '#56D364',
  LEARNING:   '#D29922',
  GRADUATED:  '#8B5CF6',
};

function StatChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px', borderRadius: '999px',
      background: color + '16', border: `1px solid ${color}30`,
      fontSize: '10px', fontWeight: 700, color,
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </div>
  );
}

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
      {vocab.reading && (
        <div style={{
          fontFamily: "'LXGW WenKai Mono TC', 'JetBrains Mono', monospace",
          fontSize: '17px',
          color: 'var(--text-3)',
          letterSpacing: '0.06em',
          textAlign: 'center',
        }}>
          {vocab.reading}
        </div>
      )}

      <div style={{
        fontFamily: "'LXGW WenKai Mono TC', monospace",
        fontWeight: 700,
        fontSize: 'clamp(26px, 5vw, 40px)',
        color: 'var(--text-1)',
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        {vocab.meaning}
      </div>

      {(vocab.example || vocab.translation) && (
        <div style={{ width: '36px', height: '1px', background: color + '40', margin: '2px 0' }} />
      )}

      {vocab.example && (
        <div style={{
          fontFamily: "'LXGW WenKai Mono TC', serif",
          fontSize: '16px',
          color: 'var(--text-2)',
          textAlign: 'center',
          lineHeight: 1.8,
          letterSpacing: '0.02em',
        }}>
          {vocab.example}
        </div>
      )}

      {vocab.translation && (
        <div style={{
          fontFamily: "'LXGW WenKai Mono TC', monospace",
          fontWeight: 300,
          fontSize: '14px',
          color: 'var(--text-2)',
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

// ── Card edit draft ───────────────────────────────────────────────────────────

interface CardEditDraft {
  front: string;
  back: string;
}

// ── Inline card editor ─────────────────────────────────────────────────────────

function CardEditForm({
  draft, color, onChange, onSave, onCancel,
}: {
  draft: CardEditDraft;
  color: string;
  onChange: (d: CardEditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { ts } = useLang();

  const fieldBase: React.CSSProperties = {
    width: '100%', background: 'var(--bg-surface)', color: 'var(--text-1)',
    border: '1px solid var(--border-light)', borderRadius: '10px',
    padding: '10px 14px', fontSize: '15px',
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: 'none', lineHeight: 1.5,
    boxSizing: 'border-box', resize: 'none' as const,
  };

  return (
    <div
      className="anim-fadein"
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        marginBottom: '20px',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" stroke="var(--text-2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-2)' }}>
            {ts('Edit Card')}
          </span>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', padding: '4px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
        >
          <svg viewBox="0 0 14 14" width="13" height="13" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '18px 20px' }}>
        {/* Front */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color, marginBottom: '7px' }}>
            {ts('Front')}
          </div>
          <textarea
            value={draft.front}
            onChange={e => onChange({ ...draft, front: e.target.value })}
            rows={3}
            style={fieldBase}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
          />
        </div>

        {/* Back */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color, marginBottom: '7px' }}>
            {ts('Back')}
          </div>
          <textarea
            value={draft.back}
            onChange={e => onChange({ ...draft, back: e.target.value })}
            rows={4}
            style={fieldBase}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              height: '34px', padding: '0 16px', borderRadius: '999px',
              background: 'transparent', border: '1px solid var(--border-base)',
              color: 'var(--text-2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {ts('Cancel')}
          </button>
          <button
            onClick={onSave}
            style={{
              height: '34px', padding: '0 20px', borderRadius: '999px',
              background: color, border: 'none',
              color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 2px 10px ${color}38`,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            ✓ {ts('Save Edit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FlashcardViewer({ cards, color, subjectId, onSessionEnd, onGoToQuiz, onBack }: {
  cards: GeneratedFlashcard[];
  color: string;
  subjectId?: string;
  onSessionEnd?: (reviewedCount: number) => void;
  onGoToQuiz?: () => void;
  onBack?: () => void;
}) {
  const { ts } = useLang();
  const srsMode  = !!subjectId;
  const rate       = useSRS(s => s.rate);
  const resetCards = useSRS(s => s.resetCards);
  const srsCards   = useSRS(s => s.cards);

  // SRS mode: Anki-like mutable queue (front = current card)
  const [queue, setQueue] = useState<GeneratedFlashcard[]>(() => [...cards]);
  const totalRef = useRef(cards.length); // original count (never changes after mount)

  // Non-SRS mode: simple index navigation
  const [index, setIndex] = useState(0);

  const [flipped,       setFlipped]      = useState(false);
  const [reviewed,      setReviewed]     = useState(0);
  const [showSettings,  setShowSettings] = useState(false);
  const [confirmReset,  setConfirmReset] = useState(false);

  // Inline card edit state
  const [cardOverrides, setCardOverrides] = useState<Record<string, CardEditDraft>>({});
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardDraft, setEditCardDraft] = useState<CardEditDraft | null>(null);

  const reviewedRef  = useRef(0);
  const reportedRef  = useRef(false);

  const report = useCallback(() => {
    if (reportedRef.current || reviewedRef.current === 0) return;
    reportedRef.current = true;
    onSessionEnd?.(reviewedRef.current);
  }, [onSessionEnd]);

  // Report on unmount
  useEffect(() => () => { report(); }, [report]);

  // Derived current card — never access before empty-state guard below
  const card = srsMode ? queue[0] : cards[index];

  // Apply any user override to the currently displayed card
  const cardOv = card ? cardOverrides[card.id] : null;
  const displayCard = (card && cardOv) ? { ...card, front: cardOv.front, back: cardOv.back } : card;

  // SRS session done = queue drained AND at least one card completed
  const done = srsMode && queue.length === 0 && reviewed > 0;

  // Report as soon as session completes
  useEffect(() => {
    if (done) report();
  }, [done, report]);

  const flip = () => setFlipped(f => !f);

  function startCardEdit() {
    if (!displayCard) return;
    const v = parseVocab(displayCard.back);
    if (v) return; // skip vocab cards — structured content
    setEditCardDraft({ front: displayCard.front, back: displayCard.back });
    setEditingCardId(displayCard.id);
    setFlipped(false);
  }
  function cancelCardEdit() { setEditingCardId(null); setEditCardDraft(null); }
  function saveCardEdit() {
    if (!card || !editCardDraft) return;
    setCardOverrides(prev => ({ ...prev, [card.id]: editCardDraft }));
    setEditingCardId(null);
    setEditCardDraft(null);
  }
  const isEditingCard = editingCardId === card?.id;

  const prev = () => { setIndex(i => Math.max(0, i - 1)); setFlipped(false); };
  const next = () => { setIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); };

  const handleRate = useCallback((rating: Rating) => {
    if (!card) return;

    // Always persist the rating immediately (updates SRS schedule even on Again)
    if (subjectId) rate(card.id, subjectId, rating);

    setFlipped(false);

    if (rating === 'again') {
      // Anki behavior: re-insert after the next few cards so the user gets
      // a short break before seeing it again.
      setQueue(q => {
        const [first, ...rest] = q;
        const insertAt = Math.min(3, rest.length);
        return [
          ...rest.slice(0, insertAt),
          first,
          ...rest.slice(insertAt),
        ];
      });
    } else {
      // Hard / Good / Easy: card is finished for this session
      const n = reviewedRef.current + 1;
      reviewedRef.current = n;
      setReviewed(n);
      setQueue(q => q.slice(1));
    }
  }, [card, subjectId, rate]);

  // Keyboard shortcuts
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
      if (!srsMode && e.key === 'ArrowLeft')  prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Empty state ────────────────────────────────────────────────────────────
  if (cards.length === 0) {
    return (
      <div className="anim-fadein" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '14px', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: color + '1A', border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--text-1)' }}>
          {srsMode ? ts('All caught up!') : ts('No cards in this set')}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          {srsMode
            ? ts("No cards are due for review right now. Come back later!")
            : ts("This set has no cards yet.")}
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="h-10 px-6 text-sm font-semibold cursor-pointer"
            style={{ background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-base)', borderRadius: '999px' }}
          >
            {ts('← Back to list')}
          </button>
        )}
      </div>
    );
  }

  // ── SRS: session complete ──────────────────────────────────────────────────
  if (srsMode && done) {
    return (
      <div className="anim-fadein" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '14px', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: color + '1A', border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--text-1)' }}>
          {ts('Session complete')}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          {ts('You reviewed {n} card{s}. Schedule updated.', { n: reviewed, s: reviewed !== 1 ? 's' : '' })}
        </div>
        <button
          onClick={() => {
            setQueue([...cards]);
            setFlipped(false);
            setReviewed(0);
            reviewedRef.current = 0;
            reportedRef.current = false;
            totalRef.current = cards.length;
          }}
          className="h-10 px-6 text-sm font-semibold cursor-pointer"
          style={{ marginTop: '6px', background: color + '18', color, border: `1px solid ${color}45`, borderRadius: '999px' }}
        >
          {ts('Review again')}
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="h-10 px-6 text-sm font-semibold cursor-pointer"
            style={{ background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-base)', borderRadius: '999px' }}
          >
            {ts('← Back to list')}
          </button>
        )}
        {onGoToQuiz && (
          <button
            onClick={onGoToQuiz}
            className="h-10 px-6 text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-1)', border: '1px solid var(--border-base)', borderRadius: '999px' }}
          >
            {ts('Test your Knowledge →')}
          </button>
        )}
      </div>
    );
  }

  // Safety guard — should not be reachable after the empty-state check above
  if (!card) return null;

  const cardW      = 'min(740px, 96vw)';
  const vocab      = parseVocab(displayCard?.back ?? card.back);
  const isVocabCard = vocab !== null;

  // Progress: in SRS mode, fraction of initial cards completed
  const progress = srsMode
    ? (reviewed / Math.max(1, totalRef.current)) * 100
    : ((index + 1) / cards.length) * 100;

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '70vh', justifyContent: 'center', paddingTop: '12px', paddingBottom: '24px' }}>
      {/* Progress bar */}
      <div className="flashcard-progress-bar-track h-px mb-5 overflow-hidden" style={{ width: '100%', background: 'var(--border-base)', borderRadius: '1px' }}>
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

      {/* SRS stats bar */}
      {srsMode && (() => {
        const cardIds = cards.map(c => c.id);
        const stats   = subjectSrsStats(srsCards, cardIds);
        const currentState = srsCards[card.id]?.state;
        return (
          <div style={{ width: cardW, marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <StatChip label="left"     count={queue.length}    color={color} />
              {stats.due      > 0 && <StatChip label="due"      count={stats.due}       color="#D29922" />}
              {stats.unseen   > 0 && <StatChip label="new"      count={stats.unseen}    color="#56D364" />}
              {stats.learning > 0 && <StatChip label="learning" count={stats.learning}  color="#60a5fa" />}
              {stats.graduated > 0 && <StatChip label="grad"   count={stats.graduated}  color="#8B5CF6" />}
              {currentState && (
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', padding: '3px 8px', borderRadius: '999px',
                    background: STATE_COLOR[currentState] + '18',
                    color: STATE_COLOR[currentState],
                    border: `1px solid ${STATE_COLOR[currentState]}33`,
                  }}>
                    {currentState}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Counter + topic + settings */}
      <div className="flashcard-meta flex items-center justify-between mb-4" style={{ width: cardW }}>
        <span className="mono text-xs" style={{ color: 'var(--text-2)' }}>
          {srsMode
            ? `${queue.length} remaining`
            : `${index + 1} / ${cards.length}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: color + '10', color, border: `1px solid ${color}20` }}>
            {displayCard!.topic}
          </span>

          {/* Edit card button — non-vocab cards only */}
          {!isVocabCard && !isEditingCard && (
            <button
              onClick={startCardEdit}
              aria-label={ts('Edit this card')}
              title={ts('Edit this card')}
              style={{
                width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer',
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg viewBox="0 0 14 14" width="13" height="13" fill="none">
                <path d="M9.5 2.5l2 2L5 11H3v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {/* Override indicator dot */}
          {cardOv && !isEditingCard && (
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, display: 'inline-block' }} title={ts('Edited')} />
          )}

          {/* Settings button — SRS mode only */}
          {srsMode && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowSettings(v => !v); setConfirmReset(false); }}
                aria-label={ts('Settings')}
                style={{
                  width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer',
                  background: showSettings ? 'var(--bg-elevated)' : 'transparent',
                  border: `1px solid ${showSettings ? 'var(--border-base)' : 'transparent'}`,
                  color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                onMouseLeave={e => { if (!showSettings) { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; } }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M13.3 6.6l-.7-1.7-1.4.3-1-1-.3-1.4-1.7-.7-.9 1.1H8.7l-.9-1.1-1.7.7-.3 1.4-1 1-1.4-.3-.7 1.7 1.1.9v1.4l-1.1.9.7 1.7 1.4-.3 1 1 .3 1.4 1.7.7.9-1.1h1.4l.9 1.1 1.7-.7.3-1.4 1-1 1.4.3.7-1.7-1.1-.9v-1.4l1.1-.9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              </button>

              {showSettings && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                    onClick={() => { setShowSettings(false); setConfirmReset(false); }}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-base)', borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: '6px', minWidth: '200px',
                  }}>
                    {!confirmReset ? (
                      <>
                        <div style={{ padding: '6px 10px 8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                          {ts('SRS Settings')}
                        </div>
                        <button
                          onClick={() => setConfirmReset(true)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                            padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                            background: 'transparent', color: '#f87171',
                            border: 'none', fontSize: '12px', fontWeight: 600, textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
                            <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {ts('Reset SRS progress')}
                        </button>
                      </>
                    ) : (
                      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-1)', lineHeight: 1.5 }}>
                          {ts('This clears all SRS data for {n} cards. Cannot be undone.', { n: cards.length })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => {
                              resetCards(cards.map(c => c.id));
                              setQueue([...cards]);
                              setReviewed(0);
                              reviewedRef.current = 0;
                              reportedRef.current = false;
                              totalRef.current = cards.length;
                              setShowSettings(false);
                              setConfirmReset(false);
                            }}
                            style={{
                              flex: 1, padding: '7px 0', borderRadius: '8px', cursor: 'pointer',
                              background: 'rgba(248,113,113,0.15)', color: '#f87171',
                              border: '1px solid rgba(248,113,113,0.35)', fontSize: '12px', fontWeight: 700,
                            }}
                          >
                            {ts('Reset')}
                          </button>
                          <button
                            onClick={() => setConfirmReset(false)}
                            style={{
                              flex: 1, padding: '7px 0', borderRadius: '8px', cursor: 'pointer',
                              background: 'transparent', color: 'var(--text-2)',
                              border: '1px solid var(--border-base)', fontSize: '12px', fontWeight: 600,
                            }}
                          >
                            {ts('Cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Flip card or inline editor */}
      {isEditingCard && editCardDraft ? (
        <CardEditForm
          draft={editCardDraft}
          color={color}
          onChange={setEditCardDraft}
          onSave={saveCardEdit}
          onCancel={cancelCardEdit}
        />
      ) : (
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
                background: 'var(--bg-surface)',
                border: `1px solid ${isVocabCard ? color + '35' : color + '25'}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                {isVocabCard ? ts('Word') : ts('Question')}
              </div>
              {isVocabCard ? (
                <div style={{
                  fontFamily: "'LXGW WenKai Mono TC', monospace",
                  fontWeight: 700,
                  fontSize: 'clamp(40px, 12vw, 72px)',
                  color: 'var(--text-1)',
                  textAlign: 'center',
                  lineHeight: 1.1,
                  letterSpacing: '0.06em',
                }}>
                  {displayCard!.front}
                </div>
              ) : (
                <div className="text-center leading-relaxed" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 'clamp(18px, 2.5vw, 26px)', color: 'var(--text-1)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                  {displayCard!.front}
                </div>
              )}
              <div className="hidden md:flex text-xs mt-1 items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <kbd className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-2)' }}>Space</kbd>
                {ts('to reveal')}
              </div>
            </div>

            {/* Back */}
            <div
              className="flip-card-back flex flex-col items-center justify-center gap-4"
              style={{
                padding: 'clamp(32px, 5vw, 52px) clamp(28px, 5vw, 52px)',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${color}12 0%, var(--bg-elevated) 100%)`,
                border: `1px solid ${color}40`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
                {isVocabCard ? ts('Meaning') : ts('Answer')}
              </div>
              {isVocabCard && vocab ? (
                <VocabBack vocab={vocab} color={color} />
              ) : (
                <div className="text-center" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', color: 'var(--text-1)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {displayCard!.back}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
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
              <div className="hidden md:block text-center mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
                {ts('How well did you recall this?')}{' '}
                <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-2)' }}>1</kbd>
                –
                <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-2)' }}>4</kbd>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={flip}
                className="h-11 px-8 text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-1)', border: '1px solid var(--border-base)', borderRadius: '9999px' }}
              >
                {ts('Show answer')}
              </button>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {ts('{n} reviewed this session', { n: reviewed })}
              </span>
            </div>
          )
        ) : (
          <>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={prev}
                disabled={index === 0}
                className="h-10 px-5 text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-base)', borderRadius: '9999px', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 3px rgba(0,0,0,0.3)' }}
                aria-label={ts('Previous card')}
              >
                {ts('← Prev')}
              </button>

              <button
                onClick={flip}
                className="h-10 px-7 text-sm font-semibold transition-all duration-150 cursor-pointer btn-accent"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-1)', border: '1px solid var(--border-base)', borderRadius: '9999px' }}
              >
                {ts('Flip card')}
              </button>

              <button
                onClick={next}
                disabled={index === cards.length - 1}
                className="h-10 px-5 text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-base)', borderRadius: '9999px', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 3px rgba(0,0,0,0.3)' }}
                aria-label={ts('Next card')}
              >
                {ts('Next →')}
              </button>
            </div>

            <div className="text-center mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
              <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-2)' }}>←</kbd>
              {' '}/{' '}
              <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-2)' }}>→</kbd>
              {' '}{ts('navigate')}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}

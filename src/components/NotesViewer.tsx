import { useState, useEffect, useRef, useLayoutEffect, forwardRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { GeneratedNote, GeneratedNoteSection } from '../lib/generator';
import { AskAI } from './AskAI';
import { useAnnotations, type Annotation } from '../store/useAnnotations';
import { useLang } from '../context/LanguageContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcReadTime(note: GeneratedNote): number {
  const text = [
    note.summary,
    ...note.sections.flatMap(s => [s.content, ...(s.keyPoints ?? [])]),
  ].join(' ');
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]+[.!?]/);
  return m ? m[0] : text.slice(0, 120) + '…';
}

// ── RichText: **bold** → accent-highlighted strong ───────────────────────────

function RichText({ text, accent }: { text: string; accent: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        if (m) return (
          <strong key={i} style={{
            background: accent + '22',
            color: accent,
            borderRadius: '3px',
            padding: '1px 5px',
            fontWeight: 600,
          }}>
            {m[1]}
          </strong>
        );
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Annotation constants ──────────────────────────────────────────────────────

const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Yellow', value: 'rgba(255,214,0,0.35)' },
  { id: 'teal',   label: 'Teal',   value: 'rgba(0,210,190,0.30)' },
  { id: 'pink',   label: 'Pink',   value: 'rgba(255,100,150,0.28)' },
] as const;

// ── buildSegments: merges bold markers + annotations into renderable segments ──

type Segment = {
  text: string;
  isBold: boolean;
  annotation?: Annotation | null;
};

function buildSegments(rawText: string, annotations: Annotation[]): Segment[] {
  type BoldSeg = { text: string; isBold: boolean; visStart: number; visEnd: number };
  const boldSegs: BoldSeg[] = [];
  const boldRe = /\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let visPos = 0;
  let m: RegExpExecArray | null;

  while ((m = boldRe.exec(rawText)) !== null) {
    if (m.index > lastIdx) {
      const t = rawText.slice(lastIdx, m.index);
      boldSegs.push({ text: t, isBold: false, visStart: visPos, visEnd: visPos + t.length });
      visPos += t.length;
    }
    const t = m[1];
    boldSegs.push({ text: t, isBold: true, visStart: visPos, visEnd: visPos + t.length });
    visPos += t.length;
    lastIdx = boldRe.lastIndex;
  }
  if (lastIdx < rawText.length) {
    const t = rawText.slice(lastIdx);
    boldSegs.push({ text: t, isBold: false, visStart: visPos, visEnd: visPos + t.length });
  }

  const visibleText = boldSegs.map(s => s.text).join('');
  const annRanges: { start: number; end: number; ann: Annotation }[] = [];
  for (const ann of annotations) {
    if (!ann.selectedText) continue;
    const idx = visibleText.indexOf(ann.selectedText);
    if (idx !== -1) annRanges.push({ start: idx, end: idx + ann.selectedText.length, ann });
  }
  annRanges.sort((a, b) => a.start - b.start);

  if (annRanges.length === 0) {
    return boldSegs.map(s => ({ text: s.text, isBold: s.isBold, annotation: null }));
  }

  const result: Segment[] = [];
  for (const bs of boldSegs) {
    let pos = bs.visStart;
    for (const ar of annRanges) {
      if (ar.end <= pos || ar.start >= bs.visEnd) continue;
      if (ar.start > pos) {
        const t = bs.text.slice(pos - bs.visStart, ar.start - bs.visStart);
        if (t) result.push({ text: t, isBold: bs.isBold, annotation: null });
        pos = ar.start;
      }
      const end = Math.min(ar.end, bs.visEnd);
      const t = bs.text.slice(pos - bs.visStart, end - bs.visStart);
      if (t) result.push({ text: t, isBold: bs.isBold, annotation: ar.ann });
      pos = end;
    }
    if (pos < bs.visEnd) {
      const t = bs.text.slice(pos - bs.visStart);
      if (t) result.push({ text: t, isBold: bs.isBold, annotation: null });
    }
  }
  return result;
}

// ── AnnotatedRichText ─────────────────────────────────────────────────────────

function AnnotatedRichText({ rawText, accent, annotations }: {
  rawText: string;
  accent: string;
  annotations: Annotation[];
}) {
  const segments = useMemo(() => buildSegments(rawText, annotations), [rawText, annotations]);
  return (
    <>
      {segments.map((seg, i) => {
        const ann = seg.annotation;
        let annStyle: React.CSSProperties = {};
        if (ann) {
          if (ann.type === 'highlight') {
            annStyle = {
              background: ann.color ?? 'rgba(255,214,0,0.35)',
              borderRadius: '2px', padding: '0 1px',
              opacity: 1,
            };
          } else {
            annStyle = { textDecoration: 'underline', textDecorationColor: accent, textUnderlineOffset: '3px' };
          }
        }
        if (seg.isBold) {
          return (
            <strong key={i} data-ann-id={ann?.id} style={{
              background: ann ? undefined : accent + '22',
              color: accent, borderRadius: '3px',
              padding: '1px 5px', fontWeight: 600,
              ...annStyle,
            }}>{seg.text}</strong>
          );
        }
        if (ann) {
          return (
            <mark key={i} data-ann-id={ann.id} style={{ background: 'transparent', ...annStyle }}>
              {seg.text}
            </mark>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}

// ── AnnotationToolbar ─────────────────────────────────────────────────────────

interface SelRect { left: number; top: number; bottom: number; width: number }

function AnnotationToolbar({ rect, accent, existingId, onHighlight, onUnderline, onRemove, onDismiss }: {
  rect: SelRect;
  accent: string;
  existingId?: string;
  onHighlight: (color: string) => void;
  onUnderline: () => void;
  onRemove?: () => void;
  onDismiss: () => void;
}) {
  const { ts } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  // Measure the toolbar once rendered, then position it centered over the
  // selection — above by default, flipping below when too close to the top.
  // getBoundingClientRect is viewport-relative and the toolbar is position:fixed
  // + portaled to <body>, so coordinates map directly with no scroll math and
  // no interference from transformed/filtered ancestors (e.g. dim mode).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const m = 8;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(m, Math.min(left, window.innerWidth - tw - m));
    let top = rect.top - th - 10;
    let below = false;
    if (top < m) { top = rect.bottom + 10; below = true; }
    setPos({ left, top, below });
  }, [rect]);

  // Dismiss on outside click or any scroll (selection coords would go stale).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onDismiss, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onDismiss, true);
    };
  }, [onDismiss]);

  // Centre x of the selection relative to the toolbar, for the caret.
  const caretX = pos
    ? Math.max(12, Math.min(rect.left + rect.width / 2 - pos.left, (ref.current?.offsetWidth ?? 200) - 12))
    : 0;

  return createPortal(
    <div
      ref={ref}
      onMouseDown={e => e.preventDefault()} // keep selection; don't trigger outside-hide
      style={{
        position: 'fixed',
        left: pos ? pos.left : rect.left,
        top: pos ? pos.top : rect.top - 50,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px',
        background: '#111827', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '999px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        userSelect: 'none',
      }}
    >
      {HIGHLIGHT_COLORS.map(c => (
        <button
          key={c.id}
          onClick={() => onHighlight(c.value)}
          title={ts('Highlight {color}', { color: ts(c.label) })}
          style={{
            width: '18px', height: '18px', borderRadius: '50%',
            background: c.value, border: '1.5px solid rgba(255,255,255,0.2)',
            cursor: 'pointer', flexShrink: 0,
          }}
        />
      ))}
      <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
      <button
        onClick={onUnderline}
        title={ts('Underline')}
        style={{
          width: '26px', height: '26px', borderRadius: '7px',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer', color: accent, fontSize: '13px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'underline', textUnderlineOffset: '3px',
        }}
      >U</button>
      {existingId && onRemove && (
        <>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
          <button
            onClick={onRemove}
            title={ts('Remove')}
            style={{
              width: '26px', height: '26px', borderRadius: '7px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', color: '#F85149', fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </>
      )}
      {/* Caret pointing toward the selection */}
      {pos && (
        <span
          style={{
            position: 'absolute', left: caretX, width: 0, height: 0,
            transform: 'translateX(-50%)',
            ...(pos.below
              ? { top: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid #111827' }
              : { bottom: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #111827' }),
          }}
        />
      )}
    </div>,
    document.body
  );
}

// ── Recall card: inline self-test ─────────────────────────────────────────────

function RecallCard({ heading, keyPoints, color }: { heading: string; keyPoints: string[]; color: string }) {
  const { ts } = useLang();
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={{
      marginTop: '10px', borderRadius: '10px',
      border: `1px solid ${color}28`, background: color + '0d', padding: '14px 16px',
    }}>
      <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, lineHeight: 1.5, color: 'rgba(230,237,243,0.8)' }}>
        {ts('Can you explain:')} <span style={{ color }}>{heading}</span>?
      </p>
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          style={{
            padding: '5px 13px', borderRadius: '7px',
            border: `1px solid ${color}40`, background: color + '18',
            color, cursor: 'pointer', fontSize: '12px', fontWeight: 600,
          }}
        >
          {ts('Reveal key points')}
        </button>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {keyPoints.map((pt, i) => (
            <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color, fontSize: '10px', marginTop: '4px', flexShrink: 0 }}>▸</span>
              <span style={{ fontSize: '13px', lineHeight: 1.62, color: 'rgba(230,237,243,0.75)' }}>{pt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  index: number;
  section: GeneratedNoteSection;
  color: string;
  understood: boolean;
  collapsed: boolean;
  annotations: Annotation[];
  onToggleUnderstood: () => void;
  onToggleCollapsed: () => void;
}

const SectionCard = forwardRef<HTMLDivElement, SectionCardProps>(function SectionCard(
  { index, section, color, understood, collapsed, annotations, onToggleUnderstood, onToggleCollapsed },
  ref
) {
  const { ts } = useLang();
  const [recallOpen, setRecallOpen] = useState(false);
  const num = String(index + 1).padStart(2, '0');
  const hasKeyPoints = (section.keyPoints ?? []).length > 0;

  return (
    <div
      ref={ref}
      data-section-idx={String(index)}
      className="notes-section-card"
      style={{
        marginBottom: '24px',
        borderRadius: '16px',
        border: `1px solid ${understood ? 'rgba(72,199,142,0.35)' : 'rgba(255,255,255,0.075)'}`,
        background: understood ? 'rgba(72,199,142,0.04)' : 'rgba(255,255,255,0.030)',
        transition: 'border-color 0.2s ease, background 0.2s ease',
        scrollMarginTop: '16px',
        boxShadow: '0 2px 20px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.02)',
      }}
    >
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: 'clamp(14px, 3vw, 24px) clamp(14px, 4vw, 36px) 0',
        marginBottom: '20px', paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          flexShrink: 0, width: '32px', height: '32px', minWidth: '32px', borderRadius: '8px',
          background: 'rgba(99,102,241,0.20)', border: '1px solid rgba(99,102,241,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, color: 'rgba(99,102,241,0.90)', fontVariantNumeric: 'tabular-nums' }}>
            {num}
          </span>
        </div>

        <h3 style={{
          flex: 1, margin: 0, fontSize: '17px', fontWeight: 700,
          color: 'rgba(255,255,255,0.95)', fontFamily: 'Sora, sans-serif', lineHeight: 1.3,
          letterSpacing: '-0.01em',
        }}>
          {section.heading}
        </h3>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={onToggleCollapsed}
            style={{
              background: collapsed ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: `1px solid ${collapsed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: '6px', padding: '4px 10px',
              cursor: 'pointer', fontSize: '11px', fontWeight: 600,
              color: collapsed ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.35)',
              letterSpacing: '0.06em', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {ts('TL;DR')}
          </button>
          <button
            onClick={onToggleUnderstood}
            title={understood ? ts('Mark as not understood') : ts('Got it')}
            style={{
              width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
              border: `1px solid ${understood ? 'rgba(72,199,142,0.40)' : 'rgba(255,255,255,0.10)'}`,
              background: understood ? 'rgba(72,199,142,0.15)' : 'transparent',
              color: understood ? 'rgba(72,199,142,0.90)' : 'rgba(255,255,255,0.20)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '0 clamp(14px, 4vw, 36px) 28px' }}>
        <p className="notes-section-body" style={{
          margin: '0 0 20px', fontSize: '15px', lineHeight: 1.80,
          color: 'rgba(255,255,255,0.82)', fontWeight: 400,
          maxWidth: '640px', letterSpacing: '0.01em',
        }}>
          {collapsed ? (
            <>
              {firstSentence(section.content)}
              {' '}
              <button
                onClick={onToggleCollapsed}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', color, fontWeight: 500 }}
              >
                {ts('Read more')}
              </button>
            </>
          ) : (
            <AnnotatedRichText rawText={section.content} accent={color} annotations={annotations} />
          )}
        </p>

        {/* Formula block */}
        {!collapsed && section.formula && (
          <div style={{
            margin: '16px 0 20px', padding: '16px 20px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: '3px solid rgba(72,199,142,0.50)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
            color: 'rgba(72,199,142,0.90)', lineHeight: 1.7,
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            overflowX: 'auto',
          }}>
            <span style={{ opacity: 0.5, fontSize: '12px', marginTop: '1px', flexShrink: 0, color: 'rgba(255,255,255,0.35)' }}>∑</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{section.formula}</span>
          </div>
        )}

        {/* Diagram block */}
        {!collapsed && section.diagram && (
          <div style={{
            margin: '16px 0 20px', padding: '16px 20px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: '3px solid rgba(255,255,255,0.15)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
            color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            overflowX: 'auto',
          }}>
            <span style={{ opacity: 0.4, fontSize: '12px', marginTop: '1px', flexShrink: 0, color: 'rgba(255,255,255,0.35)' }}>→</span>
            <span>{section.diagram}</span>
          </div>
        )}

        {!collapsed && hasKeyPoints && (
          <ul style={{ margin: '16px 0 4px', padding: '0 0 0 4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(section.keyPoints ?? []).map((pt, j) => (
              <li key={j} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', maxWidth: '640px' }}>
                <span style={{
                  flexShrink: 0, width: '5px', height: '5px', minWidth: '5px', borderRadius: '50%',
                  background: 'rgba(72,199,142,0.60)', marginTop: '8px',
                }} />
                <span style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.72)' }}>
                  <RichText text={pt} accent={color} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {!collapsed && (
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => setRecallOpen(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.28)',
                display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content',
                transition: 'color 0.15s', letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(212,175,55,0.80)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)'; }}
            >
              <svg viewBox="0 0 10 10" width="14" height="14" fill="none" style={{ opacity: 0.5 }}>
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 4c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .6-.37 1.1-.9 1.35L5 5.7V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="5" cy="7.75" r=".4" fill="currentColor" />
              </svg>
              {recallOpen ? ts('Hide recall') : ts('Test yourself')}
            </button>
          </div>
        )}

        {!collapsed && recallOpen && (
          <RecallCard heading={section.heading} keyPoints={section.keyPoints ?? []} color={color} />
        )}
      </div>
    </div>
  );
});

// ── NotesViewer ───────────────────────────────────────────────────────────────

export function NotesViewer({ notes, color = '#3D7EFF', noteId, scrollElRef, onRead, onGoToFlashcards, fullFocus, onToggleFullFocus }: {
  notes: GeneratedNote;
  color?: string;
  noteId?: string;
  scrollElRef?: React.RefObject<HTMLElement | null>;
  onRead?: () => void;
  onGoToFlashcards?: () => void;
  fullFocus?: boolean;
  onToggleFullFocus?: () => void;
}) {
  const { ts } = useLang();
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { annotations: allAnnotations, add: addAnnotation, remove: removeAnnotation, getForSection } = useAnnotations();
  const [toolbar, setToolbar] = useState<{
    rect: SelRect; sectionIndex: number; selectedText: string; existingId?: string;
  } | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const prevScrollTopRef = useRef(0);
  const [activeSection, setActiveSection] = useState(0);
  const [showToc, setShowToc] = useState(false);

  // Fire `onRead` once when the reader scrolls past 80% (or when the note is
  // short enough to fit without scrolling). Refs reset on remount per note.
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);
  const readFiredRef = useRef(false);
  const fireRead = useCallback(() => {
    if (readFiredRef.current) return;
    readFiredRef.current = true;
    onReadRef.current?.();
  }, []);

  // Understood state (persisted to localStorage when noteId is provided)
  const storageKey = noteId ? `notes-understood-${noteId}` : null;
  const [understood, setUnderstood] = useState<Set<number>>(() => {
    if (!storageKey) return new Set<number>();
    try { return new Set<number>(JSON.parse(localStorage.getItem(storageKey) ?? '[]')); }
    catch { return new Set<number>(); }
  });

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set<number>());

  const toggleUnderstood = useCallback((i: number) => {
    setUnderstood(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }, [storageKey]);

  const toggleCollapsed = useCallback((i: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  // Scroll progress + back-to-top
  useEffect(() => {
    const el = scrollElRef?.current;
    if (!el) return;
    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? scrollTop / max : 0;
      const atTop = scrollTop < 80;
      const scrollingDown = scrollTop > prevScrollTopRef.current + 4;
      document.body.classList.toggle('notes-scrolling-down', scrollingDown && !atTop);
      prevScrollTopRef.current = scrollTop;
      setScrollPct(pct);
      setShowBackTop(scrollTop > 300);
      if (max <= 0 || pct >= 0.8) fireRead();
    };
    el.addEventListener('scroll', handler, { passive: true });
    const t = setTimeout(() => {
      if ((el.scrollHeight - el.clientHeight) <= 0) fireRead();
    }, 800);
    return () => {
      el.removeEventListener('scroll', handler);
      clearTimeout(t);
      document.body.classList.remove('notes-scrolling-down');
    };
  }, [scrollElRef, fireRead]);

  // IntersectionObserver: track which section is currently in view
  useEffect(() => {
    const root = scrollElRef?.current ?? null;
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.sectionIdx);
            if (!isNaN(idx)) setActiveSection(idx);
          }
        }
      },
      { root, threshold: 0.3 }
    );
    sectionRefs.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [notes.sections, scrollElRef]);

  // j / k keyboard navigation between sections
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'j') {
        scrollToSection(Math.min(activeSection + 1, notes.sections.length - 1));
      } else if (e.key === 'k') {
        scrollToSection(Math.max(activeSection - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSection, notes.sections.length]);

  // Annotation: detect text selection and show toolbar
  const handleSelectionEnd = useCallback(() => {
    setTimeout(() => {
      // Ignore selections made inside form fields (search bar, AskAI textarea…)
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const text = sel.toString().trim();
      if (text.length < 2) return;

      // Find section index from DOM
      let el: Element | null = sel.anchorNode instanceof Element
        ? sel.anchorNode
        : sel.anchorNode?.parentElement ?? null;
      let sectionIndex = -1;
      while (el) {
        const idx = el.getAttribute('data-section-idx');
        if (idx !== null) { sectionIndex = Number(idx); break; }
        el = el.parentElement;
      }
      if (sectionIndex === -1) return;

      const r = sel.getRangeAt(0).getBoundingClientRect();
      setToolbar({
        rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width },
        sectionIndex,
        selectedText: text,
      });
    }, 10);
  }, []);

  // Annotation: click on existing annotation mark to show remove toolbar
  const handleAnnotationClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const annEl = target.closest('[data-ann-id]') as HTMLElement | null;
    const annId = annEl?.getAttribute('data-ann-id');
    if (!annId) return;
    const ann = allAnnotations.find(a => a.id === annId);
    if (!ann) return;
    const r = annEl!.getBoundingClientRect();
    setToolbar({
      rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width },
      sectionIndex: ann.sectionIndex,
      selectedText: ann.selectedText,
      existingId: annId,
    });
  }, [allAnnotations]);

  const applyAnnotation = useCallback((type: 'highlight' | 'underline', colorVal?: string) => {
    if (!toolbar || !noteId) return;
    addAnnotation({
      noteId,
      sectionIndex: toolbar.sectionIndex,
      type,
      color: colorVal,
      selectedText: toolbar.selectedText,
    });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  }, [toolbar, noteId, addAnnotation]);

  const scrollToSection = (i: number) => {
    const el = sectionRefs.current[i];
    if (!el) return;
    const container = scrollElRef?.current;
    if (container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollBy({ top: elTop - containerTop - 12, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveSection(i);
  };

  const backToTop = () =>
    scrollElRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const total = notes.sections.length;
  const completionPct = total > 0 ? Math.round((understood.size / total) * 100) : 0;
  const readTime = calcReadTime(notes);

  return (
    <div style={{ position: 'relative' }} onMouseUp={handleSelectionEnd} onTouchEnd={handleSelectionEnd} onClick={handleAnnotationClick}>
      {toolbar && (
        <AnnotationToolbar
          rect={toolbar.rect}
          accent={color}
          existingId={toolbar.existingId}
          onHighlight={(c) => applyAnnotation('highlight', c)}
          onUnderline={() => applyAnnotation('underline')}
          onRemove={toolbar.existingId ? () => { removeAnnotation(toolbar.existingId!); setToolbar(null); } : undefined}
          onDismiss={() => setToolbar(null)}
        />
      )}

      {/* Reading progress bar — sticky at top of scroll container */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, height: '2px', background: '#21262D' }}>
        <div style={{
          height: '100%', background: color,
          width: `${scrollPct * 100}%`,
          transition: 'width 80ms linear',
          borderRadius: '0 1px 1px 0',
        }} />
      </div>

      {/* Vertical "Contents" toggle pill */}
      <button
        onClick={() => setShowToc(v => !v)}
        className={`notes-toc-toggle${showToc ? ' panel-open' : ''}`}
        aria-label={showToc ? ts('Close contents') : ts('Open contents')}
      >
        {ts('Contents')}
      </button>

      {/* Fixed ToC panel */}
      <div className={`notes-toc-panel${showToc ? ' visible' : ''}`} role="navigation" aria-label={ts('Table of contents')}>
        {/* Reading progress bar */}
        <div className="contents-reading-progress" style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${scrollPct * 100}%`,
            background: 'linear-gradient(90deg, rgba(212,175,55,0.60), rgba(212,175,55,1.0))',
            borderRadius: '999px',
            transition: 'width 300ms ease',
          }} />
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase' }}>
          {ts('Contents')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {notes.sections.map((s, i) => (
            <button
              key={i}
              onClick={() => { scrollToSection(i); setShowToc(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '8px', marginBottom: '2px',
                cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left',
                borderLeft: activeSection === i ? '2px solid rgba(212,175,55,0.80)' : '2px solid transparent',
                backgroundColor: activeSection === i ? 'rgba(212,175,55,0.10)' : 'transparent',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { if (activeSection !== i) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (activeSection !== i) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, color: activeSection === i ? 'rgba(212,175,55,0.80)' : 'rgba(255,255,255,0.25)', minWidth: '20px', fontVariantNumeric: 'tabular-nums', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '12px', color: activeSection === i ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.45)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                {s.heading}
              </span>
              {understood.has(i) && (
                <span style={{ marginLeft: 'auto', color: 'rgba(72,199,142,0.80)', fontSize: '11px', flexShrink: 0 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Centered reading layout */}
      <div style={{ padding: 'clamp(16px, 4vw, 36px) clamp(12px, 4vw, 28px) clamp(40px, 8vw, 80px)' }}>

        {/* ── Content column ── */}
        <div className="notes-content-main" style={{ maxWidth: '740px', width: '100%', margin: '0 auto', minWidth: 0 }}>

          {/* Note metadata + completion header */}
          <div className="notes-meta-row" style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', color: '#484F58' }}>{ts('~{min} min read', { min: readTime })}</span>
              <span style={{ width: '3px', height: '3px', background: '#30363D', borderRadius: '50%' }} />
              <span style={{ fontSize: '11px', color: '#484F58' }}>{ts('{n} sections', { n: total })}</span>
              <span style={{ flex: 1 }} />
              {onToggleFullFocus && (
                <button
                  onClick={onToggleFullFocus}
                  title={fullFocus ? ts('Exit full focus') : ts('Full focus')}
                  style={{
                    background: fullFocus ? color + '20' : 'transparent',
                    border: `1px solid ${fullFocus ? color + '50' : '#30363D'}`,
                    borderRadius: '7px', padding: '3px 8px',
                    cursor: 'pointer', color: fullFocus ? color : '#484F58',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
                    transition: 'all 0.15s',
                  }}
                >
                  {fullFocus ? `⊡ ${ts('Focused')}` : `⊞ ${ts('Focus')}`}
                </button>
              )}
              {/* Understood progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '68px', height: '3px', borderRadius: '2px', background: '#21262D', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${completionPct}%`,
                    background: completionPct === 100 ? '#4ade80' : color,
                    borderRadius: '2px', transition: 'width 0.35s ease',
                  }} />
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  color: completionPct === 100 ? '#4ade80' : color,
                }}>
                  {ts('{pct}% understood', { pct: completionPct })}
                </span>
              </div>
            </div>
            {/* Section prev/next */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <button
                onClick={() => scrollToSection(activeSection - 1)}
                disabled={activeSection === 0}
                style={{
                  height: '26px', padding: '0 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                  background: 'transparent', border: '1px solid #30363D', color: '#8B949E',
                  cursor: activeSection === 0 ? 'default' : 'pointer',
                  opacity: activeSection === 0 ? 0.35 : 1, transition: 'opacity 0.15s',
                }}
              >
                ← {ts('Prev')}
              </button>
              <button
                onClick={() => scrollToSection(activeSection + 1)}
                disabled={activeSection >= notes.sections.length - 1}
                style={{
                  height: '26px', padding: '0 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                  background: 'transparent', border: '1px solid #30363D', color: '#8B949E',
                  cursor: activeSection >= notes.sections.length - 1 ? 'default' : 'pointer',
                  opacity: activeSection >= notes.sections.length - 1 ? 0.35 : 1, transition: 'opacity 0.15s',
                }}
              >
                {ts('Next')} →
              </button>
            </div>

            <h2 className="notes-title" style={{
              margin: '0 0 12px',
              fontFamily: 'Sora, sans-serif', fontWeight: 800,
              fontSize: '26px', color: '#E6EDF3', lineHeight: 1.3,
              letterSpacing: '-0.02em',
            }}>
              {notes.title}
            </h2>
            <p className="notes-section-body" style={{
              margin: '0 0 40px', fontSize: '14px', lineHeight: 1.7,
              color: 'rgba(255,255,255,0.48)', maxWidth: '600px',
            }}>
              <RichText text={notes.summary} accent={color} />
            </p>
          </div>

          {/* Section cards */}
          {notes.sections.map((section, i) => (
            <SectionCard
              key={i}
              ref={el => { sectionRefs.current[i] = el; }}
              index={i}
              section={section}
              color={color}
              understood={understood.has(i)}
              collapsed={collapsed.has(i)}
              annotations={noteId ? getForSection(noteId, i) : []}
              onToggleUnderstood={() => toggleUnderstood(i)}
              onToggleCollapsed={() => toggleCollapsed(i)}
            />
          ))}

          {/* Keyboard hint — desktop only */}
          <div className="hidden md:flex" style={{
            marginTop: '8px', padding: '10px 14px', borderRadius: '10px',
            background: '#161B22', border: '1px solid #21262D',
            alignItems: 'center', gap: '6px',
          }}>
            <span style={{ fontSize: '11px', color: '#30363D' }}>{ts('Navigate sections with')}</span>
            {(['j', 'k'] as const).map(k => (
              <kbd key={k} style={{
                fontSize: '10px', background: '#21262D', border: '1px solid #30363D',
                borderRadius: '4px', padding: '2px 6px', color: '#484F58',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{k}</kbd>
            ))}
          </div>

          <AskAI
            context={[notes.title, notes.summary, ...notes.sections.map(s => s.heading + '\n' + s.content + (s.keyPoints?.length ? '\n' + s.keyPoints.join('\n') : ''))].join('\n')}
            color={color}
          />

          {onGoToFlashcards && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={onGoToFlashcards}
                style={{
                  height: '40px', padding: '0 22px', borderRadius: '999px',
                  background: '#1D3461', color: '#93B8FF',
                  border: '1px solid rgba(61,126,255,0.4)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {ts('Go to Flashcards')} →
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Back to top (fixed, appears after 300px scroll) */}
      {showBackTop && (
        <button
          onClick={backToTop}
          style={{
            position: 'fixed', bottom: '28px', right: '72px', zIndex: 20,
            width: '44px', height: '44px', borderRadius: '50%',
            background: '#161B22', border: '1px solid #30363D',
            cursor: 'pointer', color: '#8B949E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#484F58';
            (e.currentTarget as HTMLElement).style.color = '#E6EDF3';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#30363D';
            (e.currentTarget as HTMLElement).style.color = '#8B949E';
          }}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <path d="M6 9V3M3 5.5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Bottom reading-progress fade — fixed overlay, only shown while reading */}
      {createPortal(
        <div
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 25,
            height: '72px', pointerEvents: 'none',
            background: 'linear-gradient(to top, rgba(7,7,15,0.98) 0%, rgba(7,7,15,0.6) 40%, transparent 100%)',
            transition: 'opacity 0.3s ease',
          }}
          className="notes-reading-fade"
        >
          {/* Progress bar at the very bottom */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
            background: 'rgba(255,255,255,0.06)',
          }}>
            <div style={{
              height: '100%',
              width: `${scrollPct * 100}%`,
              background: color,
              transition: 'width 0.25s ease',
              boxShadow: `0 0 8px ${color}70`,
            }} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
import type { GeneratedNote, GeneratedNoteSection } from '../lib/generator';

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

// ── Recall card: inline self-test ─────────────────────────────────────────────

function RecallCard({ heading, keyPoints, color }: { heading: string; keyPoints: string[]; color: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={{
      marginTop: '10px', borderRadius: '10px',
      border: `1px solid ${color}28`, background: color + '0d', padding: '14px 16px',
    }}>
      <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, lineHeight: 1.5, color: 'rgba(230,237,243,0.8)' }}>
        Can you explain: <span style={{ color }}>{heading}</span>?
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
          Reveal key points
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
  onToggleUnderstood: () => void;
  onToggleCollapsed: () => void;
}

const SectionCard = forwardRef<HTMLDivElement, SectionCardProps>(function SectionCard(
  { index, section, color, understood, collapsed, onToggleUnderstood, onToggleCollapsed },
  ref
) {
  const [recallOpen, setRecallOpen] = useState(false);
  const num = String(index + 1).padStart(2, '0');
  const hasKeyPoints = (section.keyPoints ?? []).length > 0;

  return (
    <div
      ref={ref}
      data-section-idx={String(index)}
      style={{
        marginBottom: '18px',
        borderRadius: '14px',
        border: `1px solid ${understood ? color + '55' : '#21262D'}`,
        background: understood ? color + '0a' : '#161B22',
        transition: 'border-color 0.2s ease, background 0.2s ease',
        scrollMarginTop: '16px',
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', padding: '17px 19px 13px' }}>
        <div style={{
          flexShrink: 0, width: '26px', height: '26px', borderRadius: '7px',
          background: '#1D3461', border: '1px solid rgba(61,126,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
        }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', fontWeight: 700, color: '#93B8FF' }}>
            {num}
          </span>
        </div>

        <h3 style={{
          flex: 1, margin: 0, fontSize: '15px', fontWeight: 600,
          color: '#E6EDF3', fontFamily: 'Sora, sans-serif', lineHeight: 1.4,
        }}>
          {section.heading}
        </h3>

        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          <button
            onClick={onToggleCollapsed}
            style={{
              background: collapsed ? color + '22' : 'transparent',
              border: `1px solid ${collapsed ? color + '55' : '#30363D'}`,
              borderRadius: '7px', padding: '3px 8px',
              cursor: 'pointer', fontSize: '10px', fontWeight: 700,
              color: collapsed ? color : '#484F58', letterSpacing: '0.04em',
              transition: 'all 0.15s',
            }}
          >
            TL;DR
          </button>
          <button
            onClick={onToggleUnderstood}
            title={understood ? 'Mark as not understood' : 'Got it'}
            style={{
              width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
              border: `1px solid ${understood ? color + '60' : '#30363D'}`,
              background: understood ? color + '22' : 'transparent',
              color: understood ? color : '#484F58',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '0 19px 17px 19px' }}>
        <p style={{
          margin: '0 0 13px', fontSize: '15px', lineHeight: 1.78,
          color: 'rgba(230,237,243,0.83)',
        }}>
          {collapsed ? (
            <>
              {firstSentence(section.content)}
              {' '}
              <button
                onClick={onToggleCollapsed}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', color, fontWeight: 500 }}
              >
                Read more
              </button>
            </>
          ) : (
            <RichText text={section.content} accent={color} />
          )}
        </p>

        {/* Formula block */}
        {!collapsed && section.formula && (
          <div style={{
            margin: '0 0 13px', padding: '10px 14px', borderRadius: '9px',
            background: '#0D1117', border: `1px solid ${color}30`,
            fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
            color: color, lineHeight: 1.6,
            display: 'flex', alignItems: 'flex-start', gap: '8px',
          }}>
            <span style={{ opacity: 0.6, fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>∑</span>
            <span>{section.formula}</span>
          </div>
        )}

        {/* Diagram block */}
        {!collapsed && section.diagram && (
          <div style={{
            margin: '0 0 13px', padding: '10px 14px', borderRadius: '9px',
            background: '#0D1117', border: '1px solid #30363D',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
            color: '#8B949E', lineHeight: 1.7, whiteSpace: 'pre-wrap',
            display: 'flex', alignItems: 'flex-start', gap: '8px',
          }}>
            <span style={{ opacity: 0.5, fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>→</span>
            <span>{section.diagram}</span>
          </div>
        )}

        {!collapsed && hasKeyPoints && (
          <ul style={{ margin: '0 0 13px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {(section.keyPoints ?? []).map((pt, j) => (
              <li key={j} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: '5px', height: '5px', borderRadius: '50%',
                  background: color, opacity: 0.6, marginTop: '9px',
                }} />
                <span style={{ fontSize: '14px', lineHeight: 1.68, color: 'rgba(230,237,243,0.74)' }}>
                  <RichText text={pt} accent={color} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {!collapsed && (
          <button
            onClick={() => setRecallOpen(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '11px', fontWeight: 500, color: '#484F58',
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = color; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#484F58'; }}
          >
            <svg viewBox="0 0 10 10" width="10" height="10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3.5 4c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .6-.37 1.1-.9 1.35L5 5.7V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="5" cy="7.75" r=".4" fill="currentColor" />
            </svg>
            {recallOpen ? 'Hide recall' : 'Test yourself'}
          </button>
        )}

        {!collapsed && recallOpen && (
          <RecallCard heading={section.heading} keyPoints={section.keyPoints ?? []} color={color} />
        )}
      </div>
    </div>
  );
});

// ── NotesViewer ───────────────────────────────────────────────────────────────

export function NotesViewer({ notes, color = '#3D7EFF', noteId, scrollElRef }: {
  notes: GeneratedNote;
  color?: string;
  noteId?: string;
  scrollElRef?: React.RefObject<HTMLElement | null>;
}) {
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [scrollPct, setScrollPct] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

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
      next.has(i) ? next.delete(i) : next.add(i);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }, [storageKey]);

  const toggleCollapsed = useCallback((i: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
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
      setScrollPct(max > 0 ? scrollTop / max : 0);
      setShowBackTop(scrollTop > 300);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [scrollElRef]);

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
        const next = Math.min(activeSection + 1, notes.sections.length - 1);
        sectionRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'k') {
        const prev = Math.max(activeSection - 1, 0);
        sectionRefs.current[prev]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSection, notes.sections.length]);

  const scrollToSection = (i: number) =>
    sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const backToTop = () =>
    scrollElRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const total = notes.sections.length;
  const completionPct = total > 0 ? Math.round((understood.size / total) * 100) : 0;
  const readTime = calcReadTime(notes);

  return (
    <div style={{ position: 'relative' }}>

      {/* Reading progress bar — sticky at top of scroll container */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, height: '2px', background: '#21262D' }}>
        <div style={{
          height: '100%', background: color,
          width: `${scrollPct * 100}%`,
          transition: 'width 80ms linear',
          borderRadius: '0 1px 1px 0',
        }} />
      </div>

      {/* Two-column reading layout */}
      <div style={{ display: 'flex', gap: '48px', padding: '36px 28px 80px' }}>

        {/* ── Content column ── */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: '68ch' }}>

          {/* Note metadata + completion header */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', color: '#484F58' }}>~{readTime} min read</span>
              <span style={{ width: '3px', height: '3px', background: '#30363D', borderRadius: '50%' }} />
              <span style={{ fontSize: '11px', color: '#484F58' }}>{total} section{total !== 1 ? 's' : ''}</span>
              <span style={{ flex: 1 }} />
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
                  {completionPct}% understood
                </span>
              </div>
            </div>

            <h2 style={{
              margin: '0 0 10px',
              fontFamily: 'Sora, sans-serif', fontWeight: 700,
              fontSize: '1.45rem', color: '#E6EDF3', lineHeight: 1.3,
            }}>
              {notes.title}
            </h2>
            <p style={{
              margin: 0, fontSize: '15px', lineHeight: 1.78,
              color: 'rgba(230,237,243,0.72)',
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
              onToggleUnderstood={() => toggleUnderstood(i)}
              onToggleCollapsed={() => toggleCollapsed(i)}
            />
          ))}

          {/* Keyboard hint */}
          <div style={{
            marginTop: '8px', padding: '10px 14px', borderRadius: '10px',
            background: '#161B22', border: '1px solid #21262D',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{ fontSize: '11px', color: '#30363D' }}>Navigate sections with</span>
            {(['j', 'k'] as const).map(k => (
              <kbd key={k} style={{
                fontSize: '10px', background: '#21262D', border: '1px solid #30363D',
                borderRadius: '4px', padding: '2px 6px', color: '#484F58',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{k}</kbd>
            ))}
          </div>
        </div>

        {/* ── ToC sidebar (xl screens only) ── */}
        <div className="hidden xl:block" style={{ width: '168px', flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: '20px' }}>
            <p style={{
              margin: '0 0 8px', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: '#30363D',
            }}>
              Contents
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {notes.sections.map((s, i) => (
                <button
                  key={i}
                  onClick={() => scrollToSection(i)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    padding: '5px 8px', borderRadius: '6px',
                    borderLeft: `2px solid ${activeSection === i ? color : '#21262D'}`,
                    display: 'flex', alignItems: 'flex-start', gap: '6px',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <span style={{
                    fontSize: '9px', fontWeight: 700,
                    color: activeSection === i ? color : '#30363D',
                    flexShrink: 0, marginTop: '2px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontSize: '11px', lineHeight: 1.35,
                    color: activeSection === i ? '#C9D1D9' : '#484F58',
                    fontWeight: activeSection === i ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '112px',
                  }}>
                    {s.heading}
                  </span>
                  {understood.has(i) && (
                    <span style={{ marginLeft: 'auto', color: '#4ade80', fontSize: '9px', flexShrink: 0 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Back to top (fixed, appears after 300px scroll) */}
      {showBackTop && (
        <button
          onClick={backToTop}
          style={{
            position: 'fixed', bottom: '28px', right: '28px', zIndex: 20,
            width: '36px', height: '36px', borderRadius: '50%',
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
    </div>
  );
}

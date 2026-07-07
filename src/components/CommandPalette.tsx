import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useResolvedSubjects } from '../store/useSubjects';
import { useFocusTrap } from '../lib/useFocusTrap';

// ── Quick-jump command palette (Cmd/Ctrl+K) ─────────────────────────────
//
// Fuzzy-filters over static pages + the user's subjects, entirely from data
// already held in stores — no extra fetch. Opened globally from Navbar.

interface Item {
  id: string;
  label: string;
  sublabel?: string;
  to: string;
  color?: string;
}

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 - t.indexOf(q);
  // Loose subsequence match as a fallback.
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 10 : -1;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ts } = useLang();
  const navigate = useNavigate();
  const { allSubjects } = useResolvedSubjects();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const staticItems: Item[] = useMemo(() => [
    { id: 'p-dashboard',  label: ts('Dashboard'),       to: '/' },
    { id: 'p-mindmap',    label: ts('Mind Map'),        to: '/mindmap' },
    { id: 'p-flashcards', label: ts('Flashcards'),      to: '/flashcards' },
    { id: 'p-notes',      label: ts('Notes'),           to: '/notes' },
    { id: 'p-quiz',       label: ts('Quiz'),            to: '/quiz' },
    { id: 'p-dictionary', label: ts('Dictionary'),      to: '/dictionary' },
    { id: 'p-kg',         label: ts('Knowledge Graph'), to: '/knowledge-graph' },
    { id: 'p-companies',  label: ts('Companies'),       to: '/companies' },
    { id: 'p-generate',   label: ts('AI Generator'),    to: '/generate' },
  ], [ts]);

  const subjectItems: Item[] = useMemo(() => allSubjects.map(s => ({
    id: `s-${s.id}`,
    label: s.title,
    sublabel: ts('Subject'),
    to: `/subject/${s.id}`,
    color: s.color,
  })), [allSubjects, ts]);

  const results = useMemo(() => {
    const all = [...staticItems, ...subjectItems];
    if (!query.trim()) return all.slice(0, 8);
    return all
      .map(item => ({ item, score: Math.max(fuzzyScore(query, item.label), fuzzyScore(query, item.sublabel ?? '')) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(r => r.item);
  }, [query, staticItems, subjectItems]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // Focus after the modal mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const go = (item: Item) => {
    navigate(item.to);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); const item = results[activeIdx]; if (item) go(item); }
  };

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '14vh 16px 16px',
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={ts('Quick jump')}
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="anim-rise"
        style={{
          width: '100%', maxWidth: '560px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-3)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--border-light)' }}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
            <circle cx="8" cy="8" r="5.5" stroke="var(--text-2)" strokeWidth="1.4" />
            <path d="M12.2 12.2L16 16" stroke="var(--text-2)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={ts('Jump to a page or subject…')}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '14px', color: 'var(--text-1)',
            }}
          />
          <kbd style={{
            fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-3)',
            border: '1px solid var(--border-base)', borderRadius: '5px', padding: '2px 6px',
          }}>
            Esc
          </kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: '340px', overflowY: 'auto', padding: '6px' }}>
          {results.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>
              {ts('No matches')}
            </div>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              onClick={() => go(item)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: i === activeIdx ? 'var(--bg-elevated)' : 'transparent',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                background: item.color ?? 'var(--accent-primary)',
              }} />
              <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 500, flex: 1 }}>{item.label}</span>
              {item.sublabel && (
                <span style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.sublabel}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo } from 'react';
import { useLang } from '../context/LanguageContext';
import { usePKG } from '../store/usePKG';
import PKGGraphCanvas from '../components/pkg/PKGGraphCanvas';
import PKGDetailPanel from '../components/pkg/PKGDetailPanel';
import PKGAnalyticsPanel from '../components/pkg/PKGAnalyticsPanel';
import type { PKGNodeType } from '../lib/pkgEngine';

const TYPE_FILTERS: { type: PKGNodeType; label: string; color: string }[] = [
  { type: 'concept',       label: 'Concepts',   color: '#3B82F6' },
  { type: 'note',          label: 'Notes',      color: '#10B981' },
  { type: 'flashcard_set', label: 'Flashcards', color: '#6366F1' },
  { type: 'quiz',          label: 'Quizzes',    color: '#F59E0B' },
  { type: 'mistake',       label: 'Mistakes',   color: '#EF4444' },
];

export default function PersonalKnowledgeGraphPage() {
  const { ts } = useLang();
  const { loaded, load, nodes, searchQuery, setSearch, visibleTypes, toggleVisibleType } = usePKG();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeStats = useMemo(() => {
    const s: Record<string, number> = {};
    for (const n of nodes) s[n.type] = (s[n.type] ?? 0) + 1;
    return s;
  }, [nodes]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - var(--nav-height))', overflow: 'hidden',
      padding: '20px 24px', gap: 14,
      background: 'var(--bg-page)',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
            {ts('Knowledge Engine')}
          </div>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 'clamp(1.4rem,2.5vw,1.9rem)', color: 'var(--text-1)', margin: 0 }}>
            {ts('Personal Knowledge Graph')}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 5 }}>
            {ts('{count} nodes · {types} types', { count: nodes.length, types: Object.keys(typeStats).length })}
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 240 }}>
          <svg
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }}
            viewBox="0 0 20 20" width={14} height={14} fill="none"
          >
            <circle cx={8.5} cy={8.5} r={5.5} stroke="currentColor" strokeWidth={1.5} />
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            placeholder={ts('Search nodes…')}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, fontSize: 13,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
              color: 'var(--text-1)', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Type filter chips ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 7, flexShrink: 0, flexWrap: 'wrap' }}>
        {TYPE_FILTERS.map(({ type, label, color }) => {
          const active = visibleTypes.has(type);
          const count = typeStats[type] ?? 0;
          return (
            <button
              key={type}
              onClick={() => toggleVisibleType(type)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: active ? color + '16' : 'transparent',
                border: active ? `1px solid ${color}50` : '1px solid var(--border-light)',
                color: active ? color : 'var(--text-3)',
                transition: 'all 0.15s',
              }}
            >
              {label}
              {count > 0 && (
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, gap: 14, minHeight: 0 }}>

        {/* Graph (centre) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!loaded ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--text-3)', fontSize: 13,
              borderRadius: 16, border: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
            }}>
              {ts('Loading graph…')}
            </div>
          ) : (
            <PKGGraphCanvas />
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Node detail panel */}
          <div className="dep-sidebar-panel" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 16,
            padding: 16,
            flex: '0 0 auto',
            minHeight: 200,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              {ts('Node Details')}
            </div>
            <PKGDetailPanel />
          </div>

          {/* Analytics panel */}
          <div className="dep-sidebar-panel" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 16,
            padding: 16,
            flex: '0 0 auto',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              {ts('Graph Intelligence')}
            </div>
            <PKGAnalyticsPanel />
          </div>

        </div>
      </div>
    </div>
  );
}

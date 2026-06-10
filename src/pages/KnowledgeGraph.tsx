import { useMemo } from 'react';
import { useLang } from '../context/LanguageContext';
import { useDependencies } from '../store/useDependencies';
import { enrichConcepts, calcCoverage } from '../lib/depAlgorithms';
import DepGraph from '../components/deps/DepGraph';
import DepConceptPanel from '../components/deps/DepConceptPanel';
import DepMetrics from '../components/deps/DepMetrics';
import DepAnalytics from '../components/deps/DepAnalytics';

export default function KnowledgeGraphPage() {
  const { ts } = useLang();
  const { getMastery, searchQuery, setSearchQuery } = useDependencies();

  const concepts = useMemo(
    () => enrichConcepts(getMastery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useDependencies.getState().masteryMap]
  );

  const metrics = useMemo(() => calcCoverage(concepts), [concepts]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return concepts;
    const q = searchQuery.toLowerCase();
    return concepts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [concepts, searchQuery]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
        padding: '20px 24px',
        gap: 16,
        background: 'var(--bg-page)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
            {ts('Knowledge Engine')}
          </div>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 'clamp(1.5rem,2.5vw,2rem)', color: 'var(--text-1)', margin: 0 }}>
            {ts('Dependency Graph')}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 6 }}>
            {ts('{count} concepts across {cats} categories', {
              count: concepts.length,
              cats: 7,
            })}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={ts('Search concepts…')}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, fontSize: 13,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
              color: 'var(--text-1)', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>

        {/* Graph (centre) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <DepGraph concepts={filtered} searchQuery={searchQuery} />
        </div>

        {/* Right sidebar */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Concept panel */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 16,
            padding: 16,
            flex: '0 0 auto',
            minHeight: 220,
          }}>
            <DepConceptPanel concepts={concepts} />
          </div>

          {/* Analytics */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 16,
            padding: 16,
            flex: '0 0 auto',
            minHeight: 280,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              {ts('Insights')}
            </div>
            <DepAnalytics concepts={concepts} />
          </div>

          {/* Metrics */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 16,
            padding: 16,
            flex: '0 0 auto',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              {ts('Coverage')}
            </div>
            <DepMetrics metrics={metrics} />
          </div>
        </div>
      </div>
    </div>
  );
}

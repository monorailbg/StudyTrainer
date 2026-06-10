import { useMemo, useState } from 'react';
import { useDependencies } from '../../store/useDependencies';
import { CATEGORY_COLORS } from '../../data/conceptGraph';
import { findBottlenecks, findHighLeverage, simulateWhatIf, getAllPrereqs, getAllUnlocks } from '../../lib/depAlgorithms';
import type { EnrichedConcept } from '../../lib/depAlgorithms';

interface Props {
  concepts: EnrichedConcept[];
}

type Tab = 'bottlenecks' | 'leverage' | 'whatif';

export default function DepAnalytics({ concepts }: Props) {
  const [tab, setTab] = useState<Tab>('bottlenecks');
  const { setMastery, getMastery, whatIfConceptId, whatIfScore, setWhatIf, selectConcept } =
    useDependencies();

  const bottlenecks = useMemo(() => findBottlenecks(concepts).slice(0, 6), [concepts]);
  const leverage    = useMemo(() => findHighLeverage(concepts).slice(0, 6), [concepts]);

  const whatIfResults = useMemo(() => {
    if (!whatIfConceptId) return [];
    return simulateWhatIf(whatIfConceptId, whatIfScore, getMastery);
  }, [whatIfConceptId, whatIfScore, getMastery, concepts]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'bottlenecks', label: '⚠ Bottlenecks' },
    { key: 'leverage', label: '⭐ Leverage' },
    { key: 'whatif', label: '🔮 What-If' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '5px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: tab === t.key ? 'var(--bg-elevated)' : 'transparent',
              border: tab === t.key ? '1px solid var(--border-base)' : '1px solid transparent',
              color: tab === t.key ? 'var(--text-1)' : 'var(--text-3)',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bottlenecks */}
      {tab === 'bottlenecks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
            Weak concepts that block the most other concepts.
          </p>
          {bottlenecks.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 20 }}>No bottlenecks — great progress!</div>
          )}
          {bottlenecks.map((b) => (
            <InsightCard
              key={b.concept.id}
              concept={b.concept}
              metricLabel="Blocks"
              metricValue={b.descendantCount}
              impactScore={b.impactScore}
              accentColor="#EF4444"
              onClick={() => selectConcept(b.concept.id, getAllPrereqs(b.concept.id), getAllUnlocks(b.concept.id))}
            />
          ))}
        </div>
      )}

      {/* High Leverage */}
      {tab === 'leverage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
            Concepts with the best learning ROI — easy wins unlocking many others.
          </p>
          {leverage.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 20 }}>All available concepts mastered!</div>
          )}
          {leverage.map((l) => (
            <InsightCard
              key={l.concept.id}
              concept={l.concept}
              metricLabel="Leverage"
              metricValue={Math.round(l.leverageScore * 10) / 10}
              impactScore={l.leverageScore}
              accentColor="#10B981"
              onClick={() => selectConcept(l.concept.id, getAllPrereqs(l.concept.id), getAllUnlocks(l.concept.id))}
            />
          ))}
        </div>
      )}

      {/* What-If Simulator */}
      {tab === 'whatif' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
            Simulate: if concept mastery increases, what new concepts unlock?
          </p>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Concept</label>
            <select
              value={whatIfConceptId ?? ''}
              onChange={(e) => setWhatIf(e.target.value || null, whatIfScore)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
                color: 'var(--text-1)', cursor: 'pointer',
              }}
            >
              <option value="">Select a concept…</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {whatIfConceptId && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'var(--text-3)' }}>
                <label>New mastery score</label>
                <span style={{ color: '#3B82F6', fontWeight: 700 }}>{whatIfScore}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={whatIfScore}
                onChange={(e) => setWhatIf(whatIfConceptId, Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3B82F6', cursor: 'pointer' }}
              />
            </div>
          )}
          {whatIfConceptId && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {whatIfResults.length > 0 ? `${whatIfResults.length} newly unlocked` : 'No new unlocks'}
              </div>
              {whatIfResults.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {whatIfScore < 60
                    ? 'Increase to ≥ 60% to start unlocking concepts'
                    : 'Those concepts are already unlocked or need other prerequisites'}
                </div>
              )}
              {whatIfResults.map((id) => {
                const c = concepts.find((x) => x.id === id);
                if (!c) return null;
                const color = CATEGORY_COLORS[c.category] ?? '#6B7280';
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#0F2D2A', border: '1px solid #065F4644', marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ color: '#6EE7B7', fontSize: 12, flex: 1 }}>{c.name}</span>
                    <button
                      onClick={() => setMastery(whatIfConceptId, whatIfScore)}
                      style={{ fontSize: 10, color: '#10B981', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Apply
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface InsightCardProps {
  concept: EnrichedConcept;
  metricLabel: string;
  metricValue: number;
  impactScore: number;
  accentColor: string;
  onClick: () => void;
}

function InsightCard({ concept, metricLabel, metricValue, accentColor, onClick }: InsightCardProps) {
  const catColor = CATEGORY_COLORS[concept.category] ?? '#6B7280';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        borderRadius: 10, background: accentColor + '0D', border: `1px solid ${accentColor}22`,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {concept.name}
        </div>
        <div style={{ fontSize: 10, color: catColor }}>
          {concept.category} · {Math.round(concept.masteryScore)}% mastery
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: accentColor, fontFamily: "'Sora', sans-serif" }}>{metricValue}</div>
        <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>{metricLabel}</div>
      </div>
    </button>
  );
}

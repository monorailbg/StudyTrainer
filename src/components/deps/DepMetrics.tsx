import { CATEGORY_COLORS } from '../../data/conceptGraph';
import type { CoverageMetrics } from '../../lib/depAlgorithms';

interface Props {
  metrics: CoverageMetrics;
}

export default function DepMetrics({ metrics }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overall */}
      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Overall Coverage
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#10B981', fontFamily: "'Sora', sans-serif" }}>
            {Math.round(metrics.pctMastered)}%
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${metrics.pctMastered}%`, background: 'linear-gradient(90deg, #059669, #10B981)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <StatBadge label="Mastered" value={metrics.mastered} color="#10B981" />
          <StatBadge label="Partial" value={metrics.partial} color="#F59E0B" />
          <StatBadge label="Weak" value={metrics.weak} color="#EF4444" />
          <StatBadge label="Locked" value={metrics.locked} color="#4B5563" />
        </div>
      </div>

      {/* Per category */}
      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          By Category
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(metrics.byCategory)
            .sort((a, b) => b[1].pct - a[1].pct)
            .map(([cat, { mastered, total, pct }]) => {
              const color = CATEGORY_COLORS[cat] ?? '#6B7280';
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                      <span style={{ color: 'var(--text-2)' }}>{cat}</span>
                    </div>
                    <span style={{ color: 'var(--text-3)' }}>{mastered}/{total}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Sora', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

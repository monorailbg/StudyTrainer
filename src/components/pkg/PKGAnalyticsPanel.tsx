import { useState } from 'react';
import { usePKG } from '../../store/usePKG';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LanguageContext';

type Tab = 'hubs' | 'gaps' | 'confusion' | 'isolated';

export default function PKGAnalyticsPanel() {
  const { analytics, selectNode } = usePKG();
  const { theme } = useTheme();
  const { ts } = useLang();
  const isLight = theme === 'light';
  const [tab, setTab] = useState<Tab>('hubs');

  if (!analytics) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>
        {ts('Loading…')}
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'hubs',      label: '⬡ Hubs'     },
    { key: 'gaps',      label: '⚠ Gaps'     },
    { key: 'confusion', label: '⟺ Confused' },
    { key: 'isolated',  label: '○ Isolated'  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { label: ts('Nodes'),    value: analytics.totalNodes },
          { label: ts('Edges'),    value: analytics.totalEdges },
          { label: ts('Clusters'), value: analytics.connectedComponents },
        ].map(s => (
          <div key={s.label} style={{
            padding: '7px 4px', borderRadius: 8, textAlign: 'center',
            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
            border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', fontFamily: "'Sora', sans-serif", lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              background: tab === t.key ? 'var(--bg-elevated)' : 'transparent',
              border: tab === t.key ? '1px solid var(--border-base)' : '1px solid transparent',
              color: tab === t.key ? 'var(--text-1)' : 'var(--text-3)',
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {tab === 'hubs' && (
          analytics.hubNodes.length === 0
            ? <EmptyMsg label={ts('No hub nodes yet')} />
            : analytics.hubNodes.map(({ node, degree }) => (
                <NodeRow
                  key={node.id}
                  label={node.label}
                  badge={`${degree} links`}
                  badgeColor="#3B82F6"
                  onClick={() => selectNode(node.id)}
                  isLight={isLight}
                />
              ))
        )}

        {tab === 'gaps' && (
          analytics.knowledgeGaps.length === 0
            ? <EmptyMsg label={ts('No knowledge gaps')} />
            : analytics.knowledgeGaps.map(({ node, mastery }) => (
                <NodeRow
                  key={node.id}
                  label={node.label}
                  badge={`${Math.round(mastery)}%`}
                  badgeColor="#EF4444"
                  onClick={() => selectNode(node.id)}
                  isLight={isLight}
                />
              ))
        )}

        {tab === 'confusion' && (
          analytics.confusionPairs.length === 0
            ? <EmptyMsg label={ts('No confusion pairs detected')} />
            : analytics.confusionPairs.map(({ nodeA, nodeB, count }, i) => (
                <button
                  key={i}
                  onClick={() => selectNode(nodeA.id)}
                  style={{
                    padding: '7px 10px', borderRadius: 8, width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: isLight ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.1)',
                    border: isLight ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-1)', fontWeight: 600 }}>{nodeA.label}</span>
                    <span style={{ fontSize: 9, color: '#EF4444', fontWeight: 700, background: '#EF444418', padding: '1px 5px', borderRadius: 4 }}>
                      {count}×
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>⟺ {nodeB.label}</div>
                </button>
              ))
        )}

        {tab === 'isolated' && (
          analytics.isolatedNodes.length === 0
            ? <EmptyMsg label={ts('All nodes are connected!')} />
            : analytics.isolatedNodes.slice(0, 10).map(node => (
                <NodeRow
                  key={node.id}
                  label={node.label}
                  badge={node.type.replace(/_/g, ' ')}
                  badgeColor="#6B7280"
                  onClick={() => selectNode(node.id)}
                  isLight={isLight}
                />
              ))
        )}
      </div>
    </div>
  );
}

function NodeRow({ label, badge, badgeColor, onClick, isLight }: {
  label: string; badge: string; badgeColor: string; onClick: () => void; isLight: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderRadius: 8, width: '100%', textAlign: 'left', cursor: 'pointer',
        background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
        border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
        transition: 'background 0.12s',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {label}
      </span>
      <span style={{
        fontSize: 9, fontWeight: 700, color: badgeColor,
        background: badgeColor + '18', padding: '2px 5px', borderRadius: 4,
        flexShrink: 0, marginLeft: 6,
      }}>
        {badge}
      </span>
    </button>
  );
}

function EmptyMsg({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '14px 0' }}>
      {label}
    </div>
  );
}

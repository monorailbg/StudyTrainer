import { useMemo } from 'react';
import { usePKG } from '../../store/usePKG';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LanguageContext';
import { CATEGORY_COLORS, getNeighborIds, type PKGNodeType, type PKGRelationType } from '../../lib/pkgEngine';

const TYPE_LABEL: Record<PKGNodeType, string> = {
  concept:       'Concept',
  note:          'Note',
  flashcard_set: 'Flashcard Set',
  quiz:          'Quiz',
  mistake:       'Mistake Pattern',
};

const TYPE_COLOR: Record<PKGNodeType, string> = {
  concept:       '#3B82F6',
  note:          '#10B981',
  flashcard_set: '#6366F1',
  quiz:          '#F59E0B',
  mistake:       '#EF4444',
};

const RELATION_COLOR: Record<PKGRelationType, string> = {
  depends_on:               '#3B82F6',
  appears_in:               '#10B981',
  explains:                 '#6366F1',
  related_to:               '#6B7280',
  expands_on:               '#8B5CF6',
  frequently_confused_with: '#EF4444',
};

export default function PKGDetailPanel() {
  const { nodes, edges, selectedNodeId, selectNode } = usePKG();
  const { theme } = useTheme();
  const { ts } = useLang();
  const isLight = theme === 'light';

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const connectedEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);
  }, [selectedNodeId, edges]);

  const neighborNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    return getNeighborIds(selectedNodeId, edges)
      .map(id => nodeMap.get(id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .slice(0, 8);
  }, [selectedNodeId, edges, nodeMap]);

  if (!selectedNode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, gap: 8 }}>
        <div style={{ fontSize: 26, opacity: 0.25 }}>⬡</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
          {ts('Click any node to see details')}
        </div>
      </div>
    );
  }

  const typeColor = TYPE_COLOR[selectedNode.type] ?? '#6B7280';
  const catColor = selectedNode.type === 'concept'
    ? (CATEGORY_COLORS[selectedNode.category ?? ''] ?? typeColor)
    : typeColor;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 5,
            background: catColor + '18', border: `1px solid ${catColor}30`,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: catColor }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: catColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {TYPE_LABEL[selectedNode.type]}
            </span>
          </div>
          {selectedNode.category && (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{selectedNode.category}</span>
          )}
        </div>

        <h3 style={{
          fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700,
          color: 'var(--text-1)', margin: 0, lineHeight: 1.35,
        }}>
          {selectedNode.label}
        </h3>

        {selectedNode.description && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, lineHeight: 1.65, margin: '5px 0 0' }}>
            {selectedNode.description}
          </p>
        )}
      </div>

      {/* Mastery bar for concepts */}
      {selectedNode.type === 'concept' && selectedNode.masteryScore !== undefined && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{ts('Mastery')}</span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: selectedNode.masteryScore >= 80 ? '#10B981' : selectedNode.masteryScore >= 40 ? '#F59E0B' : '#EF4444',
            }}>
              {Math.round(selectedNode.masteryScore)}%
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <div style={{
              height: '100%', borderRadius: 3, width: `${selectedNode.masteryScore}%`,
              background: selectedNode.masteryScore >= 80 ? '#10B981' : selectedNode.masteryScore >= 40 ? '#F59E0B' : '#EF4444',
            }} />
          </div>
        </div>
      )}

      {/* Confusion count for mistakes */}
      {selectedNode.type === 'mistake' && selectedNode.confusionCount !== undefined && (
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: '#EF444414', border: '1px solid #EF444430',
        }}>
          <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 700 }}>
            {selectedNode.confusionCount}×
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>
            {ts('wrong answers recorded')}
          </span>
        </div>
      )}

      {/* Connections */}
      {connectedEdges.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
            {ts('Connections')} ({connectedEdges.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {connectedEdges.slice(0, 8).map(edge => {
              const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
              const other = nodeMap.get(otherId);
              if (!other) return null;
              const relColor = RELATION_COLOR[edge.relation] ?? '#6B7280';
              return (
                <button
                  key={edge.id}
                  onClick={() => selectNode(other.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 8px', borderRadius: 7, width: '100%',
                    textAlign: 'left', cursor: 'pointer',
                    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                    border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: relColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: relColor, flexShrink: 0, fontWeight: 600 }}>
                    {edge.relation.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {other.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Difficulty badge */}
      {selectedNode.type === 'concept' && selectedNode.difficulty && (
        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
          <span style={{ opacity: 0.7 }}>{ts('Difficulty')}:</span>{' '}
          <span style={{ color: 'var(--text-2)', fontWeight: 600, textTransform: 'capitalize' }}>
            {selectedNode.difficulty}
          </span>
        </div>
      )}

      {neighborNodes.length === 0 && connectedEdges.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>
          {ts('No connections yet')}
        </div>
      )}
    </div>
  );
}

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePKG } from '../../store/usePKG';
import { useTheme } from '../../context/ThemeContext';
import PKGNodeItem from './PKGNodeItem';
import { getNeighborIds, CATEGORY_COLORS, type PKGNodeType } from '../../lib/pkgEngine';

const nodeTypes: NodeTypes = { pkg: PKGNodeItem };

const RELATION_COLORS: Record<string, string> = {
  depends_on:               '#3B82F6',
  appears_in:               '#10B981',
  explains:                 '#6366F1',
  related_to:               '#6B7280',
  expands_on:               '#8B5CF6',
  frequently_confused_with: '#EF4444',
};

export default function PKGGraphCanvas() {
  const { nodes, edges, positions, selectedNodeId, visibleTypes, matchingIds, selectNode } = usePKG();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const visibleNodes = useMemo(
    () => nodes.filter(n => visibleTypes.has(n.type as PKGNodeType)),
    [nodes, visibleTypes],
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);

  const neighborIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    return new Set(getNeighborIds(selectedNodeId, edges));
  }, [selectedNodeId, edges]);

  const rfNodes: Node[] = useMemo(
    () => visibleNodes.map(n => ({
      id: n.id,
      type: 'pkg',
      position: positions[n.id] ?? { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeType: n.type,
        category: n.category,
        mastery: n.masteryScore,
        confusionCount: n.confusionCount,
        isSelected: n.id === selectedNodeId,
        isFiltered: matchingIds.size < nodes.length && !matchingIds.has(n.id),
        isNeighbor: neighborIds.has(n.id),
      },
    })),
    [visibleNodes, positions, selectedNodeId, matchingIds, nodes.length, neighborIds],
  );

  const rfEdges: Edge[] = useMemo(
    () => edges
      .filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map(e => {
        const color = RELATION_COLORS[e.relation] ?? '#6B7280';
        const isHighlighted = selectedNodeId === e.source || selectedNodeId === e.target;
        const inactiveStroke = isLight ? '#b0bec8' : '#2D3748';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: isHighlighted && e.relation !== 'depends_on',
          label: isHighlighted ? e.relation.replace(/_/g, ' ') : undefined,
          labelStyle: { fontSize: 9, fill: color, fontWeight: 600 },
          labelBgStyle: { fill: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)', rx: 3 },
          style: {
            stroke: isHighlighted ? color : inactiveStroke,
            strokeWidth: isHighlighted ? 2 : 1,
            strokeDasharray: e.relation === 'frequently_confused_with' ? '5 3' : undefined,
            opacity: isHighlighted ? 1 : (isLight ? 0.4 : 0.3),
          },
        };
      }),
    [edges, visibleNodeIds, selectedNodeId, isLight],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden',
      border: isLight ? '1px solid rgba(0,0,0,0.09)' : '1px solid #1E2D3D',
    }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Background
          color={isLight ? 'rgba(0,0,0,0.18)' : '#1A2035'}
          gap={20}
          style={{ background: isLight ? '#e8e1d8' : undefined }}
        />
        <Controls
          style={{
            background: isLight ? 'rgba(255,255,255,0.78)' : 'rgba(13,17,23,0.9)',
            border: isLight ? '1px solid rgba(0,0,0,0.09)' : '1px solid #1E2D3D',
            borderRadius: 8,
            backdropFilter: isLight ? 'blur(8px)' : undefined,
          }}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { nodeType: PKGNodeType; category?: string };
            if (d.nodeType === 'concept') return CATEGORY_COLORS[d.category ?? ''] ?? '#6B7280';
            const colors: Record<string, string> = {
              note: '#10B981', flashcard_set: '#6366F1', quiz: '#F59E0B', mistake: '#EF4444',
            };
            return colors[d.nodeType] ?? '#6B7280';
          }}
          maskColor={isLight ? 'rgba(232,225,216,0.78)' : 'rgba(13,17,23,0.75)'}
          style={{
            background: isLight ? 'rgba(255,255,255,0.75)' : '#0D1117',
            border: isLight ? '1px solid rgba(0,0,0,0.09)' : '1px solid #1E2D3D',
            borderRadius: 8,
            backdropFilter: isLight ? 'blur(8px)' : undefined,
          }}
        />
      </ReactFlow>
    </div>
  );
}

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
import { useDependencies } from '../../store/useDependencies';
import DepConceptNode from './DepConceptNode';
import { getAllPrereqs, getAllUnlocks } from '../../lib/depAlgorithms';
import type { EnrichedConcept } from '../../lib/depAlgorithms';
import { CATEGORY_COLORS } from '../../data/conceptGraph';

const nodeTypes: NodeTypes = { concept: DepConceptNode };

interface DepGraphProps {
  concepts: EnrichedConcept[];
  searchQuery: string;
}

function getStatus(mastery: number): 'mastered' | 'partial' | 'weak' | 'locked' {
  if (mastery >= 80) return 'mastered';
  if (mastery >= 40) return 'partial';
  if (mastery > 0) return 'weak';
  return 'locked';
}

// Auto-layout by category columns
function layoutConcepts(concepts: EnrichedConcept[]) {
  const categories: Record<string, EnrichedConcept[]> = {};
  for (const c of concepts) {
    if (!categories[c.category]) categories[c.category] = [];
    categories[c.category].push(c);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const colW = 230;
  const rowH = 140;
  let colIdx = 0;

  for (const [, group] of Object.entries(categories)) {
    // Sort within category by depth
    group.sort((a, b) => a.depth - b.depth);
    group.forEach((c, rowIdx) => {
      positions[c.id] = { x: colIdx * colW, y: rowIdx * rowH };
    });
    colIdx++;
  }
  return positions;
}

export default function DepGraph({ concepts, searchQuery }: DepGraphProps) {
  const { selectedConceptId, highlightPrereqs, highlightUnlocks, selectConcept } =
    useDependencies();

  const positions = useMemo(() => layoutConcepts(concepts), [concepts.length]);

  const { nodes, edges } = useMemo(() => {
    const sq = searchQuery.toLowerCase();

    const nodes: Node[] = concepts.map((c) => ({
      id: c.id,
      type: 'concept',
      position: positions[c.id] ?? { x: 0, y: 0 },
      data: {
        label: c.name,
        category: c.category,
        mastery: c.masteryScore,
        readiness: c.readinessScore,
        status: getStatus(c.masteryScore),
        isSelected: c.id === selectedConceptId,
        isPrereq: highlightPrereqs.has(c.id),
        isUnlock: highlightUnlocks.has(c.id),
        isFiltered: sq.length > 0 && !c.name.toLowerCase().includes(sq) && !c.category.toLowerCase().includes(sq),
      },
    }));

    const edgeSet = new Set<string>();
    const edges: Edge[] = [];
    for (const c of concepts) {
      for (const prereqId of c.prerequisites) {
        const eid = `${prereqId}→${c.id}`;
        if (!edgeSet.has(eid)) {
          edgeSet.add(eid);
          const isHighlighted =
            (selectedConceptId === c.id || selectedConceptId === prereqId) ||
            highlightPrereqs.has(prereqId) || highlightUnlocks.has(c.id);
          const catColor = CATEGORY_COLORS[c.category] ?? '#6B7280';
          edges.push({
            id: eid,
            source: prereqId,
            target: c.id,
            animated: isHighlighted,
            style: {
              stroke: isHighlighted ? catColor : '#2D3748',
              strokeWidth: isHighlighted ? 2 : 1,
              opacity: isHighlighted ? 1 : 0.45,
            },
          });
        }
      }
    }
    return { nodes, edges };
  }, [concepts, selectedConceptId, highlightPrereqs, highlightUnlocks, searchQuery, positions]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const prereqs = getAllPrereqs(node.id);
    const unlocks = getAllUnlocks(node.id);
    selectConcept(node.id, prereqs, unlocks);
  }, [selectConcept]);

  const onPaneClick = useCallback(() => {
    useDependencies.getState().clearSelection();
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid #1E2D3D' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#1A2035" gap={20} />
        <Controls
          style={{
            background: 'rgba(13,17,23,0.9)',
            border: '1px solid #1E2D3D',
            borderRadius: 8,
          }}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { status: string };
            if (d.status === 'mastered') return '#10B981';
            if (d.status === 'partial') return '#F59E0B';
            if (d.status === 'weak') return '#EF4444';
            return '#374151';
          }}
          maskColor="rgba(13,17,23,0.75)"
          style={{
            background: '#0D1117',
            border: '1px solid #1E2D3D',
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  );
}

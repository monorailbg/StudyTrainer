import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  useInternalNode,
  getBezierPath,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useResolvedSubjects } from '../store/useSubjects';
import type { SubjectDef } from '../data/subjects';
import { SubjectIcon } from '../data/subjectIcons';
import { isFirebaseConfigured, getAllCloudNotes } from '../lib/cloudDb';
import { getAllNotes } from '../lib/db';

const ROOT_COLOR = '#3D7EFF';
const ROOT_LABEL = 'Global Business Studies';

// Layout radii — subjects ring around the root, topics fan out past them.
const SUBJECT_RADIUS = 470;
const TOPIC_RADIUS = 760;
const MAX_TOPICS = 6;

// Approximate half-sizes used purely for centring nodes on their target point.
// Edge geometry uses the *measured* size, so a small mismatch here is harmless.
const HALF = {
  root:    { x: 110, y: 56 },
  subject: { x: 102, y: 34 },
  topic:   { x: 92,  y: 24 },
};

// ── Topic loading ────────────────────────────────────────────────────────────
// Section headings across every saved note, grouped by subject. One query up
// front (cloud or local) rather than a round-trip per expanded node.

async function loadTopicsBySubject(): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  const push = (subjectId: string, headings: string[]) => {
    const seen = map[subjectId] ?? (map[subjectId] = []);
    for (const h of headings) {
      const clean = h.trim();
      if (clean && !seen.includes(clean)) seen.push(clean);
    }
  };

  try {
    if (isFirebaseConfigured) {
      const notes = await getAllCloudNotes();
      for (const n of notes) push(n.subjectId, n.note.sections.map(s => s.heading));
    } else {
      const notes = await getAllNotes();
      for (const n of notes) push(n.subjectId, n.note.sections.map(s => s.heading));
    }
  } catch {
    // Notes are best-effort — an empty map just shows "no notes" prompts.
  }
  return map;
}

// ── Floating gradient edge ─────────────────────────────────────────────────────
// Connects node centres with a bezier whose stroke fades from the parent colour
// to the child colour. Endpoints sit under the nodes, so the lines read as
// emanating from each card.

function centre(node: InternalNode) {
  const w = node.measured?.width ?? 0;
  const h = node.measured?.height ?? 0;
  const { x, y } = node.internals.positionAbsolute;
  return { x: x + w / 2, y: y + h / 2 };
}

function GradientEdge({ id, source, target, data }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode || !sourceNode.measured || !targetNode.measured) return null;

  const s = centre(sourceNode);
  const t = centre(targetNode);

  // Pick handle orientation from the dominant axis so the curve bows naturally.
  const horizontal = Math.abs(t.x - s.x) >= Math.abs(t.y - s.y);
  const sourcePosition = horizontal ? (t.x > s.x ? Position.Right : Position.Left) : (t.y > s.y ? Position.Bottom : Position.Top);
  const targetPosition = horizontal ? (t.x > s.x ? Position.Left : Position.Right) : (t.y > s.y ? Position.Top : Position.Bottom);

  const [path] = getBezierPath({
    sourceX: s.x, sourceY: s.y, sourcePosition,
    targetX: t.x, targetY: t.y, targetPosition,
    curvature: 0.35,
  });

  const d = data as { from: string; to: string; dimmed?: boolean };
  const gid = `mm-grad-${id}`;
  return (
    <g>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={s.x} y1={s.y} x2={t.x} y2={t.y}>
          <stop offset="0%" stopColor={d.from} />
          <stop offset="100%" stopColor={d.to} />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={d.dimmed ? 1.1 : 2.2}
        strokeOpacity={d.dimmed ? 0.1 : 0.7}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${d.to}55)`, transition: 'stroke-opacity .25s ease, stroke-width .25s ease' }}
      />
    </g>
  );
}

// ── Nodes ──────────────────────────────────────────────────────────────────────

const hiddenHandle: React.CSSProperties = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 'none', background: 'transparent', pointerEvents: 'none' };

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
    </>
  );
}

function RootNode({ data }: NodeProps) {
  const d = data as { dimmed?: boolean };
  return (
    <div
      className="mm-enter"
      style={{
        ['--mm-delay' as string]: '0ms',
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '3px', textAlign: 'center',
        width: '220px', padding: '20px 22px',
        borderRadius: '24px',
        background: 'radial-gradient(120% 120% at 50% 0%, rgba(61,126,255,0.30), rgba(22,27,34,0.95))',
        border: `1.5px solid ${ROOT_COLOR}`,
        boxShadow: `0 0 0 6px rgba(61,126,255,0.10), 0 0 38px ${ROOT_COLOR}66, 0 14px 40px rgba(0,0,0,0.5)`,
        opacity: d.dimmed ? 0.4 : 1,
        transition: 'opacity .25s ease',
      }}
    >
      <Handles />
      <div style={{ fontFamily: "'Inter',sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#93B8FF' }}>
        Mind Map
      </div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '17px', fontWeight: 800, color: '#E6EDF3', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
        {ROOT_LABEL}
      </div>
    </div>
  );
}

function SubjectNode({ data }: NodeProps) {
  const d = data as {
    subject: SubjectDef; expanded: boolean; topicCount: number;
    dimmed: boolean; highlight: boolean; idx: number;
    onOpen: (id: string) => void;
  };
  const { subject: s } = d;
  return (
    <div
      className="mm-enter"
      style={{
        ['--mm-delay' as string]: `${80 + d.idx * 45}ms`,
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '204px', padding: '11px 13px',
        borderRadius: '16px',
        background: 'rgba(22,27,34,0.96)',
        border: `1.5px solid ${d.highlight ? s.color : s.color + '55'}`,
        boxShadow: d.highlight
          ? `0 0 0 3px ${s.color}40, 0 0 26px ${s.color}88, 0 10px 26px rgba(0,0,0,0.45)`
          : `0 0 18px ${s.color}33, 0 8px 22px rgba(0,0,0,0.4)`,
        opacity: d.dimmed ? 0.28 : 1,
        cursor: 'pointer',
        transition: 'opacity .25s ease, box-shadow .25s ease, border-color .25s ease',
      }}
    >
      <Handles />
      <div style={{
        flexShrink: 0, width: '34px', height: '34px', borderRadius: '11px',
        background: s.color + '1F', border: `1px solid ${s.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <SubjectIcon id={s.id} color={s.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '13px', fontWeight: 700, color: '#E6EDF3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.title}
        </div>
        <div style={{ fontSize: '10px', color: '#8B949E', marginTop: '1px' }}>
          {d.topicCount > 0 ? `${d.topicCount} topic${d.topicCount > 1 ? 's' : ''}` : 'No notes yet'}
        </div>
      </div>
      {/* Expand chevron + open shortcut */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{
          width: '20px', height: '20px', borderRadius: '7px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: s.color, background: s.color + '14',
          transform: d.expanded ? 'rotate(90deg)' : 'none', transition: 'transform .25s ease',
        }}>
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); d.onOpen(s.id); }}
          title={`Open ${s.title}`}
          className="nodrag"
          style={{
            width: '20px', height: '20px', borderRadius: '7px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#8B949E', background: 'rgba(255,255,255,0.05)', border: '1px solid #30363D',
          }}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none"><path d="M4 8l4-4M5 4h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}

function TopicNode({ data }: NodeProps) {
  const d = data as { label: string; color: string; empty?: boolean; dimmed: boolean; highlight: boolean; idx: number };
  return (
    <div
      className="mm-enter"
      style={{
        ['--mm-delay' as string]: `${d.idx * 30}ms`,
        position: 'relative',
        maxWidth: '184px', padding: '7px 12px',
        borderRadius: '12px',
        background: 'rgba(13,17,23,0.94)',
        border: `1px solid ${d.highlight ? d.color : (d.empty ? '#30363D' : d.color + '40')}`,
        boxShadow: d.highlight ? `0 0 16px ${d.color}77` : `0 4px 14px rgba(0,0,0,0.4)`,
        opacity: d.dimmed ? 0.25 : 1,
        cursor: 'pointer',
        transition: 'opacity .25s ease, box-shadow .25s ease, border-color .25s ease',
      }}
    >
      <Handles />
      <div style={{
        fontSize: '11px', fontWeight: d.empty ? 600 : 500,
        color: d.empty ? d.color : '#C9D1D9',
        lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {d.empty ? 'No notes yet — Generate →' : d.label}
      </div>
    </div>
  );
}

const nodeTypes = { rootNode: RootNode, subjectNode: SubjectNode, topicNode: TopicNode };
const edgeTypes = { gradient: GradientEdge };

// ── Graph builder ──────────────────────────────────────────────────────────────

function matches(text: string, q: string) {
  return q === '' || text.toLowerCase().includes(q.toLowerCase());
}

function buildGraph(
  subjects: SubjectDef[],
  expanded: Set<string>,
  topicsMap: Record<string, string[]>,
  query: string,
  onOpen: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const q = query.trim();

  const rootMatch = matches(ROOT_LABEL, q);
  nodes.push({
    id: 'root',
    type: 'rootNode',
    position: { x: -HALF.root.x, y: -HALF.root.y },
    data: { dimmed: q !== '' && !rootMatch },
    draggable: true,
  });

  const n = subjects.length;
  subjects.forEach((s, i) => {
    const angle = (-90 + (i * 360) / Math.max(n, 1)) * (Math.PI / 180);
    const cx = Math.cos(angle) * SUBJECT_RADIUS;
    const cy = Math.sin(angle) * SUBJECT_RADIUS;
    const topics = (topicsMap[s.id] ?? []).slice(0, MAX_TOPICS);
    const isExpanded = expanded.has(s.id);

    const subjMatch = matches(s.title, q);
    // A subject stays lit if it or any of its visible topics match the search.
    const anyTopicMatch = isExpanded && topics.some(tp => matches(tp, q));
    const subjDimmed = q !== '' && !subjMatch && !anyTopicMatch;

    nodes.push({
      id: `subject:${s.id}`,
      type: 'subjectNode',
      position: { x: cx - HALF.subject.x, y: cy - HALF.subject.y },
      data: {
        subject: s, expanded: isExpanded, topicCount: topics.length,
        dimmed: subjDimmed, highlight: q !== '' && subjMatch, idx: i, onOpen,
      },
      draggable: true,
    });
    edges.push({
      id: `e-root-${s.id}`,
      source: 'root',
      target: `subject:${s.id}`,
      type: 'gradient',
      data: { from: ROOT_COLOR, to: s.color, dimmed: subjDimmed },
    });

    if (!isExpanded) return;

    // Topic fan around the subject's angle, just past the subject ring.
    const items = topics.length > 0 ? topics : ['__empty__'];
    const step = 9 * (Math.PI / 180);
    const mid = (items.length - 1) / 2;
    items.forEach((label, j) => {
      const a = angle + (j - mid) * step;
      const tx = Math.cos(a) * TOPIC_RADIUS;
      const ty = Math.sin(a) * TOPIC_RADIUS;
      const empty = label === '__empty__';
      const topMatch = !empty && matches(label, q);
      const id = `topic:${s.id}:${j}`;
      nodes.push({
        id,
        type: 'topicNode',
        position: { x: tx - HALF.topic.x, y: ty - HALF.topic.y },
        data: {
          label, color: s.color, empty, subjectId: s.id,
          dimmed: q !== '' && !empty && !topMatch,
          highlight: q !== '' && topMatch, idx: j,
        },
        draggable: true,
      });
      edges.push({
        id: `e-${s.id}-${j}`,
        source: `subject:${s.id}`,
        target: id,
        type: 'gradient',
        data: { from: s.color, to: s.color, dimmed: q !== '' && !empty && !topMatch && !subjMatch },
      });
    });
  });

  return { nodes, edges };
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

function Toolbar({
  query, setQuery, onExpandAll, onCollapseAll, onReset, anyExpanded,
}: {
  query: string; setQuery: (v: string) => void;
  onExpandAll: () => void; onCollapseAll: () => void; onReset: () => void;
  anyExpanded: boolean;
}) {
  const pill: React.CSSProperties = {
    height: '34px', padding: '0 13px', borderRadius: '10px', cursor: 'pointer',
    background: 'rgba(22,27,34,0.92)', border: '1px solid #30363D', color: '#C9D1D9',
    fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
    backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
  };
  return (
    <>
      {/* Search — top left */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 6, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 12px',
          borderRadius: '12px', background: 'rgba(22,27,34,0.92)', border: '1px solid #30363D',
          backdropFilter: 'blur(8px)', boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none"><circle cx="7" cy="7" r="4.5" stroke="#8B949E" strokeWidth="1.4" /><path d="M14 14l-3.2-3.2" stroke="#8B949E" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search topics…"
            style={{ width: '180px', background: 'transparent', border: 'none', outline: 'none', color: '#E6EDF3', fontSize: '13px' }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#8B949E', display: 'flex' }}>
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Actions — top right */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 6, display: 'flex', gap: '8px' }}>
        <button style={pill} onClick={anyExpanded ? onCollapseAll : onExpandAll}>
          {anyExpanded
            ? <><svg viewBox="0 0 14 14" width="12" height="12" fill="none"><path d="M3 8.5L7 5l4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> Collapse all</>
            : <><svg viewBox="0 0 14 14" width="12" height="12" fill="none"><path d="M3 5.5L7 9l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> Expand all</>}
        </button>
        <button style={pill} onClick={onReset}>
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none"><path d="M11.5 7a4.5 4.5 0 11-1.3-3.2M11.5 1.5V4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Reset view
        </button>
      </div>
    </>
  );
}

// ── Inner (inside provider) ─────────────────────────────────────────────────────

function MindMapInner() {
  const navigate = useNavigate();
  const { fitView } = useReactFlow();
  const { allSubjects } = useResolvedSubjects();

  const [topicsMap, setTopicsMap] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    loadTopicsBySubject().then(m => { if (alive) setTopicsMap(m); });
    return () => { alive = false; };
  }, []);

  const onOpen = useCallback((id: string) => navigate(`/subject/${id}`), [navigate]);

  const { nodes, edges } = useMemo(
    () => buildGraph(allSubjects, expanded, topicsMap, query, onOpen),
    [allSubjects, expanded, topicsMap, query, onOpen],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'subjectNode') {
      const id = (node.id.split(':')[1]);
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else if (node.type === 'topicNode') {
      const subjectId = (node.data as { subjectId?: string }).subjectId;
      if (subjectId) navigate(`/subject/${subjectId}`);
    } else if (node.type === 'rootNode') {
      fitView({ duration: 500, padding: 0.2 });
    }
  }, [navigate, fitView]);

  const expandAll = useCallback(() => setExpanded(new Set(allSubjects.map(s => s.id))), [allSubjects]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);
  const reset = useCallback(() => fitView({ duration: 500, padding: 0.18 }), [fitView]);

  return (
    <div className="mm-root" style={{ position: 'absolute', inset: 0 }}>
      <style>{`
        .mm-root .react-flow__handle { opacity: 0 !important; pointer-events: none; }
        .mm-root .react-flow__node { cursor: pointer; }
        @keyframes mmIn {
          from { opacity: 0; transform: translateY(10px) scale(0.92); }
          to   { opacity: 1; transform: none; }
        }
        .mm-enter { animation: mmIn 0.55s cubic-bezier(0.16,1,0.3,1) both; animation-delay: var(--mm-delay, 0ms); }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.8}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'gradient' }}
        style={{ background: '#0D1117' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="#1b212b" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            if (n.type === 'rootNode') return ROOT_COLOR;
            const d = n.data as { subject?: SubjectDef; color?: string };
            return d.subject?.color ?? d.color ?? '#8B949E';
          }}
          nodeStrokeWidth={0}
          maskColor="rgba(13,17,23,0.7)"
          style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '12px' }}
        />
      </ReactFlow>
      <Toolbar
        query={query} setQuery={setQuery}
        onExpandAll={expandAll} onCollapseAll={collapseAll} onReset={reset}
        anyExpanded={expanded.size > 0}
      />
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────────

export default function MindMap() {
  return (
    <ReactFlowProvider>
      <MindMapInner />
    </ReactFlowProvider>
  );
}

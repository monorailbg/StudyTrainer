import { Handle, Position } from '@xyflow/react';
import { CATEGORY_COLORS } from '../../data/conceptGraph';

interface DepConceptNodeData {
  label: string;
  category: string;
  mastery: number;
  readiness: number;
  status: 'mastered' | 'partial' | 'weak' | 'locked';
  isSelected: boolean;
  isPrereq: boolean;
  isUnlock: boolean;
  isFiltered: boolean; // faded by search
}

export default function DepConceptNode({ data }: { data: DepConceptNodeData }) {
  const catColor = CATEGORY_COLORS[data.category] ?? '#6B7280';

  let bgColor = '#1C2333';
  let borderColor = '#2D3748';
  let textColor = 'var(--text-2)';
  let dotColor = '#4A5568';

  if (data.isSelected) {
    bgColor = '#1E2D3D';
    borderColor = catColor;
    textColor = 'var(--text-1)';
    dotColor = catColor;
  } else if (data.isPrereq) {
    bgColor = '#1B2438';
    borderColor = '#3B82F6';
    textColor = '#93C5FD';
    dotColor = '#3B82F6';
  } else if (data.isUnlock) {
    bgColor = '#1B2B22';
    borderColor = '#10B981';
    textColor = '#6EE7B7';
    dotColor = '#10B981';
  } else if (data.status === 'mastered') {
    bgColor = '#0F2419';
    borderColor = '#065F46';
    textColor = '#6EE7B7';
    dotColor = '#10B981';
  } else if (data.status === 'partial') {
    bgColor = '#221B0E';
    borderColor = '#78350F';
    textColor = '#FDE68A';
    dotColor = '#F59E0B';
  } else if (data.status === 'weak') {
    bgColor = '#200D0D';
    borderColor = '#7F1D1D';
    textColor = '#FCA5A5';
    dotColor = '#EF4444';
  }

  const opacity = data.isFiltered ? 0.25 : 1;

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 130,
        maxWidth: 160,
        opacity,
        transition: 'opacity 0.2s, border-color 0.15s, background 0.15s',
        boxShadow: data.isSelected
          ? `0 0 0 2px ${catColor}44, 0 4px 16px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor, border: 'none', width: 6, height: 6 }} />

      {/* Category dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 9, color: dotColor, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
          {data.category}
        </span>
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 600,
        fontSize: 11,
        color: textColor,
        lineHeight: 1.3,
        marginBottom: 5,
      }}>
        {data.label}
      </div>

      {/* Mastery bar */}
      <div style={{ height: 3, background: '#2D3748', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${data.mastery}%`,
            background: dotColor,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: dotColor, marginTop: 3, fontWeight: 700 }}>
        {Math.round(data.mastery)}%
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, border: 'none', width: 6, height: 6 }} />
    </div>
  );
}

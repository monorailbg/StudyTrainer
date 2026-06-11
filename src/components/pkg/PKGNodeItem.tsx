import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTheme } from '../../context/ThemeContext';
import { CATEGORY_COLORS } from '../../lib/pkgEngine';
import type { PKGNodeType } from '../../lib/pkgEngine';

interface PKGNodeData {
  label: string;
  nodeType: PKGNodeType;
  category?: string;
  mastery?: number;
  confusionCount?: number;
  isSelected: boolean;
  isFiltered: boolean;
  isNeighbor: boolean;
}

const TYPE_ICON: Record<PKGNodeType, string> = {
  concept:       '⬡',
  note:          '≡',
  flashcard_set: '▣',
  quiz:          '?',
  mistake:       '!',
};

const TYPE_COLOR: Record<PKGNodeType, string> = {
  concept:       '#3B82F6',
  note:          '#10B981',
  flashcard_set: '#6366F1',
  quiz:          '#F59E0B',
  mistake:       '#EF4444',
};

export default function PKGNodeItem({ data }: { data: PKGNodeData }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [hovered, setHovered] = useState(false);

  const catColor = data.nodeType === 'concept'
    ? (CATEGORY_COLORS[data.category ?? ''] ?? TYPE_COLOR.concept)
    : TYPE_COLOR[data.nodeType] ?? '#6B7280';

  const opacity = data.isFiltered && !data.isSelected ? 0.15 : 1;

  const bg = isLight
    ? (data.isSelected ? 'rgba(255,255,255,0.97)' : hovered ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.75)')
    : (data.isSelected ? '#1E293B' : hovered ? '#1A2740' : '#0F172A');

  const border = data.isSelected
    ? `2px solid ${catColor}`
    : data.isNeighbor
      ? `1px solid ${catColor}88`
      : isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.07)';

  const shadow = data.isSelected
    ? `0 0 0 3px ${catColor}33, 0 4px 16px rgba(0,0,0,0.2)`
    : hovered
      ? `0 0 0 2px ${catColor}22, 0 4px 12px rgba(0,0,0,0.15)`
      : isLight ? '0 2px 8px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.3)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 180,
        padding: '9px 11px',
        borderRadius: 11,
        background: bg,
        border,
        boxShadow: shadow,
        opacity,
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.15s ease',
        backdropFilter: isLight ? 'blur(8px)' : undefined,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 6, height: 6 }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
          background: catColor + '22', border: `1px solid ${catColor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: data.nodeType === 'concept' ? 11 : 12, fontWeight: 700, color: catColor,
        }}>
          {TYPE_ICON[data.nodeType]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, lineHeight: 1.3,
            color: isLight ? '#1e293b' : '#F1F5F9',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.label}
          </div>
          {data.nodeType === 'concept' && data.category && (
            <div style={{ fontSize: 9, color: catColor, marginTop: 1, opacity: 0.9 }}>
              {data.category}
            </div>
          )}
          {data.nodeType === 'mistake' && data.confusionCount !== undefined && (
            <div style={{ fontSize: 9, color: '#EF4444', marginTop: 1, fontWeight: 600 }}>
              {data.confusionCount}× wrong
            </div>
          )}
        </div>
      </div>

      {data.nodeType === 'concept' && data.mastery !== undefined && (
        <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${data.mastery}%`,
            background: data.mastery >= 80 ? '#10B981' : data.mastery >= 40 ? '#F59E0B' : '#EF4444',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 6, height: 6 }} />
    </div>
  );
}

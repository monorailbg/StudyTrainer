import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CATEGORY_COLORS } from '../../data/conceptGraph';
import { useTheme } from '../../context/ThemeContext';

interface DepConceptNodeData {
  label: string;
  category: string;
  mastery: number;
  readiness: number;
  status: 'mastered' | 'partial' | 'weak' | 'locked';
  isSelected: boolean;
  isPrereq: boolean;
  isUnlock: boolean;
  isFiltered: boolean;
}

// ── Per-state colour tokens ────────────────────────────────────────────────────

interface StateColors { bg: string; border: string; text: string; dot: string; trackBg: string; shadow: string; }

function getDarkColors(
  catColor: string,
  isSelected: boolean, isPrereq: boolean, isUnlock: boolean,
  status: DepConceptNodeData['status'],
): StateColors {
  if (isSelected) return {
    bg: '#1E2D3D', border: catColor,
    text: 'var(--text-1)', dot: catColor,
    trackBg: '#2D3748',
    shadow: `0 0 0 2px ${catColor}44, 0 4px 16px rgba(0,0,0,0.4)`,
  };
  if (isPrereq) return {
    bg: '#1B2438', border: '#3B82F6',
    text: '#93C5FD', dot: '#3B82F6',
    trackBg: '#2D3748', shadow: '0 2px 8px rgba(0,0,0,0.3)',
  };
  if (isUnlock) return {
    bg: '#1B2B22', border: '#10B981',
    text: '#6EE7B7', dot: '#10B981',
    trackBg: '#2D3748', shadow: '0 2px 8px rgba(0,0,0,0.3)',
  };
  if (status === 'mastered') return {
    bg: '#0F2419', border: '#065F46',
    text: '#6EE7B7', dot: '#10B981',
    trackBg: '#2D3748', shadow: '0 2px 8px rgba(0,0,0,0.3)',
  };
  if (status === 'partial') return {
    bg: '#221B0E', border: '#78350F',
    text: '#FDE68A', dot: '#F59E0B',
    trackBg: '#2D3748', shadow: '0 2px 8px rgba(0,0,0,0.3)',
  };
  if (status === 'weak') return {
    bg: '#200D0D', border: '#7F1D1D',
    text: '#FCA5A5', dot: '#EF4444',
    trackBg: '#2D3748', shadow: '0 2px 8px rgba(0,0,0,0.3)',
  };
  // locked
  return {
    bg: '#1C2333', border: '#2D3748',
    text: 'var(--text-2)', dot: '#4A5568',
    trackBg: '#2D3748', shadow: '0 2px 8px rgba(0,0,0,0.3)',
  };
}

function getLightColors(
  catColor: string,
  isSelected: boolean, isPrereq: boolean, isUnlock: boolean,
  status: DepConceptNodeData['status'],
): StateColors {
  if (isSelected) return {
    bg: 'rgba(255,255,255,0.92)', border: catColor,
    text: '#0f172a', dot: catColor,
    trackBg: 'rgba(0,0,0,0.1)',
    shadow: `0 0 0 2px ${catColor}55, 0 4px 20px rgba(0,0,0,0.12)`,
  };
  if (isPrereq) return {
    bg: 'rgba(219,234,254,0.82)', border: '#3B82F6',
    text: '#1d4ed8', dot: '#3B82F6',
    trackBg: 'rgba(59,130,246,0.15)',
    shadow: '0 2px 8px rgba(59,130,246,0.15)',
  };
  if (isUnlock) return {
    bg: 'rgba(209,250,229,0.82)', border: '#10B981',
    text: '#065f46', dot: '#10B981',
    trackBg: 'rgba(16,185,129,0.15)',
    shadow: '0 2px 8px rgba(16,185,129,0.15)',
  };
  if (status === 'mastered') return {
    bg: 'rgba(209,250,229,0.75)', border: '#10B981',
    text: '#065f46', dot: '#10B981',
    trackBg: 'rgba(16,185,129,0.15)',
    shadow: '0 2px 6px rgba(16,185,129,0.12)',
  };
  if (status === 'partial') return {
    bg: 'rgba(254,243,199,0.82)', border: '#D97706',
    text: '#92400e', dot: '#D97706',
    trackBg: 'rgba(217,119,6,0.15)',
    shadow: '0 2px 6px rgba(217,119,6,0.12)',
  };
  if (status === 'weak') return {
    bg: 'rgba(254,226,226,0.82)', border: '#EF4444',
    text: '#991b1b', dot: '#EF4444',
    trackBg: 'rgba(239,68,68,0.15)',
    shadow: '0 2px 6px rgba(239,68,68,0.12)',
  };
  // locked
  return {
    bg: 'rgba(255,255,255,0.70)', border: 'rgba(0,0,0,0.09)',
    text: '#475569', dot: '#94a3b8',
    trackBg: 'rgba(0,0,0,0.08)',
    shadow: '0 2px 8px rgba(0,0,0,0.07)',
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DepConceptNode({ data }: { data: DepConceptNodeData }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const catColor = CATEGORY_COLORS[data.category] ?? '#6B7280';
  const [hovered, setHovered] = useState(false);

  const c = isLight
    ? getLightColors(catColor, data.isSelected, data.isPrereq, data.isUnlock, data.status)
    : getDarkColors(catColor, data.isSelected, data.isPrereq, data.isUnlock, data.status);

  const hoverShadow = isLight
    ? `0 0 0 2px ${catColor}55, 0 8px 24px rgba(0,0,0,0.13)`
    : `0 0 0 2px ${catColor}55, 0 8px 24px rgba(0,0,0,0.5)`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.bg,
        border: `1px solid ${hovered ? catColor : c.border}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 130,
        maxWidth: 160,
        opacity: data.isFiltered ? 0.25 : 1,
        transition: 'opacity 0.2s, border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? hoverShadow : c.shadow,
        cursor: 'pointer',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        // Frosted glass in light mode
        ...(isLight ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
      }}
    >
      <Handle
        type="target" position={Position.Top}
        style={{ background: c.border, border: 'none', width: 6, height: 6 }}
      />

      {/* Category dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 9, color: c.dot, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>
          {data.category}
        </span>
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 600,
        fontSize: 11,
        color: c.text,
        lineHeight: 1.3,
        marginBottom: 5,
      }}>
        {data.label}
      </div>

      {/* Mastery bar */}
      <div style={{ height: 3, background: c.trackBg, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${data.mastery}%`,
          background: c.dot,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: 9, color: c.dot, marginTop: 3, fontWeight: 700 }}>
        {Math.round(data.mastery)}%
      </div>

      <Handle
        type="source" position={Position.Bottom}
        style={{ background: c.border, border: 'none', width: 6, height: 6 }}
      />
    </div>
  );
}

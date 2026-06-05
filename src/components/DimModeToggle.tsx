import { useDimMode } from '../store/useDimMode';

export function DimModeToggle({ inline }: { inline?: boolean }) {
  const { dim, toggle } = useDimMode();

  const sharedStyle: React.CSSProperties = {
    width: '34px', height: '34px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: dim ? 'rgba(61,126,255,0.18)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${dim ? 'rgba(61,126,255,0.45)' : '#30363D'}`,
    color: dim ? '#93B8FF' : '#6B7280',
    boxShadow: dim ? '0 0 12px rgba(61,126,255,0.35)' : 'none',
    flexShrink: 0,
    transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
  };

  const icon = dim ? (
    <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor">
      <path d="M14.5 11.2A6 6 0 016.8 3.5a.6.6 0 00-.8-.78A7 7 0 1015.3 12a.6.6 0 00-.8-.8z" />
    </svg>
  ) : (
    <svg viewBox="0 0 18 18" width="15" height="15" fill="none">
      <path d="M14.5 11.2A6 6 0 016.8 3.5a.6.6 0 00-.8-.78A7 7 0 1015.3 12a.6.6 0 00-.8-.8z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );

  return (
    <button
      onClick={toggle}
      title={dim ? 'Exit dim mode' : 'Dim reading mode'}
      aria-label="Toggle dim reading mode"
      aria-pressed={dim}
      style={inline ? sharedStyle : { ...sharedStyle, position: 'fixed', bottom: '24px', right: '24px', zIndex: 60 }}
    >
      {icon}
    </button>
  );
}

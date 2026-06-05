import { useDimMode } from '../store/useDimMode';

// Fixed moon button shared by Notes, Flashcards and Quiz. It sits just below the
// navbar, outside each page's dimmable container, so it stays at full brightness
// (and therefore findable) even when dim mode is on.
export function DimModeToggle() {
  const { dim, toggle } = useDimMode();
  return (
    <button
      onClick={toggle}
      title="Dim reading mode"
      aria-label="Toggle dim reading mode"
      aria-pressed={dim}
      style={{
        position: 'fixed', top: '88px', right: '20px', zIndex: 60,
        width: '38px', height: '38px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        background: dim ? 'rgba(61,126,255,0.18)' : 'rgba(22,27,34,0.9)',
        border: `1px solid ${dim ? 'rgba(61,126,255,0.55)' : '#30363D'}`,
        color: dim ? '#93B8FF' : '#8B949E',
        boxShadow: dim ? '0 0 16px rgba(61,126,255,0.45), 0 6px 18px rgba(0,0,0,0.5)' : '0 6px 18px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {dim ? (
        // Filled moon when active
        <svg viewBox="0 0 18 18" width="17" height="17" fill="currentColor">
          <path d="M14.5 11.2A6 6 0 016.8 3.5a.6.6 0 00-.8-.78A7 7 0 1015.3 12a.6.6 0 00-.8-.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 18 18" width="17" height="17" fill="none">
          <path d="M14.5 11.2A6 6 0 016.8 3.5a.6.6 0 00-.8-.78A7 7 0 1015.3 12a.6.6 0 00-.8-.8z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

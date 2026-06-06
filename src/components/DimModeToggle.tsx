import { useDimMode } from '../store/useDimMode';
import { useLang } from '../context/LanguageContext';

// One dim-mode control, used identically on Notes, Flashcards and Quiz (and the
// SubjectPage versions of each). It is a labelled pill — moon icon + DIM/DIMMED —
// so it is easy to find, and it reflects the shared state: outlined + muted when
// off, filled + glowing accent when on. Default placement is a fixed bottom-right
// floating pill; pass `inline` to drop it into a toolbar row instead.
export function DimModeToggle({ inline }: { inline?: boolean }) {
  const { dim, toggle } = useDimMode();
  const { ts } = useLang();

  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '7px',
    height: '34px', padding: '0 13px', borderRadius: '999px', cursor: 'pointer',
    background: dim ? 'rgba(61,126,255,0.18)' : 'rgba(22,27,34,0.92)',
    border: `1px solid ${dim ? 'rgba(61,126,255,0.5)' : '#30363D'}`,
    color: dim ? '#93B8FF' : '#8B949E',
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
    boxShadow: dim ? '0 0 14px rgba(61,126,255,0.4), 0 6px 18px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    flexShrink: 0,
    transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
  };

  const floating: React.CSSProperties = { position: 'fixed', bottom: '24px', right: '24px', zIndex: 60 };

  return (
    <button
      onClick={toggle}
      title={dim ? ts('Exit dim mode') : ts('Dim reading mode')}
      aria-label={ts('Toggle dim reading mode')}
      aria-pressed={dim}
      style={inline ? base : { ...base, ...floating }}
    >
      <svg viewBox="0 0 18 18" width="14" height="14" fill={dim ? 'currentColor' : 'none'}>
        <path d="M14.5 11.2A6 6 0 016.8 3.5a.6.6 0 00-.8-.78A7 7 0 1015.3 12a.6.6 0 00-.8-.8z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      {dim ? ts('DIMMED') : ts('DIM')}
    </button>
  );
}

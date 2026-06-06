import { useDimMode } from '../store/useDimMode';
import { useLang } from '../context/LanguageContext';

export function DimModeToggle() {
  const { dim, toggle } = useDimMode();
  const { ts } = useLang();

  return (
    <button
      onClick={toggle}
      title={dim ? ts('Exit dim mode') : ts('Dim reading mode')}
      aria-label={ts('Toggle dim reading mode')}
      aria-pressed={dim}
      className={`dim-mode-toggle${dim ? ' active' : ''}`}
    >
      <svg viewBox="0 0 18 18" width="14" height="14" fill={dim ? 'currentColor' : 'none'}>
        <path d="M14.5 11.2A6 6 0 016.8 3.5a.6.6 0 00-.8-.78A7 7 0 1015.3 12a.6.6 0 00-.8-.8z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      {dim ? ts('Dimmed') : ts('Dim')}
    </button>
  );
}

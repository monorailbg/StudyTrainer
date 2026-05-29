import { Link, useLocation } from 'react-router-dom';
import { useLang, type Lang } from '../context/LanguageContext';

const JapanFlag = () => (
  <svg viewBox="0 0 30 20" width="20" height="14" style={{ borderRadius: '2px', display: 'block' }} aria-label="Japanese">
    <rect width="30" height="20" fill="#fff" />
    <circle cx="15" cy="10" r="6" fill="#bc002d" />
  </svg>
);

const UKFlag = () => (
  <svg viewBox="0 0 60 30" width="20" height="14" style={{ borderRadius: '2px', display: 'block' }} aria-label="English">
    <rect width="60" height="30" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
    <path d="M37.5,0 L60,15 M0,15 L22.5,30" stroke="#C8102E" strokeWidth="4" />
    <path d="M22.5,0 L0,15 M60,15 L37.5,30" stroke="#C8102E" strokeWidth="4" />
    <rect y="11" width="60" height="8" fill="#fff" />
    <rect x="26" width="8" height="30" fill="#fff" />
    <rect y="12.5" width="60" height="5" fill="#C8102E" />
    <rect x="27.5" width="5" height="30" fill="#C8102E" />
  </svg>
);

function LangToggle() {
  const { lang, setLang } = useLang();

  const btn = (l: Lang, Flag: React.FC, label: string) => (
    <button
      key={l}
      onClick={() => setLang(l)}
      title={label}
      aria-label={`Switch to ${label}`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-widest transition-all duration-200 cursor-pointer border ${
        lang === l
          ? 'bg-md-primary-container text-md-on-primary-container border-md-primary/30'
          : 'bg-transparent text-md-on-surface-variant border-transparent hover:bg-md-surface-container-high'
      }`}
    >
      <Flag />
      {l.toUpperCase()}
    </button>
  );

  return (
    <div className="flex gap-1 bg-md-surface-container rounded-full p-1 border border-md-outline-variant">
      {btn('en', UKFlag, 'English')}
      {btn('ja', JapanFlag, 'Japanese')}
    </div>
  );
}

const navItems = [
  { to: '/', labelKey: 'nav_dashboard' as const },
  { to: '/flashcards', labelKey: 'nav_flashcards' as const },
  { to: '/notes', labelKey: 'nav_notes' as const },
  { to: '/quiz', labelKey: 'nav_quiz' as const },
  { to: '/generate', labelKey: 'nav_generate' as const },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { t } = useLang();

  return (
    <nav className="bg-md-surface-container-low/80 backdrop-blur-md border-b border-md-outline-variant sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline flex-shrink-0 group">
          <div className="w-9 h-9 bg-md-primary-container rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <path d="M4 4h5v12H4a1 1 0 01-1-1V5a1 1 0 011-1z" fill="#EADDFF" />
              <path d="M9 4h7a1 1 0 011 1v10a1 1 0 01-1 1H9V4z" fill="#EADDFF" opacity="0.55" />
              <path d="M9 4v12" stroke="#EADDFF" strokeWidth="1" />
            </svg>
          </div>
          <div>
            <div className="font-display text-md-on-surface text-[15px] leading-tight tracking-tight">
              Global Business
            </div>
            <div className="text-md-primary text-[9px] tracking-[0.18em] uppercase leading-none mt-0.5">
              {t('tagline')}
            </div>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ to, labelKey }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center h-9 px-4 rounded-full text-sm font-medium no-underline whitespace-nowrap transition-all duration-200 ${
                  active
                    ? 'bg-md-secondary-container text-md-on-secondary-container'
                    : 'text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-md-on-surface'
                }`}
              >
                {t(labelKey)}
              </Link>
            );
          })}
        </div>

        {/* Language toggle */}
        <LangToggle />
      </div>
    </nav>
  );
}

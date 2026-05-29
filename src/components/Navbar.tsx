import { Link, useLocation } from 'react-router-dom';
import { useLang, type Lang } from '../context/LanguageContext';

const JapanFlag = () => (
  <svg viewBox="0 0 30 20" width="18" height="12" style={{ borderRadius: '2px', display: 'block' }} aria-label="Japanese">
    <rect width="30" height="20" fill="#fff" />
    <circle cx="15" cy="10" r="6" fill="#bc002d" />
  </svg>
);

const UKFlag = () => (
  <svg viewBox="0 0 60 30" width="18" height="12" style={{ borderRadius: '2px', display: 'block' }} aria-label="English">
    <rect width="60" height="30" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
    <path d="M4.5,0 L30.9,13.2 M29.1,16.8 L55.5,30" stroke="#C8102E" strokeWidth="3" />
    <path d="M55.5,0 L29.1,13.2 M30.9,16.8 L4.5,30" stroke="#C8102E" strokeWidth="3" />
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
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
      style={{
        borderRadius: '6px',
        background: lang === l ? 'rgba(61,126,255,0.15)' : 'transparent',
        color: lang === l ? '#93B8FF' : '#8B949E',
        border: `1px solid ${lang === l ? 'rgba(61,126,255,0.3)' : 'transparent'}`,
      }}
    >
      <Flag />
      {l.toUpperCase()}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5" style={{ padding: '3px', background: '#1F2937', borderRadius: '8px', border: '1px solid #30363D' }}>
      {btn('en', UKFlag, 'English')}
      {btn('ja', JapanFlag, 'Japanese')}
    </div>
  );
}

const GlobeIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7.5" stroke="#3D7EFF" strokeWidth="1.5" />
    <ellipse cx="10" cy="10" rx="3" ry="7.5" stroke="#3D7EFF" strokeWidth="1.5" />
    <path d="M2.5 10h15M3.5 6.5h13M3.5 13.5h13" stroke="#3D7EFF" strokeWidth="1.2" opacity="0.6" />
  </svg>
);

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
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      height: '56px',
      borderBottom: '1px solid rgba(48,54,61,0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      background: 'rgba(13,17,23,0.88)',
    }}>
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline flex-shrink-0">
          <GlobeIcon />
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '13px', color: '#E6EDF3', letterSpacing: '-0.01em', lineHeight: 1 }}>
              GBS
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '9px', color: '#3D7EFF', letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1, marginTop: '3px' }}>
              {t('tagline')}
            </div>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-0.5">
          {navItems.map(({ to, labelKey }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className="relative flex items-center px-3 h-9 text-sm font-medium no-underline whitespace-nowrap transition-colors duration-150"
                style={{
                  borderRadius: '6px',
                  color: active ? '#E6EDF3' : '#8B949E',
                  background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                {t(labelKey)}
                {active && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '8px',
                    right: '8px',
                    height: '2px',
                    borderRadius: '2px 2px 0 0',
                    background: '#3D7EFF',
                    boxShadow: '0 0 8px rgba(61,126,255,0.55)',
                  }} />
                )}
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

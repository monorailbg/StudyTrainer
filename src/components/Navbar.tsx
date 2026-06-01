import { Link, useLocation } from 'react-router-dom';
import { useLang, type Lang } from '../context/LanguageContext';

// ── Flags ─────────────────────────────────────────────────────────────────────

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

// ── Language toggle ────────────────────────────────────────────────────────────

function LangToggle() {
  const { lang, setLang } = useLang();
  const btn = (l: Lang, Flag: React.FC, label: string) => (
    <button
      key={l}
      onClick={() => setLang(l)}
      title={label}
      aria-label={`Switch to ${label}`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-all duration-300 cursor-pointer"
      style={{
        borderRadius: '8px',
        background: lang === l ? 'rgba(61,126,255,0.18)' : 'transparent',
        color: lang === l ? '#93B8FF' : '#8B949E',
        border: `1px solid ${lang === l ? 'rgba(61,126,255,0.35)' : 'transparent'}`,
      }}
    >
      <Flag />
      {l.toUpperCase()}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5" style={{ padding: '3px', background: '#161B22', borderRadius: '12px', border: '1px solid #30363D' }}>
      {btn('en', UKFlag, 'English')}
      {btn('ja', JapanFlag, 'Japanese')}
    </div>
  );
}

// ── Logo mark — Earth with network + subject pins ──────────────────────────────

const GBSLogo = () => (
  <svg viewBox="0 0 44 44" width="44" height="44" fill="none" aria-hidden="true">
    {/* Outer glow */}
    <circle cx="22" cy="22" r="19" fill="rgba(61,126,255,0.06)" />
    {/* Globe body */}
    <circle cx="22" cy="22" r="16" stroke="#3D7EFF" strokeWidth="1.4" />
    {/* Latitude lines */}
    <ellipse cx="22" cy="22" rx="16" ry="7.5" stroke="#3D7EFF" strokeWidth="0.9" opacity="0.35" />
    {/* Central meridian */}
    <ellipse cx="22" cy="22" rx="5.5" ry="16" stroke="#3D7EFF" strokeWidth="0.9" opacity="0.45" />
    {/* Equator */}
    <line x1="6.5" y1="22" x2="37.5" y2="22" stroke="#3D7EFF" strokeWidth="0.7" opacity="0.3" />
    {/* Subject pins */}
    <circle cx="29" cy="15" r="3.2" fill="#3D7EFF" />
    <circle cx="29" cy="15" r="5.5" fill="#3D7EFF" opacity="0.18" />
    <circle cx="14" cy="27" r="2.4" fill="#d4a843" />
    <circle cx="14" cy="27" r="4.2" fill="#d4a843" opacity="0.18" />
    <circle cx="33" cy="27" r="2.2" fill="#4ade80" />
    <circle cx="33" cy="27" r="3.8" fill="#4ade80" opacity="0.18" />
    {/* Arc connections */}
    <path d="M29 15 Q30.5 20 33 27" stroke="#3D7EFF" strokeWidth="0.9" opacity="0.55" strokeDasharray="2 2" />
    <path d="M14 27 Q21 18 29 15" stroke="#d4a843" strokeWidth="0.9" opacity="0.55" strokeDasharray="2 2" />
    <path d="M14 27 Q23 29 33 27" stroke="#4ade80" strokeWidth="0.8" opacity="0.45" strokeDasharray="2 2" />
  </svg>
);

// ── Nav items ──────────────────────────────────────────────────────────────────

const navItems = [
  { to: '/',          labelKey: 'nav_dashboard' as const },
  { to: '/flashcards',labelKey: 'nav_flashcards' as const },
  { to: '/notes',     labelKey: 'nav_notes' as const },
  { to: '/quiz',      labelKey: 'nav_quiz' as const },
  { to: '/generate',  labelKey: 'nav_generate' as const },
];

// ── Navbar ─────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { pathname } = useLocation();
  const { t } = useLang();

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      height: '76px',
      borderBottom: '1px solid rgba(48,54,61,0.7)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      background: 'rgba(13,17,23,0.92)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
    }}>
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline flex-shrink-0 group">
          <div style={{ transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
            className="group-hover:scale-110">
            <GBSLogo />
          </div>
          <div>
            <div style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: '16px',
              color: '#E6EDF3',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              GBS
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: '9px',
              color: '#3D7EFF',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              lineHeight: 1,
              marginTop: '4px',
            }}>
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
                className="relative flex items-center px-4 h-10 text-sm font-medium no-underline whitespace-nowrap"
                style={{
                  borderRadius: '12px',
                  color: active ? '#E6EDF3' : '#8B949E',
                  background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'color 0.25s ease, background 0.25s ease',
                }}
              >
                {t(labelKey)}
                {active && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '10px',
                    right: '10px',
                    height: '2px',
                    borderRadius: '2px 2px 0 0',
                    background: '#3D7EFF',
                    boxShadow: '0 0 10px rgba(61,126,255,0.7)',
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

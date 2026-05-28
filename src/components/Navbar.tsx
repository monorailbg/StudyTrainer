import { Link, useLocation } from 'react-router-dom';
import { useLang, type Lang } from '../context/LanguageContext';

const JapanFlag = () => (
  <svg viewBox="0 0 30 20" width="22" height="15" style={{ borderRadius: '2px', display: 'block' }} aria-label="Japanese">
    <rect width="30" height="20" fill="#fff" />
    <circle cx="15" cy="10" r="6" fill="#bc002d" />
  </svg>
);

const UKFlag = () => (
  <svg viewBox="0 0 60 30" width="22" height="15" style={{ borderRadius: '2px', display: 'block' }} aria-label="English">
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        minHeight: '36px',
        backgroundColor: lang === l ? '#162236' : 'transparent',
        border: `1px solid ${lang === l ? '#2d4465' : 'transparent'}`,
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <Flag />
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: lang === l ? '#f0f4f8' : '#4a5a6e',
        fontFamily: 'IBM Plex Sans, sans-serif',
        transition: 'color 0.15s',
      }}>
        {l.toUpperCase()}
      </span>
    </button>
  );

  return (
    <div style={{
      display: 'flex',
      gap: '2px',
      backgroundColor: '#0d1a2e',
      borderRadius: '8px',
      padding: '2px',
      border: '1px solid #1e2d45',
    }}>
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
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { t } = useLang();

  return (
    <nav
      style={{
        backgroundColor: '#07111f',
        borderBottom: '1px solid #1e2d45',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#d4a843',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Book/study icon */}
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
              <path d="M4 4h5v12H4a1 1 0 01-1-1V5a1 1 0 011-1z" fill="#07111f" />
              <path d="M9 4h7a1 1 0 011 1v10a1 1 0 01-1 1H9V4z" fill="#07111f" opacity="0.6" />
              <path d="M9 4v12" stroke="#07111f" strokeWidth="1" />
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: '15px',
              color: '#f0f4f8',
              lineHeight: 1.2,
              letterSpacing: '-0.3px',
            }}>
              Global Business
            </div>
            <div style={{
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '9px',
              color: '#d4a843',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}>
              {t('tagline')}
            </div>
          </div>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {navItems.map(({ to, labelKey }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  textDecoration: 'none',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  color: active ? '#f0f4f8' : '#94a3b8',
                  backgroundColor: active ? '#162236' : 'transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = '#f0f4f8';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                }}
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

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang, type Lang } from '../context/LanguageContext';

// ── Flags ─────────────────────────────────────────────────────────────────────

const JapanFlag = () => (
  <svg viewBox="0 0 30 20" width="16" height="11" style={{ borderRadius: '2px', display: 'block' }} aria-label="Japanese">
    <rect width="30" height="20" fill="#fff" />
    <circle cx="15" cy="10" r="6" fill="#bc002d" />
  </svg>
);

const UKFlag = () => (
  <svg viewBox="0 0 60 30" width="16" height="11" style={{ borderRadius: '2px', display: 'block' }} aria-label="English">
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
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '5px 9px', borderRadius: '7px',
        background: lang === l ? 'rgba(61,126,255,0.15)' : 'transparent',
        color: lang === l ? '#93B8FF' : '#6B7280',
        border: `1px solid ${lang === l ? 'rgba(61,126,255,0.3)' : 'transparent'}`,
        cursor: 'pointer', fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.04em', transition: 'all 0.15s ease',
      }}
    >
      <Flag />
      {l.toUpperCase()}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: '2px', padding: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
      {btn('en', UKFlag, 'English')}
      {btn('ja', JapanFlag, 'Japanese')}
    </div>
  );
}

// ── Logo mark ─────────────────────────────────────────────────────────────────

const LogoMark = () => (
  <svg viewBox="0 0 36 36" width="34" height="34" fill="none" aria-hidden="true">
    <circle cx="18" cy="18" r="15" stroke="#3D7EFF" strokeWidth="1.5" opacity="0.5" />
    <circle cx="18" cy="18" r="8" fill="rgba(61,126,255,0.1)" stroke="#3D7EFF" strokeWidth="1.2" />
    <path d="M3 18h30M18 3v30" stroke="#3D7EFF" strokeWidth="0.8" opacity="0.25" />
    <ellipse cx="18" cy="18" rx="15" ry="6" stroke="#3D7EFF" strokeWidth="0.8" opacity="0.3" />
    <circle cx="18" cy="18" r="2.5" fill="#3D7EFF" />
    <circle cx="26" cy="11" r="2" fill="#d4a843" />
    <circle cx="10" cy="25" r="1.8" fill="#4ade80" opacity="0.9" />
  </svg>
);

// ── Hamburger / close ─────────────────────────────────────────────────────────

const IconMenu = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" fill="none">
    <path d="M2 4.5h14M2 9h10M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" fill="none">
    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Nav items ──────────────────────────────────────────────────────────────────

const navItems = [
  { to: '/',           labelKey: 'nav_dashboard' as const },
  { to: '/mindmap',    labelKey: 'nav_mindmap' as const },
  { to: '/flashcards', labelKey: 'nav_flashcards' as const },
  { to: '/notes',      labelKey: 'nav_notes' as const },
  { to: '/quiz',       labelKey: 'nav_quiz' as const },
];

// ── Navbar ─────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { pathname } = useLocation();
  const { t } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, height: '72px',
        background: '#080B10',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: '1400px', margin: '0 auto',
          padding: '0 24px', height: '100%',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>

          {/* Logo */}
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}
          >
            <LogoMark />
            <div>
              <div style={{
                fontFamily: "'Sora', sans-serif", fontWeight: 800,
                fontSize: '17px', color: '#E6EDF3', letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                GBS
              </div>
              <div style={{
                fontFamily: "'Inter', sans-serif", fontSize: '8.5px', fontWeight: 500,
                color: '#3D7EFF', letterSpacing: '0.22em', textTransform: 'uppercase',
                lineHeight: 1, marginTop: '4px',
              }}>
                Study Trainer
              </div>
            </div>
          </Link>

          {/* Separator */}
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* Desktop nav pill */}
          <div className="hidden md:flex" style={{ flex: 1, alignItems: 'center' }}>
            <div style={{
              display: 'flex', gap: '1px',
              padding: '4px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px',
            }}>
              {navItems.map(({ to, labelKey }) => {
                const active = pathname === to || (to !== '/' && pathname.startsWith(to));
                return (
                  <Link
                    key={to}
                    to={to}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '6px 13px', borderRadius: '10px',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: '13px', fontWeight: active ? 600 : 400,
                      color: active ? '#E6EDF3' : '#5B6475',
                      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                      textDecoration: 'none',
                      transition: 'color 0.15s ease, background 0.15s ease',
                      letterSpacing: active ? '-0.01em' : '0',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = '#9BA3AE';
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = '#5B6475';
                    }}
                  >
                    {active && (
                      <span style={{
                        width: '5px', height: '5px', borderRadius: '50%',
                        background: '#3D7EFF', flexShrink: 0,
                        boxShadow: '0 0 6px rgba(61,126,255,0.8)',
                      }} />
                    )}
                    {t(labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Spacer on desktop */}
          <div className="hidden md:block" style={{ flex: 1 }} />

          {/* Desktop lang + generate */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <Link
              to="/generate"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '10px',
                background: 'rgba(61,126,255,0.12)',
                border: '1px solid rgba(61,126,255,0.25)',
                color: '#93B8FF', textDecoration: 'none',
                fontSize: '12px', fontWeight: 600,
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(61,126,255,0.18)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(61,126,255,0.4)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(61,126,255,0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(61,126,255,0.25)';
              }}
            >
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none">
                <path d="M7 1v4M7 9v4M1 7h4M9 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 3l2.5 2.5M8.5 8.5L11 11M11 3L8.5 5.5M3 11l2.5-2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              Generate
            </Link>
            <LangToggle />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex md:hidden items-center justify-center w-9 h-9 flex-shrink-0 cursor-pointer ml-auto"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{
              borderRadius: '10px',
              background: menuOpen ? 'rgba(61,126,255,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${menuOpen ? 'rgba(61,126,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: '#8B949E', transition: 'all 0.15s ease',
            }}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: '72px', left: 0, right: 0, bottom: 0,
          zIndex: 49,
          background: 'rgba(8,11,16,0.99)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          display: 'flex', flexDirection: 'column', padding: '20px 16px',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {[...navItems, { to: '/generate', labelKey: 'nav_generate' as const }].map(({ to, labelKey }) => {
              const active = pathname === to || (to !== '/' && pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '13px 16px', borderRadius: '12px', textDecoration: 'none',
                    color: active ? '#E6EDF3' : '#6B7280',
                    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    fontSize: '15px', fontWeight: active ? 600 : 400,
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: active ? '#3D7EFF' : '#2A3040', flexShrink: 0,
                    boxShadow: active ? '0 0 6px rgba(61,126,255,0.7)' : 'none',
                  }} />
                  {t(labelKey)}
                </Link>
              );
            })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '10px' }}>
              Language
            </div>
            <LangToggle />
          </div>
        </div>
      )}
    </>
  );
}

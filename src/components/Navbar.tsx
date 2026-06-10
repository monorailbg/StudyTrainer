import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

// ── Flags ─────────────────────────────────────────────────────────────────────

const JapanFlag = () => {
  const { ts } = useLang();
  return (
  <svg viewBox="0 0 30 20" width="16" height="11" style={{ borderRadius: '2px', display: 'block' }} aria-label={ts('Japanese')}>
    <rect width="30" height="20" fill="#fff" />
    <circle cx="15" cy="10" r="6" fill="#bc002d" />
  </svg>
  );
};

const UKFlag = () => {
  const { ts } = useLang();
  return (
  <svg viewBox="0 0 60 30" width="16" height="11" style={{ borderRadius: '2px', display: 'block' }} aria-label={ts('English')}>
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
};

// ── Theme toggle ──────────────────────────────────────────────────────────────

const STARS = [
  { x: 9,  y: 6,  r: 1.5, delay: '0ms'   },
  { x: 19, y: 11, r: 1.0, delay: '70ms'  },
  { x: 14, y: 19, r: 1.2, delay: '35ms'  },
  { x: 25, y: 7,  r: 0.8, delay: '110ms' },
];

// Track: 54px wide. Knob: 22px. Padding: 3px each side.
// Slide distance: 54 - 22 - 3 - 3 = 26px
const KNOB_TRAVEL = 26;

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { ts } = useLang();
  const dark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={dark ? ts('Switch to light mode') : ts('Switch to dark mode')}
      aria-label={dark ? ts('Switch to light mode') : ts('Switch to dark mode')}
      className="theme-toggle-btn"
      style={{
        position: 'relative',
        width: '54px',
        height: '28px',
        borderRadius: '999px',
        border: '1px solid var(--border-light)',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
        overflow: 'hidden',
        background: dark ? 'var(--bg-surface)' : 'var(--bg-surface)',
        boxShadow: dark
          ? '0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 0 0 1px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        transition: 'background 0.5s ease, box-shadow 0.3s ease',
      }}
    >
      {/* Stars — visible in dark mode */}
      {STARS.map((s, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: s.x,
          top: s.y,
          width: s.r * 2,
          height: s.r * 2,
          borderRadius: '50%',
          background: 'rgba(147,197,253,0.5)',
          opacity: dark ? 0.6 : 0,
          transform: dark ? 'scale(1)' : 'scale(0)',
          transition: `opacity 0.3s ease ${s.delay}, transform 0.35s cubic-bezier(0.3,1.2,0.4,1) ${s.delay}`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Sun rays — static, visible in light mode */}
      <span style={{
        position: 'absolute',
        top: '50%',
        left: '14px',
        width: '28px',
        height: '28px',
        marginTop: '-14px',
        marginLeft: '-14px',
        opacity: dark ? 0 : 0.4,
        transform: dark ? 'scale(0.4) rotate(-30deg)' : 'scale(1) rotate(0deg)',
        transition: 'opacity 0.25s ease, transform 0.4s cubic-bezier(0.3,1.2,0.4,1)',
        pointerEvents: 'none',
      }}>
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1="14" y1="1.5" x2="14" y2="5"
              stroke="rgba(155,139,120,0.4)" strokeWidth="1.2" strokeLinecap="round"
              transform={`rotate(${i * 45} 14 14)`}
            />
          ))}
        </svg>
      </span>

      {/* Sliding knob — uses transform for GPU-accelerated movement */}
      <span style={{
        position: 'absolute',
        top: '3px',
        left: '3px',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        willChange: 'transform',
        background: dark
          ? 'var(--bg-elevated)'
          : 'var(--bg-elevated)',
        boxShadow: dark
          ? '0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.3)'
          : '0 0 0 1px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: dark ? `translateX(${KNOB_TRAVEL}px)` : 'translateX(0px)',
        transition: 'transform 0.4s cubic-bezier(0.3,1.2,0.4,1), background 0.35s ease, box-shadow 0.35s ease',
      }}>
        {/* Moon */}
        <span style={{
          position: 'absolute',
          opacity: dark ? 1 : 0,
          transform: dark ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-45deg)',
          transition: 'opacity 0.25s ease 0.05s, transform 0.35s cubic-bezier(0.3,1.2,0.4,1) 0.05s',
        }}>
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
            <path d="M10 7.5A4.5 4.5 0 013.5 1a5 5 0 100 10A4.5 4.5 0 0010 7.5z" fill="rgba(155,139,120,0.7)" />
            <circle cx="7.5" cy="3" r="0.6" fill="rgba(155,139,120,0.3)" />
            <circle cx="4" cy="4.5" r="0.4" fill="rgba(155,139,120,0.2)" />
          </svg>
        </span>

        {/* Sun */}
        <span style={{
          position: 'absolute',
          opacity: dark ? 0 : 1,
          transform: dark ? 'scale(0.3) rotate(45deg)' : 'scale(1) rotate(0deg)',
          transition: 'opacity 0.25s ease 0.05s, transform 0.35s cubic-bezier(0.3,1.2,0.4,1) 0.05s',
        }}>
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
            <circle cx="6" cy="6" r="3" fill="rgba(155,139,120,0.6)" />
            <circle cx="6" cy="6" r="2" fill="rgba(155,139,120,0.4)" />
          </svg>
        </span>
      </span>
    </button>
  );
}

// ── Language toggle ────────────────────────────────────────────────────────────

function LangToggle() {
  const { lang, setLang, ts } = useLang();
  const isJa = lang === 'ja';

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      height: '28px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: '999px',
      padding: '3px',
    }}>
      {/* Sliding indicator — GPU-accelerated via transform */}
      <span style={{
        position: 'absolute',
        top: '3px',
        left: '3px',
        height: 'calc(100% - 6px)',
        width: 'calc(50% - 3px)',
        borderRadius: '999px',
        background: 'linear-gradient(135deg, rgba(61,126,255,0.18) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid rgba(61,126,255,0.28)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        willChange: 'transform',
        transform: isJa ? 'translateX(100%)' : 'translateX(0)',
        transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: 'none',
      }} />

      {([['en', UKFlag, ts('English')], ['ja', JapanFlag, ts('Japanese')]] as const).map(([l, Flag, label]) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          title={label}
          aria-label={ts('Switch to {label}', { label })}
          style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '0 10px',
            flex: 1,
            background: 'none', border: 'none',
            color: lang === l ? 'var(--text-1)' : 'var(--text-3)',
            cursor: 'pointer',
            fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.05em',
            transition: 'color 0.25s ease',
          }}
        >
          <Flag />
          {l.toUpperCase()}
        </button>
      ))}
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
  { to: '/',            labelKey: 'nav_dashboard' as const },
  { to: '/mindmap',     labelKey: 'nav_mindmap' as const },
  { to: '/flashcards',  labelKey: 'nav_flashcards' as const },
  { to: '/notes',       labelKey: 'nav_notes' as const },
  { to: '/quiz',        labelKey: 'nav_quiz' as const },
  { to: '/dictionary',  labelKey: 'nav_dictionary' as const },
];

// ── Navbar ─────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { pathname } = useLocation();
  const { t, ts } = useLang();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, height: '72px',
        background: 'var(--bg-nav)',
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
                fontSize: '17px', color: 'var(--accent-primary)', letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                GBS
              </div>
              <div style={{
                fontFamily: "'Inter', sans-serif", fontSize: '8.5px', fontWeight: 500,
                color: 'var(--accent-primary)', letterSpacing: '0.22em', textTransform: 'uppercase',
                lineHeight: 1, marginTop: '4px',
              }}>
                {ts('Study Trainer')}
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
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
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
                      color: active ? 'var(--text-1)' : 'var(--text-2)',
                      background: active ? 'var(--bg-elevated)' : 'transparent',
                      textDecoration: 'none',
                      transition: 'color 0.15s ease, background 0.15s ease',
                      letterSpacing: active ? '-0.01em' : '0',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-1)';
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
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

          {/* Desktop lang + settings */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => navigate('/generate')}
              title={ts('Generate content')}
              aria-label={ts('Generate content')}
              className="generate-btn"
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '0 14px 0 11px',
                height: '30px',
                borderRadius: '999px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-1)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                overflow: 'hidden',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
                transition: 'box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease',
              }}
            >
              {/* Shimmer sweep on hover (CSS class controls animation) */}
              <span className="generate-btn-shimmer" style={{
                position: 'absolute', top: 0, left: 0, bottom: 0, width: '45%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(61,126,255,0.15) 50%, transparent 100%)',
                transform: 'translateX(-120%) skewX(-12deg)',
                pointerEvents: 'none',
              }} />
              {/* AI sparkle icon */}
              <svg viewBox="0 0 13 13" width="12" height="12" fill="none" style={{ flexShrink: 0 }}>
                <path d="M6.5 1L7.4 5.1 11.5 6 7.4 6.9 6.5 11 5.6 6.9 1.5 6 5.6 5.1Z" fill="var(--accent-primary)" fillOpacity="0.75"/>
                <path d="M10.5 1L11 3 13 3.5 11 4 10.5 6 10 4 8 3.5 10 3Z" fill="var(--accent-primary)" fillOpacity="0.5"/>
              </svg>
              {ts('Generate')}
            </button>
            <ThemeToggle />
            <LangToggle />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex md:hidden items-center justify-center w-9 h-9 flex-shrink-0 cursor-pointer ml-auto"
            aria-label={menuOpen ? ts('Close menu') : ts('Open menu')}
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
          background: 'var(--bg-page)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          display: 'flex', flexDirection: 'column', padding: '20px 16px',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {navItems.map(({ to, labelKey }) => {
              const active = pathname === to || (to !== '/' && pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '13px 16px', borderRadius: '12px', textDecoration: 'none',
                    color: active ? 'var(--text-1)' : 'var(--text-2)',
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    fontSize: '15px', fontWeight: active ? 600 : 400,
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: active ? '#3D7EFF' : 'transparent', flexShrink: 0,
                    boxShadow: active ? '0 0 6px rgba(61,126,255,0.7)' : 'none',
                  }} />
                  {t(labelKey)}
                </Link>
              );
            })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '10px' }}>
                  {ts('Theme')}
                </div>
                <ThemeToggle />
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '10px' }}>
                  {ts('Language')}
                </div>
                <LangToggle />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

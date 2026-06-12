import { useState, useRef, useLayoutEffect, useCallback } from 'react';
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
        position: 'relative', width: '48px', height: '26px', borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.10)', padding: 0, cursor: 'pointer',
        flexShrink: 0, overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'border-color 0.3s ease',
      }}
    >
      {STARS.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', left: s.x, top: s.y,
          width: s.r * 2, height: s.r * 2, borderRadius: '50%',
          background: 'rgba(147,197,253,0.5)',
          opacity: dark ? 0.6 : 0,
          transform: dark ? 'scale(1)' : 'scale(0)',
          transition: `opacity 0.3s ease ${s.delay}, transform 0.35s cubic-bezier(0.3,1.2,0.4,1) ${s.delay}`,
          pointerEvents: 'none',
        }} />
      ))}
      <span style={{
        position: 'absolute', top: '50%', left: '12px', width: '26px', height: '26px',
        marginTop: '-13px', marginLeft: '-13px',
        opacity: dark ? 0 : 0.35,
        transform: dark ? 'scale(0.4) rotate(-30deg)' : 'scale(1) rotate(0deg)',
        transition: 'opacity 0.25s ease, transform 0.4s cubic-bezier(0.3,1.2,0.4,1)',
        pointerEvents: 'none',
      }}>
        <svg viewBox="0 0 28 28" width="26" height="26" fill="none">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1="14" y1="1.5" x2="14" y2="5"
              stroke="rgba(155,139,120,0.4)" strokeWidth="1.2" strokeLinecap="round"
              transform={`rotate(${i * 45} 14 14)`}
            />
          ))}
        </svg>
      </span>
      <span style={{
        position: 'absolute', top: '2px', left: '2px', width: '20px', height: '20px',
        borderRadius: '50%', willChange: 'transform',
        background: 'rgba(255,255,255,0.14)',
        boxShadow: dark
          ? '0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 0 0 1px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: dark ? `translateX(${KNOB_TRAVEL}px)` : 'translateX(0px)',
        transition: 'transform 0.4s cubic-bezier(0.3,1.2,0.4,1), box-shadow 0.35s ease',
      }}>
        <span style={{
          position: 'absolute', opacity: dark ? 1 : 0,
          transform: dark ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-45deg)',
          transition: 'opacity 0.25s ease 0.05s, transform 0.35s cubic-bezier(0.3,1.2,0.4,1) 0.05s',
        }}>
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
            <path d="M10 7.5A4.5 4.5 0 013.5 1a5 5 0 100 10A4.5 4.5 0 0010 7.5z" fill="rgba(155,139,120,0.7)" />
          </svg>
        </span>
        <span style={{
          position: 'absolute', opacity: dark ? 0 : 1,
          transform: dark ? 'scale(0.3) rotate(45deg)' : 'scale(1) rotate(0deg)',
          transition: 'opacity 0.25s ease 0.05s, transform 0.35s cubic-bezier(0.3,1.2,0.4,1) 0.05s',
        }}>
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
            <circle cx="6" cy="6" r="3" fill="rgba(155,139,120,0.6)" />
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
      position: 'relative', display: 'flex', height: '26px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '999px', padding: '2px',
    }}>
      <span style={{
        position: 'absolute', top: '2px', left: '2px',
        height: 'calc(100% - 4px)', width: 'calc(50% - 2px)',
        borderRadius: '999px',
        background: 'linear-gradient(135deg, rgba(61,126,255,0.22) 0%, rgba(99,102,241,0.14) 100%)',
        border: '1px solid rgba(61,126,255,0.30)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        willChange: 'transform',
        transform: isJa ? 'translateX(100%)' : 'translateX(0)',
        transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: 'none',
      }} />
      {(['en', 'ja'] as const).map((l, idx) => {
        const Flag = l === 'en' ? UKFlag : JapanFlag;
        const label = l === 'en' ? ts('English') : ts('Japanese');
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            title={label}
            aria-label={ts('Switch to {label}', { label })}
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              padding: '0 9px', flex: 1, background: 'none', border: 'none',
              color: lang === l ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
              transition: 'color 0.25s ease',
            }}
          >
            {idx === 0 ? <UKFlag /> : <JapanFlag />}
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

// ── Logo mark ─────────────────────────────────────────────────────────────────

const LogoMark = () => (
  <svg viewBox="0 0 36 36" width="32" height="32" fill="none" aria-hidden="true">
    <circle cx="18" cy="18" r="15" stroke="#3D7EFF" strokeWidth="1.5" opacity="0.4" />
    <circle cx="18" cy="18" r="8" fill="rgba(61,126,255,0.08)" stroke="#3D7EFF" strokeWidth="1.2" />
    <path d="M3 18h30M18 3v30" stroke="#3D7EFF" strokeWidth="0.8" opacity="0.2" />
    <ellipse cx="18" cy="18" rx="15" ry="6" stroke="#3D7EFF" strokeWidth="0.8" opacity="0.25" />
    <circle cx="18" cy="18" r="2.5" fill="#3D7EFF" />
    <circle cx="26" cy="11" r="2" fill="#d4a843" />
    <circle cx="10" cy="25" r="1.8" fill="#4ade80" opacity="0.9" />
  </svg>
);

// ── Icons ─────────────────────────────────────────────────────────────────────

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
  { to: '/',                labelKey: 'nav_dashboard'      as const },
  { to: '/mindmap',         labelKey: 'nav_mindmap'        as const },
  { to: '/flashcards',      labelKey: 'nav_flashcards'     as const },
  { to: '/notes',           labelKey: 'nav_notes'          as const },
  { to: '/quiz',            labelKey: 'nav_quiz'           as const },
  { to: '/dictionary',      labelKey: 'nav_dictionary'     as const },
  { to: '/knowledge-graph', labelKey: 'nav_knowledge_graph' as const },
  { to: '/blind-spots',     labelKey: 'nav_blind_spots'   as const },
  { to: '/pkg',             labelKey: 'nav_pkg'            as const },
  { to: '/companies',       labelKey: 'nav_companies'      as const },
];

// ── Sliding nav links with kinetic indicator ──────────────────────────────────

function NavLinks() {
  const { pathname } = useLocation();
  const { t, lang } = useLang();

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicatorPos, setIndicatorPos] = useState<{ left: number; width: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const activeIdx = navItems.findIndex(({ to }) =>
    pathname === to || (to !== '/' && pathname.startsWith(to))
  );

  const measure = useCallback((idx: number) => {
    const el = itemRefs.current[idx];
    const box = containerRef.current;
    if (!el || !box) return null;
    const cRect = box.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return { left: eRect.left - cRect.left, width: eRect.width };
  }, []);

  // Snap indicator to active item on route or language change
  useLayoutEffect(() => {
    if (activeIdx < 0) return;
    const pos = measure(activeIdx);
    if (pos) setIndicatorPos(pos);
  }, [pathname, activeIdx, lang, measure]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '3px',
        gap: 0,
      }}
    >
      {/* Kinetic sliding indicator */}
      {indicatorPos && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '3px',
            left: indicatorPos.left,
            width: indicatorPos.width,
            height: 'calc(100% - 6px)',
            borderRadius: '999px',
            background: isHovering
              ? 'rgba(255,255,255,0.07)'
              : 'linear-gradient(135deg, rgba(61,126,255,0.18) 0%, rgba(99,102,241,0.11) 100%)',
            border: isHovering
              ? '1px solid rgba(255,255,255,0.09)'
              : '1px solid rgba(61,126,255,0.30)',
            boxShadow: isHovering
              ? 'none'
              : '0 0 12px rgba(61,126,255,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
            pointerEvents: 'none',
            transition: [
              'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              'background 0.18s ease',
              'border-color 0.18s ease',
              'box-shadow 0.18s ease',
            ].join(', '),
            zIndex: 0,
          }}
        />
      )}

      {navItems.map(({ to, labelKey }, i) => {
        const active = pathname === to || (to !== '/' && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            ref={el => { itemRefs.current[i] = el; }}
            onMouseEnter={() => {
              const pos = measure(i);
              if (pos) setIndicatorPos(pos);
              setIsHovering(true);
            }}
            onMouseLeave={() => {
              setIsHovering(false);
              if (activeIdx >= 0) {
                const pos = measure(activeIdx);
                if (pos) setIndicatorPos(pos);
              }
            }}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 11px',
              borderRadius: '999px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '12px',
              fontWeight: active ? 600 : 400,
              color: active
                ? 'rgba(255,255,255,0.93)'
                : 'rgba(255,255,255,0.42)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              letterSpacing: active ? '-0.01em' : '0.01em',
              userSelect: 'none',
              transition: 'color 0.2s ease',
              background: 'none',
            }}
          >
            {active && (
              <span style={{
                width: '4px', height: '4px', borderRadius: '50%', flexShrink: 0,
                background: '#3D7EFF',
                boxShadow: '0 0 6px rgba(61,126,255,0.95), 0 0 14px rgba(61,126,255,0.45)',
              }} />
            )}
            {t(labelKey)}
          </Link>
        );
      })}
    </div>
  );
}

// ── Generate button ───────────────────────────────────────────────────────────

function GenerateButton() {
  const { ts } = useLang();
  const navigate = useNavigate();
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={() => navigate('/generate')}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'scale(1.03)';
        el.style.boxShadow = [
          '0 0 0 1px rgba(61,126,255,0.50)',
          '0 0 16px rgba(61,126,255,0.30)',
          '0 0 32px rgba(61,126,255,0.12)',
          'inset 0 1px 0 rgba(255,255,255,0.12)',
        ].join(', ');
        el.style.borderColor = 'rgba(61,126,255,0.55)';
        el.style.background = 'rgba(61,126,255,0.12)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.boxShadow = BTN_SHADOW_DEFAULT;
        el.style.borderColor = 'rgba(255,255,255,0.12)';
        el.style.background = 'rgba(255,255,255,0.06)';
        setPressed(false);
      }}
      onMouseDown={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
        setPressed(true);
      }}
      onMouseUp={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
        setPressed(false);
      }}
      title={ts('Generate content')}
      aria-label={ts('Generate content')}
      className="generate-btn"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '0 13px 0 10px',
        height: '28px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.85)',
        cursor: 'pointer',
        fontSize: '12px', fontWeight: 600, letterSpacing: '0.02em',
        overflow: 'hidden',
        boxShadow: BTN_SHADOW_DEFAULT,
        transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease',
        flexShrink: 0,
      }}
    >
      {/* Shimmer sweep */}
      <span className="generate-btn-shimmer" style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: '45%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(61,126,255,0.18) 50%, transparent 100%)',
        transform: pressed ? 'translateX(250%) skewX(-12deg)' : 'translateX(-120%) skewX(-12deg)',
        pointerEvents: 'none',
        transition: 'transform 0.55s ease',
      }} />
      <svg viewBox="0 0 13 13" width="11" height="11" fill="none" style={{ flexShrink: 0 }}>
        <path d="M6.5 1L7.4 5.1 11.5 6 7.4 6.9 6.5 11 5.6 6.9 1.5 6 5.6 5.1Z" fill="#3D7EFF" fillOpacity="0.9"/>
        <path d="M10.5 1L11 3 13 3.5 11 4 10.5 6 10 4 8 3.5 10 3Z" fill="#3D7EFF" fillOpacity="0.55"/>
      </svg>
      {ts('Generate')}
    </button>
  );
}

const BTN_SHADOW_DEFAULT = [
  '0 0 0 1px rgba(255,255,255,0.06)',
  'inset 0 1px 0 rgba(255,255,255,0.06)',
].join(', ');

// ── HUD glass style (shared constant) ────────────────────────────────────────

const GLASS_STYLE: React.CSSProperties = {
  background: 'rgba(10, 17, 34, 0.45)',
  backdropFilter: 'blur(12px) saturate(140%)',
  WebkitBackdropFilter: 'blur(12px) saturate(140%)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
};

// ── Navbar ─────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { pathname } = useLocation();
  const { t, ts } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  const prevPath = useRef(pathname);
  if (prevPath.current !== pathname) {
    prevPath.current = pathname;
    if (menuOpen) setMenuOpen(false);
  }

  return (
    <>
      {/*
        Outer nav: sticky wrapper — keeps the 76px height so page-height
        calculations (calc(100vh - 76px)) remain intact. The visual glass
        pill is the inner div with top/side padding creating the float gap.
      */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: '76px',
        background: 'transparent',
        padding: '10px 16px',
        boxSizing: 'border-box',
      }}>
        {/* Glass HUD pill */}
        <div style={{
          ...GLASS_STYLE,
          maxWidth: '1400px',
          margin: '0 auto',
          height: '100%',
          borderRadius: '9999px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>

          {/* Logo */}
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', flexShrink: 0 }}
          >
            <LogoMark />
            <div className="hidden md:block">
              <div style={{
                fontFamily: "'Sora', sans-serif", fontWeight: 800,
                fontSize: '16px', color: '#3D7EFF', letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                GBS
              </div>
              <div style={{
                fontFamily: "'Inter', sans-serif", fontSize: '7.5px', fontWeight: 500,
                color: 'rgba(61,126,255,0.75)', letterSpacing: '0.22em', textTransform: 'uppercase',
                lineHeight: 1, marginTop: '3px',
              }}>
                {ts('Study Trainer')}
              </div>
            </div>
          </Link>

          {/* Separator */}
          <div className="hidden md:block" style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* Desktop nav — scrollable container */}
          <div className="hidden md:flex" style={{ flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <NavLinks />
          </div>

          {/* Right-side controls */}
          <div className="hidden md:flex items-center flex-shrink-0" style={{ gap: '8px', marginLeft: 'auto' }}>
            <GenerateButton />
            <ThemeToggle />
            <LangToggle />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex md:hidden items-center justify-center w-8 h-8 flex-shrink-0 cursor-pointer ml-auto"
            aria-label={menuOpen ? ts('Close menu') : ts('Open menu')}
            style={{
              borderRadius: '999px',
              background: menuOpen ? 'rgba(61,126,255,0.15)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${menuOpen ? 'rgba(61,126,255,0.35)' : 'rgba(255,255,255,0.10)'}`,
              color: 'rgba(255,255,255,0.7)',
              transition: 'all 0.2s ease',
            }}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>

        </div>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: '76px', left: 0, right: 0, bottom: 0,
          zIndex: 49,
          background: 'rgba(8, 11, 16, 0.96)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          display: 'flex', flexDirection: 'column', padding: '16px',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                    color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                    background: active ? 'rgba(61,126,255,0.12)' : 'transparent',
                    fontSize: '15px', fontWeight: active ? 600 : 400,
                    border: active ? '1px solid rgba(61,126,255,0.25)' : '1px solid transparent',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: active ? '#3D7EFF' : 'rgba(255,255,255,0.15)',
                    boxShadow: active ? '0 0 8px rgba(61,126,255,0.8)' : 'none',
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }} />
                  {t(labelKey)}
                </Link>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '10px' }}>
                  {ts('Theme')}
                </div>
                <ThemeToggle />
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '10px' }}>
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

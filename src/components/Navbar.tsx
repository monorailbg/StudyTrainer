import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/flashcards', label: 'Flashcards' },
  { to: '/notes', label: 'Notes' },
  { to: '/quiz', label: 'Quiz' },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav
      style={{ backgroundColor: '#0f1623', borderBottom: '1px solid #243048' }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3">
          <div
            style={{ backgroundColor: '#c9a84c' }}
            className="w-8 h-8 rounded flex items-center justify-center"
          >
            <span style={{ color: '#0f1623', fontFamily: 'DM Serif Display, serif', fontWeight: 700 }} className="text-sm">
              G
            </span>
          </div>
          <div>
            <span
              style={{ fontFamily: 'DM Serif Display, serif', color: '#f0f4f8', letterSpacing: '-0.5px' }}
              className="text-lg font-normal"
            >
              Global Business
            </span>
            <span style={{ color: '#c9a84c', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', display: 'block', letterSpacing: '0.15em' }} className="uppercase">
              Study Platform
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map(({ to, label }) => {
            const isActive = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                style={{
                  color: isActive ? '#c9a84c' : '#8896a8',
                  backgroundColor: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
                  borderBottom: isActive ? '2px solid #c9a84c' : '2px solid transparent',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
                className="px-4 py-5 transition-all duration-150 hover:text-white"
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

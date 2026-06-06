import { useState, useEffect, useRef } from 'react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../lib/geminiGenerator';
import { useLang } from '../context/LanguageContext';

const IconSettings = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M9 1.5v1.8M9 14.7v1.8M1.5 9h1.8M14.7 9h1.8M3.6 3.6l1.27 1.27M13.13 13.13l1.27 1.27M14.4 3.6l-1.27 1.27M4.87 13.13l-1.27 1.27"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
    />
  </svg>
);

const IconKey = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
    <circle cx="5.5" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M9 8h5.5M12 6.5v3M14.5 6.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export function SettingsPanel() {
  const { ts } = useLang();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(() => !!getStoredApiKey());
  const [editing, setEditing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const save = () => {
    if (!key.trim()) return;
    setStoredApiKey(key.trim());
    setSaved(true);
    setEditing(false);
    setKey('');
  };

  const remove = () => {
    clearStoredApiKey();
    setSaved(false);
    setEditing(false);
    setKey('');
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        aria-label={ts('Settings')}
        title={ts('Settings')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '34px', height: '34px', borderRadius: '9px', cursor: 'pointer',
          background: open ? 'rgba(61,126,255,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(61,126,255,0.30)' : 'rgba(255,255,255,0.09)'}`,
          color: open ? '#93B8FF' : '#6B7280',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
      >
        <IconSettings />
        {saved && !editing && (
          <span style={{
            position: 'absolute', top: '5px', right: '5px',
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#2EA043',
            boxShadow: '0 0 4px rgba(46,160,67,0.7)',
          }} />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            width: '320px',
            background: '#0D1117',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '14px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06) inset',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <IconSettings />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#E6EDF3', letterSpacing: '0.04em' }}>
              {ts('Settings')}
            </span>
          </div>

          {/* API Key section */}
          <div style={{ padding: '16px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <IconKey />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8B949E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {ts('Gemini API key required')}
              </span>
            </div>

            {saved && !editing ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2EA043', boxShadow: '0 0 5px rgba(46,160,67,0.6)', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#8B949E' }}>{ts('Gemini API key configured')}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setEditing(true)}
                    style={{ fontSize: '11px', color: '#8B949E', background: 'transparent', border: '1px solid #30363D', borderRadius: '6px', padding: '3px 9px', cursor: 'pointer' }}
                  >
                    {ts('Change')}
                  </button>
                  <button
                    onClick={remove}
                    style={{ fontSize: '11px', color: '#F85149', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)', borderRadius: '6px', padding: '3px 9px', cursor: 'pointer' }}
                  >
                    {ts('Remove')}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  autoFocus
                  type="password"
                  placeholder={ts('Paste your API key (starts with AQ.)')}
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape' && saved) { setEditing(false); setKey(''); } }}
                  style={{
                    width: '100%', height: '34px', padding: '0 10px',
                    background: '#161B22', border: '1px solid #30363D', borderRadius: '8px',
                    color: '#E6EDF3', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3D7EFF'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#30363D'; }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={save}
                    disabled={!key.trim()}
                    style={{
                      flex: 1, height: '32px', fontSize: '12px', fontWeight: 600,
                      background: '#3D7EFF', color: '#E6EDF3', border: 'none',
                      borderRadius: '8px', cursor: 'pointer',
                      opacity: key.trim() ? 1 : 0.4,
                    }}
                  >
                    {ts('Save')}
                  </button>
                  {saved && (
                    <button
                      onClick={() => { setEditing(false); setKey(''); }}
                      style={{ height: '32px', padding: '0 12px', fontSize: '12px', color: '#8B949E', background: 'transparent', border: '1px solid #30363D', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      {ts('Cancel')}
                    </button>
                  )}
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: '#484F58', textDecoration: 'none' }}
                >
                  {ts('Get a free key →')}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

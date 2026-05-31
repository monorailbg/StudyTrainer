import { useState } from 'react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../lib/geminiGenerator';

export function ApiKeyBanner() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(() => !!getStoredApiKey());
  const [editing, setEditing] = useState(false);

  if (saved && !editing) {
    return (
      <div style={{ background: '#161B22', borderBottom: '1px solid #30363D' }} className="px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs" style={{ color: '#8B949E' }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#2EA043' }} />
          Gemini API key configured
        </div>
        <button
          onClick={() => { clearStoredApiKey(); setSaved(false); setKey(''); setEditing(false); }}
          className="text-xs bg-transparent border-none cursor-pointer p-0 underline"
          style={{ color: '#8B949E' }}
        >
          Remove
        </button>
      </div>
    );
  }

  const save = () => {
    if (!key.trim()) return;
    setStoredApiKey(key.trim());
    setSaved(true);
    setEditing(false);
    setKey('');
  };

  return (
    <div style={{ background: '#161B22', borderBottom: '1px solid rgba(61,126,255,0.25)' }} className="px-6 py-2.5 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0" style={{ color: '#3D7EFF' }}>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
          <path d="M11 5a3 3 0 01-3 3H3l-2 2v-2H0V3a1 1 0 011-1h9a1 1 0 011 1v2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M6 7v3M10 9h5a1 1 0 011 1v3a1 1 0 01-1 1h-5V9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        Gemini API key required
      </div>
      <input
        type="password"
        placeholder="Paste your API key (starts with AIza)"
        value={key}
        onChange={e => setKey(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        className="flex-1 min-w-0 h-7 px-3 text-xs outline-none"
        style={{
          maxWidth: '380px',
          background: '#0D1117',
          border: '1px solid #30363D',
          borderRadius: '6px',
          color: '#E6EDF3',
          fontFamily: "'Inter', sans-serif",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#3D7EFF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(61,126,255,0.12)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#30363D'; e.currentTarget.style.boxShadow = 'none'; }}
      />
      <button
        onClick={save}
        disabled={!key.trim()}
        className="h-7 px-3 text-xs font-semibold border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all"
        style={{ background: '#3D7EFF', color: '#E6EDF3', borderRadius: '6px' }}
      >
        Save
      </button>
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs no-underline hover:underline"
        style={{ color: '#8B949E' }}
      >
        Get a free key →
      </a>
    </div>
  );
}

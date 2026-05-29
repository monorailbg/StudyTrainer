import { useState } from 'react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../lib/geminiGenerator';

export function ApiKeyBanner() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(() => !!getStoredApiKey());
  const [editing, setEditing] = useState(false);

  if (saved && !editing) {
    return (
      <div className="bg-md-surface-container border-b border-md-outline-variant px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-md-on-surface-variant">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          Gemini API key configured
        </div>
        <button
          onClick={() => { clearStoredApiKey(); setSaved(false); setKey(''); setEditing(false); }}
          className="text-xs text-md-on-surface-variant hover:text-md-on-surface bg-transparent border-none cursor-pointer underline p-0"
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
    <div className="bg-md-surface-container-high border-b border-md-primary/30 px-6 py-3 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-xs font-medium text-md-primary flex-shrink-0">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <circle cx="6" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 10.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 7h2M6 6v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Gemini API key required
      </div>
      <input
        type="password"
        placeholder="Paste your Gemini API key (starts with AQ.)"
        value={key}
        onChange={e => setKey(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        className="flex-1 min-w-0 h-8 px-3 rounded-full text-xs border border-md-outline-variant bg-md-surface-container text-md-on-surface outline-none focus:border-md-primary"
        style={{ maxWidth: '420px' }}
      />
      <button
        onClick={save}
        disabled={!key.trim()}
        className="h-8 px-4 rounded-full text-xs font-semibold border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all"
        style={{ backgroundColor: '#D0BCFF', color: '#381E72' }}
      >
        Save
      </button>
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-md-on-surface-variant hover:text-md-on-surface no-underline hover:underline"
      >
        Get a free key →
      </a>
    </div>
  );
}

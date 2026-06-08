import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';

const PROXY_URL = import.meta.env.DEV
  ? 'http://localhost:5000/api/generate'
  : '/api/generate';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export function AskAI({ context, color = '#3D7EFF' }: { context: string; color?: string }) {
  const { ts } = useLang();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const prompt = `You are a helpful study assistant. Context:\n${context}\n\nQuestion: ${question}\n\nAnswer clearly and concisely.`;
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ text: prompt }] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(err.error ?? 'Request failed');
      }
      const data = await res.json() as { text: string };
      setMessages(prev => [...prev, { role: 'ai', text: data.text ?? 'No response.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', borderRadius: '14px', border: `1px solid ${open ? color + '30' : '#21262D'}`, background: '#161B22', overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: open ? color : '#8B949E', fontSize: '12px', fontWeight: 600,
          transition: 'color 0.15s',
        }}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 6.5c0-1.1.9-2 2-2s2 .9 2 2c0 .8-.5 1.5-1.2 1.8L8.5 9v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8.5" cy="11" r=".5" fill="currentColor" />
        </svg>
        {ts('Ask a question')}
        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.6 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${color}20`, padding: '12px 16px 16px' }}>
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', maxHeight: '320px', overflowY: 'auto' }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '85%', padding: '8px 12px', borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: m.role === 'user' ? color + '20' : '#0D1117',
                    border: `1px solid ${m.role === 'user' ? color + '35' : '#30363D'}`,
                    fontSize: '13px', lineHeight: 1.6,
                    color: m.role === 'user' ? '#E6EDF3' : 'rgba(230,237,243,0.82)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 3px', background: '#0D1117', border: '1px solid #30363D', fontSize: '13px', color: '#484F58' }}>
                    {ts('Thinking…')}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={ts('Ask about this content…')}
              style={{
                flex: 1, background: '#0D1117', border: `1px solid #30363D`,
                borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
                color: '#E6EDF3', outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = color + '55'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#30363D'; }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                height: '36px', padding: '0 14px', borderRadius: '8px',
                background: color + '20', color, border: `1px solid ${color}40`,
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                opacity: !input.trim() || loading ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {ts('Send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

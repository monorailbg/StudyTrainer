import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { MarkdownContent } from './MarkdownContent';

// Mirrors the URL-resolution priority used by geminiProxy.ts's GENERATE_ENDPOINT
// (VITE_PROXY_URL override → same-origin in both dev-via-Vite-proxy and prod).
const ASK_AI_ENDPOINT: string = (() => {
  const override = (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/$/, '');
  if (override) return `${override}/api/quiz/ask-ai`;
  return '/api/quiz/ask-ai';
})();

export interface QuizAskAIContext {
  question: string;
  options: string[];
  selectedOption: string;
  isCorrect: boolean;
  baseExplanation: string;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export function QuizAskAI({ quizContext, color = '#3D7EFF' }: { quizContext: QuizAskAIContext; color?: string }) {
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
    setMessages(prev => [...prev, { role: 'user', text: question }, { role: 'ai', text: '' }]);
    setLoading(true);

    try {
      const res = await fetch(ASK_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuestion: question, quizContext }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(err.error ?? 'Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'ai', text: acc };
          return next;
        });
      }
    } catch (err) {
      const message = `Error: ${err instanceof Error ? err.message : String(err)}`;
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'ai', text: message };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ borderRadius: '14px', border: `1px solid ${open ? color + '30' : 'var(--border-light)'}`, background: 'var(--bg-elevated)', overflow: 'hidden', transition: 'border-color 0.2s', flex: 1, minWidth: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
          color: open ? color : 'var(--text-3)', fontSize: '12px', fontWeight: 600,
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
        <div style={{ borderTop: `1px solid ${color}20`, padding: '10px 14px 14px' }}>
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', maxHeight: '320px', overflowY: 'auto' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '90%', padding: m.role === 'user' ? '8px 12px' : '6px 12px',
                    borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: m.role === 'user' ? color + '20' : 'var(--bg-surface)',
                    border: `1px solid ${m.role === 'user' ? color + '35' : 'var(--border-base)'}`,
                    fontSize: '13px', lineHeight: 1.6,
                    color: m.role === 'user' ? 'var(--text-1)' : 'var(--text-2)',
                  }}>
                    {m.role === 'user' ? (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                    ) : m.text ? (
                      <MarkdownContent content={m.text} accent={color} />
                    ) : (
                      <span style={{ color: 'var(--text-3)' }}>{ts('Thinking…')}</span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={ts('Ask about this question…')}
              style={{
                flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
                borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
                color: 'var(--text-1)', outline: 'none', minWidth: 0,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = color + '55'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                height: '36px', padding: '0 14px', borderRadius: '8px',
                background: color + '20', color, border: `1px solid ${color}40`,
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                opacity: !input.trim() || loading ? 0.4 : 1,
                transition: 'opacity 0.15s', flexShrink: 0,
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

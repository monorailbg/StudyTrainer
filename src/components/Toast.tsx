import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  leaving?: boolean;
}

interface ToastApi {
  toast: (kind: ToastKind, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// ── Per-kind accent + icon ──────────────────────────────────────────────────────

const KIND: Record<ToastKind, { color: string; icon: React.ReactNode }> = {
  success: {
    color: '#2EA043',
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><path d="M5 8.2l2 2L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ),
  },
  error: {
    color: '#F85149',
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ),
  },
  info: {
    color: '#3D7EFF',
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><path d="M8 7.5V11M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ),
  },
};

// ── Single toast (handles its own auto-dismiss) ─────────────────────────────────

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { color, icon } = KIND[item.kind];
  const { ts } = useLang();
  useEffect(() => {
    if (item.message) return;
    const t = setTimeout(() => onDismiss(item.id), 4200);
    return () => clearTimeout(t);
  }, [item.id, item.message, onDismiss]);

  return (
    <div className={`toast${item.leaving ? ' leaving' : ''}`} role="status">
      <span className="toast-accent" style={{ background: color }} />
      <span style={{ color, flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#E6EDF3' }}>{item.title}</div>
        {item.message && (
          <div style={{ fontSize: '12px', color: '#8B949E', marginTop: '2px', lineHeight: 1.45 }}>{item.message}</div>
        )}
        <button
          onClick={() => onDismiss(item.id)}
          aria-label={ts('Dismiss')}
          style={{
            marginTop: '8px', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
            cursor: 'pointer', color: '#8B949E', padding: '3px 8px',
            lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 14 14" width="11" height="11" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  );
}

// ── Provider ────────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  const toast = useCallback((kind: ToastKind, title: string, message?: string) => {
    setItems(prev => [...prev, { id: Date.now() + Math.random(), kind, title, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {items.map(item => (
          <ToastRow key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // No-op fallback so components work outside the provider (e.g. tests)
  return ctx ?? { toast: () => {} };
}

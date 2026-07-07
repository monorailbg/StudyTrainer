import { useLang } from '../context/LanguageContext';

// ── Shared confirm dialog ────────────────────────────────────────────────
//
// For genuinely destructive/discarding actions that need an explicit
// confirmation step — NOT for reversible deletes elsewhere in the app,
// which deliberately use optimistic-delete-with-undo (toast + rollback)
// instead of a blocking confirm. This is for things that can't be undone
// after the fact, like closing a half-built form and losing its content.

export function ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel, danger = true, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { ts } = useLang();
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        className="anim-rise"
        style={{
          width: '100%', maxWidth: '360px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-3)',
          padding: '22px',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '20px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            autoFocus
            style={{
              height: '36px', padding: '0 16px', borderRadius: '999px', cursor: 'pointer',
              background: 'none', color: 'var(--text-2)', border: '1px solid var(--border-light)',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            {cancelLabel ?? ts('Cancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: '36px', padding: '0 16px', borderRadius: '999px', cursor: 'pointer',
              background: danger ? 'var(--danger)' : 'var(--accent-primary)', color: '#fff', border: 'none',
              fontSize: '12px', fontWeight: 700,
            }}
          >
            {confirmLabel ?? ts('Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

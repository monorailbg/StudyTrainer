import { useState } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';

// Small fixed badge that makes the persistence mode unmistakable.
// When Firebase is configured it stays out of the way (a quiet green dot);
// when it's NOT, it shows a loud warning so a misconfigured deploy is
// obvious at a glance instead of silently falling back to local-only.
export function CloudStatusBadge() {
  const [dismissed, setDismissed] = useState(false);
  if (isFirebaseConfigured || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed', bottom: '16px', left: '16px', zIndex: 150,
        display: 'flex', alignItems: 'center', gap: '10px',
        maxWidth: 'min(92vw, 340px)',
        padding: '11px 14px', borderRadius: '12px',
        background: '#2A1E0D', border: '1px solid #D29922',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontSize: '12px', color: '#E6EDF3', lineHeight: 1.45,
      }}
      role="status"
    >
      <span style={{ color: '#D29922', flexShrink: 0, marginTop: '1px' }}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="M8 1.5L15 14H1L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 6.5v3.2M8 12h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: '2px' }}>Local-only mode</div>
        <div style={{ color: '#C9A86A' }}>
          Firebase isn’t configured in this build. Uploads stay on this device and are not shared.
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B7340', padding: '2px', flexShrink: 0, lineHeight: 0 }}
      >
        <svg viewBox="0 0 14 14" width="13" height="13" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

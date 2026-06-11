import { useLang } from '../context/LanguageContext';
import BlindSpotDashboard from '../components/BlindSpotDashboard';

export default function BlindSpots() {
  const { ts } = useLang();
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(24px, 4vw, 48px) clamp(16px, 4vw, 32px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
              <circle cx="10" cy="10" r="8" stroke="#EF4444" strokeWidth="1.4"/>
              <circle cx="10" cy="10" r="3" fill="#EF4444" fillOpacity="0.5"/>
              <circle cx="10" cy="10" r="1.2" fill="#EF4444"/>
              <path d="M10 2V1M10 19v-1M2 10H1M19 10h-1M4.22 4.22l-.71-.71M16.49 16.49l-.71-.71M15.78 4.22l.71-.71M3.51 16.49l.71-.71" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
              {ts('Exam Blind Spot Detection')}
            </h1>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.65, maxWidth: 620 }}>
          {ts('Confidence tracking reveals the gap between what you think you know and what you actually know — the most dangerous knowledge for exams.')}
        </p>
      </div>

      <BlindSpotDashboard />
    </div>
  );
}

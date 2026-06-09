import { useLang } from '../context/LanguageContext';

// ── Flashcard Dashboard ────────────────────────────────────────────────────────

interface FlashcardStats {
  total: number;
  due: number;
  unseen: number;
  known: number;
  newCount: number;
  learning: number;
  graduated: number;
}

const StatCard = ({ icon, label, value, color, subtext, bgGradient }: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
  bgGradient?: string;
}) => (
  <div style={{
    background: bgGradient || `linear-gradient(135deg, ${color}12 0%, ${color}08 100%)`,
    border: `1.5px solid ${color}40`,
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '110px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: `0 8px 24px ${color}08, inset 0 1px 1px ${color}20`,
  }}>
    <div style={{
      position: 'absolute', top: '-45%', right: '-15%', width: '140px', height: '140px',
      borderRadius: '50%', background: color + '04', pointerEvents: 'none',
    }} />
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', fontWeight: 500, letterSpacing: '0.5px' }}>
        {label}
      </div>
    </div>
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color, marginBottom: '2px' }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: '9px', color: color + 'AA', fontWeight: 500 }}>
          {subtext}
        </div>
      )}
    </div>
  </div>
);

export function FlashcardProgressDashboard({ stats, color }: {
  stats: FlashcardStats;
  color: string;
}) {
  const { ts } = useLang();

  const progressPct = stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;
  const reviewsPct = stats.total > 0 ? Math.round((stats.due / stats.total) * 100) : 0;

  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#484F58', marginBottom: '18px' }}>
        ✨ {ts('Your Progress')}
      </div>

      {/* Main stats grid with distinct colors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <StatCard
          icon="📚"
          label={ts('Total Cards')}
          value={stats.total}
          color="#6E9FD4"
          bgGradient="linear-gradient(135deg, #6E9FD412 0%, #6E9FD408 100%)"
        />
        <StatCard
          icon="🔥"
          label={ts('Due Today')}
          value={stats.due}
          color="#FF6B6B"
          subtext={stats.due > 0 ? `${reviewsPct}% of deck` : undefined}
          bgGradient="linear-gradient(135deg, #FF6B6B12 0%, #FF6B6B08 100%)"
        />
        <StatCard
          icon="⭐"
          label={ts('Mastered')}
          value={stats.graduated}
          color="#56D364"
          bgGradient="linear-gradient(135deg, #56D36412 0%, #56D36408 100%)"
        />
        <StatCard
          icon="🎯"
          label={ts('In Progress')}
          value={stats.learning}
          color="#D29922"
          bgGradient="linear-gradient(135deg, #D2992212 0%, #D2992208 100%)"
        />
      </div>

      {/* Progress bar */}
      <div style={{
        background: 'linear-gradient(135deg, #161B2208 0%, #161B2214 100%)',
        border: '1.5px solid #30363D40',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '18px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3' }}>
            {ts('Mastery Progress')}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '18px' }}>📈</span> {progressPct}%
          </span>
        </div>
        <div style={{
          height: '10px', background: '#0D1117', borderRadius: '999px', overflow: 'hidden',
          border: `1px solid #30363D`,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}FF)`,
            borderRadius: '999px', transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: `0 0 20px ${color}40`,
          }} />
        </div>
      </div>

      {/* State breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
        <div style={{
          padding: '14px 12px', background: 'linear-gradient(135deg, #6E9FD408 0%, #6E9FD404 100%)',
          borderRadius: '12px', border: '1.5px solid #6E9FD430', textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '6px', fontWeight: 500 }}>📖 {ts('New')}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#6E9FD4' }}>{stats.newCount}</div>
        </div>
        <div style={{
          padding: '14px 12px', background: 'linear-gradient(135deg, #D2992208 0%, #D2992204 100%)',
          borderRadius: '12px', border: '1.5px solid #D2992230', textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '6px', fontWeight: 500 }}>🔄 {ts('Learning')}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#D29922' }}>{stats.learning}</div>
        </div>
        <div style={{
          padding: '14px 12px', background: 'linear-gradient(135deg, #8B5CF608 0%, #8B5CF604 100%)',
          borderRadius: '12px', border: '1.5px solid #8B5CF630', textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '6px', fontWeight: 500 }}>👁️ {ts('Unseen')}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#8B5CF6' }}>{stats.unseen}</div>
        </div>
      </div>
    </div>
  );
}

// ── Quiz Dashboard ────────────────────────────────────────────────────────────

export interface QuizStats {
  totalAttempts: number;
  totalQuestions: number;
  totalCorrect: number;
  averagePercent: number;
  bestScore: number;
  totalSavedQuizzes: number;
  totalSavedQuestions: number;
}

export function QuizProgressDashboard({ stats, color }: {
  stats: QuizStats;
  color: string;
}) {
  const { ts } = useLang();

  const accuracy = stats.totalQuestions > 0 ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) : 0;
  const hasHistory = stats.totalAttempts > 0;

  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#484F58', marginBottom: '18px' }}>
        🎓 {ts('Quiz Performance')}
      </div>

      {/* Main stats grid with distinct colors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <StatCard
          icon="📋"
          label={ts('Saved Quizzes')}
          value={stats.totalSavedQuizzes}
          color="#7D5BA6"
          subtext={`${stats.totalSavedQuestions} questions`}
          bgGradient="linear-gradient(135deg, #7D5BA612 0%, #7D5BA608 100%)"
        />
        <StatCard
          icon="⚡"
          label={ts('Attempts')}
          value={stats.totalAttempts}
          color="#FF8C42"
          bgGradient="linear-gradient(135deg, #FF8C4212 0%, #FF8C4208 100%)"
        />
        <StatCard
          icon="📊"
          label={ts('Average Score')}
          value={hasHistory ? `${stats.averagePercent}%` : '—'}
          color="#56D364"
          subtext={hasHistory ? `${stats.totalCorrect}/${stats.totalQuestions}` : undefined}
          bgGradient="linear-gradient(135deg, #56D36412 0%, #56D36408 100%)"
        />
        <StatCard
          icon="🏆"
          label={ts('Best Score')}
          value={hasHistory ? `${stats.bestScore}%` : '—'}
          color="#FFD700"
          bgGradient="linear-gradient(135deg, #FFD70012 0%, #FFD70008 100%)"
        />
      </div>

      {/* Accuracy bar */}
      <div style={{
        background: 'linear-gradient(135deg, #161B2208 0%, #161B2214 100%)',
        border: '1.5px solid #30363D40',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '18px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3' }}>
            {ts('Accuracy')}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: hasHistory ? color : '#484F58', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span> {hasHistory ? `${accuracy}%` : ts('No attempts yet')}
          </span>
        </div>
        <div style={{
          height: '10px', background: '#0D1117', borderRadius: '999px', overflow: 'hidden',
          border: `1px solid #30363D`,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            height: '100%', width: `${accuracy}%`,
            background: `linear-gradient(90deg, ${color}, ${color}FF)`,
            borderRadius: '999px', transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: `0 0 20px ${color}40`,
          }} />
        </div>
      </div>

      {/* Breakdown — only if there's history */}
      {hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div style={{
            padding: '14px 12px', background: 'linear-gradient(135deg, #56D36408 0%, #56D36404 100%)',
            borderRadius: '12px', border: '1.5px solid #56D36430', textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '6px', fontWeight: 500 }}>✅ {ts('Correct')}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#56D364' }}>{stats.totalCorrect}</div>
          </div>
          <div style={{
            padding: '14px 12px', background: 'linear-gradient(135deg, #FF6B6B08 0%, #FF6B6B04 100%)',
            borderRadius: '12px', border: '1.5px solid #FF6B6B30', textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '6px', fontWeight: 500 }}>📝 {ts('Answered')}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#FF6B6B' }}>{stats.totalQuestions}</div>
          </div>
        </div>
      )}
    </div>
  );
}

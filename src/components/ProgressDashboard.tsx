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

export function FlashcardProgressDashboard({ stats, color }: {
  stats: FlashcardStats;
  color: string;
}) {
  const { ts } = useLang();

  const progressPct = stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;
  const reviewsPct = stats.total > 0 ? Math.round((stats.due / stats.total) * 100) : 0;

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '14px' }}>
        {ts('Your Progress')}
      </div>

      {/* Main stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {/* Total Cards */}
        <div style={{
          background: '#161B22', border: '1px solid #21262D', borderRadius: '12px',
          padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '100px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: '120px', height: '120px',
            borderRadius: '50%', background: color + '08', pointerEvents: 'none',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
              {ts('Total Cards')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#E6EDF3', position: 'relative', zIndex: 1 }}>
              {stats.total}
            </div>
          </div>
        </div>

        {/* Due for Review */}
        <div style={{
          background: '#161B22', border: `1px solid ${color}30`, borderRadius: '12px',
          padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '100px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: '120px', height: '120px',
            borderRadius: '50%', background: color + '08', pointerEvents: 'none',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
              {ts('Due Today')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color, position: 'relative', zIndex: 1 }}>
              {stats.due}
            </div>
          </div>
          {stats.due > 0 && (
            <div style={{ fontSize: '9px', color: color + 'BB', marginTop: '6px', position: 'relative', zIndex: 1 }}>
              {reviewsPct}% of deck
            </div>
          )}
        </div>

        {/* Graduated */}
        <div style={{
          background: '#161B22', border: '1px solid #21262D', borderRadius: '12px',
          padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '100px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: '120px', height: '120px',
            borderRadius: '50%', background: '#56D36408', pointerEvents: 'none',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
              {ts('Mastered')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#56D364', position: 'relative', zIndex: 1 }}>
              {stats.graduated}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        background: '#161B22', border: '1px solid #21262D', borderRadius: '12px',
        padding: '14px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#E6EDF3' }}>
              {ts('Mastery Progress')}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color }}>
              {progressPct}%
            </span>
          </div>
          <div style={{
            height: '8px', background: '#0D1117', borderRadius: '999px', overflow: 'hidden',
            border: `1px solid #30363D`,
          }}>
            <div style={{
              height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${color}, ${color}DD)`,
              borderRadius: '999px', transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>

      {/* State breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginTop: '14px' }}>
        <div style={{ padding: '10px 12px', background: '#0D1117', borderRadius: '10px', border: '1px solid #21262D', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '4px' }}>{ts('Learning')}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#D29922' }}>{stats.learning}</div>
        </div>
        <div style={{ padding: '10px 12px', background: '#0D1117', borderRadius: '10px', border: '1px solid #21262D', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '4px' }}>{ts('New')}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#6E9FD4' }}>{stats.newCount}</div>
        </div>
        <div style={{ padding: '10px 12px', background: '#0D1117', borderRadius: '10px', border: '1px solid #21262D', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '4px' }}>{ts('Unseen')}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#8B949E' }}>{stats.unseen}</div>
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
    <div style={{ marginBottom: '32px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '14px' }}>
        {ts('Quiz Performance')}
      </div>

      {/* Main stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {/* Saved Quizzes */}
        <div style={{
          background: '#161B22', border: '1px solid #21262D', borderRadius: '12px',
          padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '100px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: '120px', height: '120px',
            borderRadius: '50%', background: color + '08', pointerEvents: 'none',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
              {ts('Saved Quizzes')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#E6EDF3', position: 'relative', zIndex: 1 }}>
              {stats.totalSavedQuizzes}
            </div>
          </div>
          <div style={{ fontSize: '9px', color: '#484F58', position: 'relative', zIndex: 1 }}>
            {stats.totalSavedQuestions} {ts('questions total')}
          </div>
        </div>

        {/* Attempts */}
        <div style={{
          background: '#161B22', border: `1px solid ${color}30`, borderRadius: '12px',
          padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '100px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: '120px', height: '120px',
            borderRadius: '50%', background: color + '08', pointerEvents: 'none',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
              {ts('Attempts')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color, position: 'relative', zIndex: 1 }}>
              {stats.totalAttempts}
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div style={{
          background: '#161B22', border: '1px solid #21262D', borderRadius: '12px',
          padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '100px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: '120px', height: '120px',
            borderRadius: '50%', background: hasHistory ? '#56D36408' : color + '08', pointerEvents: 'none',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
              {ts('Average')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: hasHistory ? '#56D364' : '#484F58', position: 'relative', zIndex: 1 }}>
              {hasHistory ? `${stats.averagePercent}%` : '—'}
            </div>
          </div>
        </div>

        {/* Best Score */}
        <div style={{
          background: '#161B22', border: '1px solid #21262D', borderRadius: '12px',
          padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '100px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: '120px', height: '120px',
            borderRadius: '50%', background: hasHistory ? '#56D36408' : '#30363D08', pointerEvents: 'none',
          }} />
          <div>
            <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
              {ts('Best Score')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: hasHistory ? '#56D364' : '#484F58', position: 'relative', zIndex: 1 }}>
              {hasHistory ? `${stats.bestScore}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy bar */}
      <div style={{
        background: '#161B22', border: '1px solid #21262D', borderRadius: '12px',
        padding: '14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#E6EDF3' }}>
            {ts('Accuracy')}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: hasHistory ? color : '#484F58' }}>
            {hasHistory ? `${accuracy}%` : ts('No attempts yet')}
          </span>
        </div>
        <div style={{
          height: '8px', background: '#0D1117', borderRadius: '999px', overflow: 'hidden',
          border: `1px solid #30363D`,
        }}>
          <div style={{
            height: '100%', width: `${accuracy}%`, background: `linear-gradient(90deg, ${color}, ${color}DD)`,
            borderRadius: '999px', transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Breakdown — only if there's history */}
      {hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginTop: '14px' }}>
          <div style={{ padding: '10px 12px', background: '#0D1117', borderRadius: '10px', border: '1px solid #21262D', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '4px' }}>{ts('Correct')}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#56D364' }}>{stats.totalCorrect}</div>
          </div>
          <div style={{ padding: '10px 12px', background: '#0D1117', borderRadius: '10px', border: '1px solid #21262D', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '4px' }}>{ts('Answered')}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#8B949E' }}>{stats.totalQuestions}</div>
          </div>
        </div>
      )}
    </div>
  );
}

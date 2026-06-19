import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useResolvedSubjects } from '../store/useSubjects';
import { useBlindSpots } from '../store/useBlindSpots';
import type { SubjectBlindSpot, ReviewQueueItem } from '../lib/blindSpot';

// ── Helpers ────────────────────────────────────────────────────────────────────

function riskColor(score: number): string {
  if (score >= 65) return '#EF4444';
  if (score >= 35) return '#F59E0B';
  return '#10B981';
}

function riskLabel(score: number): string {
  if (score >= 65) return 'High Risk';
  if (score >= 35) return 'Moderate';
  return 'Low Risk';
}

function calibrationLabel(score: number): string {
  if (score >= 75) return 'Well calibrated';
  if (score >= 50) return 'Moderate';
  return 'Poorly calibrated';
}

function confidenceLabel(c: number): string {
  if (c >= 4.5) return '5';
  if (c >= 3.5) return '4';
  if (c >= 2.5) return '3';
  if (c >= 1.5) return '2';
  return '1';
}

function reasonBadge(reason: ReviewQueueItem['reason'], ts: (s: string) => string) {
  const map = {
    blind_spot:           { label: ts('Blind Spot'), color: '#EF4444' },
    high_confidence_wrong: { label: ts('High Conf + Wrong'), color: '#F59E0B' },
    repeated_wrong:       { label: ts('Repeated Wrong'), color: '#8B5CF6' },
  };
  const { label, color } = map[reason];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 999, background: color + '1A', color, border: `1px solid ${color}33`,
    }}>
      {label}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14,
      background: `radial-gradient(120% 120% at 100% 0%, ${color}0E 0%, var(--bg-surface) 55%)`,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-2)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── Risk gauge ─────────────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const color = riskColor(score);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ height: 4, background: 'var(--border-base)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 999, transition: 'width 0.6s cubic-bezier(0,0,0.2,1)' }} />
      </div>
      <div style={{ fontSize: 10, color, fontWeight: 700 }}>{riskLabel(score)} · {score}</div>
    </div>
  );
}

// ── Subject row ────────────────────────────────────────────────────────────────

function SubjectRow({ spot, ts }: { spot: SubjectBlindSpot; ts: (s: string) => string }) {
  const rc = riskColor(spot.examRiskScore);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 100px 90px',
      alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
      background: spot.isBlindSpot ? '#EF44440A' : 'var(--bg-elevated)',
      border: `1px solid ${spot.isBlindSpot ? '#EF444422' : 'var(--border-light)'}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {spot.subjectTitle}
          {spot.isBlindSpot && (
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#EF4444', background: '#EF44441A', padding: '1px 6px', borderRadius: 999, border: '1px solid #EF444433' }}>
              {ts('Blind Spot')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{spot.totalRated} {ts('rated')}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: spot.accuracy >= 70 ? '#10B981' : spot.accuracy >= 50 ? '#F59E0B' : '#EF4444' }}>{spot.accuracy}%</div>
        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{ts('Accuracy')}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>{spot.avgConfidence}/5</div>
        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{ts('Avg Conf')}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: spot.calibrationScore >= 65 ? '#10B981' : spot.calibrationScore >= 40 ? '#F59E0B' : '#EF4444' }}>
          {spot.calibrationScore}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{ts('Calibration')}</div>
      </div>
      <RiskGauge score={spot.examRiskScore} />
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: rc }}>{spot.overconfidenceIndex}%</div>
        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{ts('Overconf')}</div>
      </div>
    </div>
  );
}

// ── Review queue item ──────────────────────────────────────────────────────────

function QueueCard({ item, ts }: { item: ReviewQueueItem; ts: (s: string) => string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)',
      border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.4, flex: 1 }}>
          {item.questionText.length > 90 ? item.questionText.slice(0, 90) + '…' : item.questionText}
        </div>
        {reasonBadge(item.reason, ts)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.quizTitle}</span>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>·</span>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {ts('Last conf')}: <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{confidenceLabel(item.lastConfidence)}/5</span>
        </span>
        {item.timesHighConfWrong > 0 && (
          <>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>·</span>
            <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>
              {item.timesHighConfWrong}× {ts('high-conf wrong')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ ts }: { ts: (s: string) => string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(61,126,255,0.1)', border: '1px solid rgba(61,126,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#3D7EFF" strokeWidth="1.5"/>
          <path d="M12 8v4l3 3" stroke="#3D7EFF" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M7.5 5.5L5 3M16.5 5.5L19 3M12 3V1" stroke="#3D7EFF" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', fontFamily: "'Sora',sans-serif", marginBottom: 8 }}>
          {ts('No confidence data yet')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 340, lineHeight: 1.6 }}>
          {ts('Take a quiz in Focused Mode and rate your confidence before each answer. Your blind spots will appear here.')}
        </div>
      </div>
      <Link
        to="/quiz"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 20px', borderRadius: 999,
          background: 'rgba(61,126,255,0.12)', color: '#3D7EFF',
          border: '1px solid rgba(61,126,255,0.3)',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
          transition: 'all 0.15s',
        }}
      >
        {ts('Start a Quiz')} →
      </Link>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BlindSpotDashboard() {
  const { ts } = useLang();
  const { allSubjects } = useResolvedSubjects();
  const { loaded, records, subjectBlindSpots, reviewQueue, overallStats, load } = useBlindSpots();

  useEffect(() => {
    const titles: Record<string, string> = {};
    for (const s of allSubjects) titles[s.id] = s.title;
    load(titles);
  }, [allSubjects.map(s => s.id).join(',')]);

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-3)', fontSize: 13 }}>
        {ts('Analysing quiz history…')}
      </div>
    );
  }

  if (records.length === 0) {
    return <EmptyState ts={ts} />;
  }

  const { overallCalibration, overallAccuracy, overallExamRisk, overconfidenceIndex, totalBlindSpots, totalRated } = overallStats;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Overview stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label={ts('Questions Rated')} value={totalRated} color="#3D7EFF" />
        <StatCard label={ts('Calibration Score')} value={overallCalibration} sub={calibrationLabel(overallCalibration)} color={overallCalibration >= 65 ? '#10B981' : overallCalibration >= 40 ? '#F59E0B' : '#EF4444'} />
        <StatCard label={ts('Exam Risk Score')} value={overallExamRisk} sub={riskLabel(overallExamRisk)} color={riskColor(overallExamRisk)} />
        <StatCard label={ts('Overconfidence')} value={`${overconfidenceIndex}%`} sub={ts('of high-conf wrong')} color={overconfidenceIndex >= 40 ? '#EF4444' : overconfidenceIndex >= 20 ? '#F59E0B' : '#10B981'} />
        <StatCard label={ts('Accuracy')} value={`${overallAccuracy}%`} color="#10B981" />
        <StatCard label={ts('Blind Spots')} value={totalBlindSpots} sub={ts('subjects flagged')} color={totalBlindSpots > 0 ? '#EF4444' : '#10B981'} />
      </div>

      {/* Explanation callout */}
      <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(61,126,255,0.06)', border: '1px solid rgba(61,126,255,0.18)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>
        <strong style={{ color: 'var(--text-1)' }}>{ts('How scores work')}: </strong>
        {ts('Calibration (0–100) measures how well your confidence predicts correctness. Exam Risk combines overconfidence rate, calibration gap and raw accuracy. A Blind Spot is a subject where you\'re highly confident (≥3.5/5) yet scoring below 55%.')}
      </div>

      {/* Per-subject breakdown */}
      {subjectBlindSpots.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 12 }}>
            {ts('Subject Breakdown')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 100px 90px', gap: 12, padding: '0 14px', marginBottom: 8 }}>
            {['Subject', 'Accuracy', 'Conf', 'Calib.', 'Exam Risk', 'Overconf.'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', textAlign: h !== 'Subject' ? 'right' : 'left' }}>
                {ts(h)}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subjectBlindSpots.map(s => <SubjectRow key={s.subjectId} spot={s} ts={ts} />)}
          </div>
        </div>
      )}

      {/* Adaptive review queue */}
      {reviewQueue.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 12 }}>
            {ts('Adaptive Review Queue')} · <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 10 }}>{ts('Highest-priority questions to study')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reviewQueue.slice(0, 10).map(item => <QueueCard key={item.questionId} item={item} ts={ts} />)}
          </div>
          {reviewQueue.length > 10 && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
              + {reviewQueue.length - 10} {ts('more in queue')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

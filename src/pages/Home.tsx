import { useRef, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useStore } from '../store/useStore';
import { useResolvedSubjects } from '../store/useSubjects';
import { useSRS, subjectSrsStats } from '../store/useSRS';
import { useExamDates } from '../store/useExamDates';
import type { SubjectDef } from '../data/subjects';
import flashcardsData from '../data/flashcards.json';
import quizData from '../data/quiz.json';
import notesData from '../data/notes-config.json';
import { getAllFlashcardSets, getAllNotes, type StoredFlashcardSet, type StoredNote } from '../lib/db';
import { isFirebaseConfigured, getAllCloudFlashcardSets, getAllCloudNotes } from '../lib/cloudDb';
import GlobeView from '../components/GlobeView';
import MindMap from '../components/MindMap';
import { ManageSubjects } from '../components/ManageSubjects';
import { SubjectIcon } from '../data/subjectIcons';

// ── Per-subject progress ───────────────────────────────────────────────────────

interface SubjectStats {
  notesTotal: number; notesRead: number;
  cardsTotal: number; cardsKnown: number; cardsDue: number;
}

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Greeting ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  return 'Good evening.';
}

// ── Tilt card ──────────────────────────────────────────────────────────────────

function TiltCard({ children, className, style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 9;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -7;
    el.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg) translateY(-6px) scale(1.01)`;
    el.style.boxShadow = '0 1px 0 rgba(255,255,255,0.09) inset,0 12px 32px rgba(0,0,0,0.55),0 28px 60px rgba(0,0,0,0.38),0 0 0 1px rgba(61,126,255,0.3)';
    el.style.borderColor = 'rgba(61,126,255,0.4)';
  }

  function onLeave() {
    const el = ref.current; if (!el) return;
    el.style.transform = '';
    el.style.boxShadow = '';
    el.style.borderColor = '';
  }

  return (
    <div ref={ref} className={className} style={{ ...style, transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.45s cubic-bezier(0.34,1.56,0.64,1),border-color 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}
      onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────────────

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 64, h = 18;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - ((p - min) / range) * h]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}

// ── Stat strip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, progress, color = '#3D7EFF', icon, spark, index = 0 }: {
  label: string; value: string | number; progress?: number; color?: string;
  icon?: React.ReactNode; spark?: number[]; index?: number;
}) {
  return (
    <div
      className="card-panel anim-rise"
      style={{
        ['--d' as string]: `${index * 60}ms`,
        padding: '16px 18px',
        background: `radial-gradient(120% 120% at 100% 0%, ${color}0E 0%, #161B22 55%)`,
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-[9px] font-semibold uppercase tracking-[0.13em]" style={{ color: '#8B949E' }}>
          {label}
        </div>
        {icon && (
          <span style={{ color, width: '26px', height: '26px', borderRadius: '8px', background: color + '18', border: `1px solid ${color}2A`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="mono text-2xl leading-none" style={{ color: '#E6EDF3' }}>{value}</div>
        {spark && spark.length >= 2 && <Sparkline points={spark} color={color} />}
      </div>
      {progress !== undefined && (
        <div className="mt-2.5 overflow-hidden" style={{ height: '3px', background: '#30363D', borderRadius: '2px' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 1s cubic-bezier(0,0,0.2,1)' }} />
        </div>
      )}
    </div>
  );
}

// ── Subject card ───────────────────────────────────────────────────────────────

function ProgressRow({ label, read, total, color, delay, mounted }: {
  label: string; read: number; total: number; color: string; delay: number; mounted: boolean;
}) {
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] flex-shrink-0" style={{ color: '#8B949E', width: '34px' }}>{label}</span>
      <div className="flex-1 overflow-hidden" style={{ height: '4px', background: '#0D1117', borderRadius: '999px' }}>
        <div style={{
          height: '100%', width: mounted && total > 0 ? `${pct}%` : '0%',
          background: color, borderRadius: '999px',
          transition: `width 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        }} />
      </div>
      <span className="text-[10px] font-semibold flex-shrink-0 mono" style={{ color: total > 0 ? color : '#484F58', minWidth: '40px', textAlign: 'right' }}>
        {total > 0 ? `${read} / ${total}` : '—'}
      </span>
    </div>
  );
}

function SubjectCard({ subject, isCore, index = 0, stats }: { subject: SubjectDef; isCore: boolean; index?: number; stats?: SubjectStats }) {
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = setTimeout(() => setMounted(true), 60); return () => clearTimeout(id); }, []);

  const fcCount = isCore && subject.flashcardTopic
    ? flashcardsData.filter(f => f.topic === subject.flashcardTopic).length : 0;
  const qCount  = isCore && subject.quizTopic
    ? quizData.filter(q => q.topic === subject.quizTopic).length : 0;

  const hasProgress = stats && (stats.notesTotal > 0 || stats.cardsTotal > 0);
  const due = stats?.cardsDue ?? 0;
  const barDelay = index * 60;

  return (
    <Link to={`/subject/${subject.id}`} className="no-underline block h-full anim-rise" style={{ ['--d' as string]: `${index * 50}ms`, position: 'relative' }}>
      {/* Due-for-review badge — overlaps the top-right corner */}
      {due > 0 && (
        <span style={{
          position: 'absolute', top: '-7px', right: '-6px', zIndex: 3,
          padding: '2px 9px', borderRadius: '999px',
          background: 'linear-gradient(135deg, #F85149, #d2391f)', color: '#fff',
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em',
          boxShadow: '0 4px 12px rgba(248,81,73,0.45)', whiteSpace: 'nowrap',
        }}>
          {due} due
        </span>
      )}
      <TiltCard className="card-panel h-full" style={{ minHeight: '160px' }}>
        <div className="p-5 flex flex-col h-full gap-3">
          {/* Icon + color accent */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5"
              style={{ background: subject.color + '20', border: `1px solid ${subject.color}30` }}>
              <SubjectIcon id={subject.id} icon={subject.icon} color={subject.color} />
            </div>
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: subject.color, boxShadow: `0 0 6px ${subject.color}` }} />
          </div>

          {/* Text */}
          <div className="flex-1">
            <div className="text-sm font-semibold leading-snug mb-1" style={{ fontFamily: "'Sora',sans-serif", color: '#E6EDF3' }}>
              {subject.title}
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: '#8B949E' }}>
              {subject.description}
            </div>
          </div>

          {/* Progress bars — notes read + cards known */}
          {hasProgress && (
            <div className="flex flex-col gap-1.5">
              <ProgressRow label="Notes" read={stats!.notesRead} total={stats!.notesTotal} color={subject.color} delay={barDelay} mounted={mounted} />
              <ProgressRow label="Cards" read={stats!.cardsKnown} total={stats!.cardsTotal} color="#2EA043" delay={barDelay + 120} mounted={mounted} />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            {isCore && fcCount > 0 ? (
              <div className="flex gap-1.5 flex-wrap">
                {fcCount > 0 && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: subject.color + '18', color: subject.color, border: `1px solid ${subject.color}30` }}>
                    {fcCount} {t('cards')}
                  </span>
                )}
                {qCount > 0 && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: subject.color + '18', color: subject.color, border: `1px solid ${subject.color}30` }}>
                    {qCount} Q
                  </span>
                )}
              </div>
            ) : subject.levels ? (
              <div className="flex gap-1 flex-wrap">
                {subject.levels.map(l => (
                  <span key={l} className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: subject.color + '15', color: subject.color, border: `1px solid ${subject.color}25` }}>
                    {l}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[10px] font-semibold" style={{ color: subject.color }}>Explore →</span>
            )}
          </div>
        </div>
      </TiltCard>
    </Link>
  );
}

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: '#8B949E' }}>
        {children}
      </span>
      {count !== undefined && (
        <span className="mono text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: '#1F2937', color: '#8B949E', border: '1px solid #30363D' }}>
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: '#30363D' }} />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const { t } = useLang();
  const { flashcardsStudied, flashcardsKnown, quizScores, notesRead, recentSubjects, removeRecentSubject } = useStore();
  const { allSubjects, coreSubjects, extendedSubjects } = useResolvedSubjects();
  const [managing, setManaging] = useState(false);
  const [heroView, setHeroView] = useState<'globe' | 'mindmap'>('globe');
  const { dates: examDates } = useExamDates();
  // Force the globe to rebuild when the set of subjects changes.
  const globeKey = allSubjects.map(s => s.id).join(',');

  // Generated content across subjects — drives the per-subject progress bars,
  // due badges and the global due count.
  const [sets, setSets] = useState<StoredFlashcardSet[]>([]);
  const [notesList, setNotesList] = useState<StoredNote[]>([]);
  const srsCards = useSRS(s => s.cards);

  useEffect(() => {
    (isFirebaseConfigured ? getAllCloudFlashcardSets() : getAllFlashcardSets())
      .then(d => setSets(d as StoredFlashcardSet[])).catch(() => {});
    (isFirebaseConfigured ? getAllCloudNotes() : getAllNotes())
      .then(d => setNotesList(d as StoredNote[])).catch(() => {});
  }, []);

  const statsBySubject = useMemo(() => {
    const map: Record<string, SubjectStats> = {};
    const ensure = (id: string) => map[id] ?? (map[id] = { notesTotal: 0, notesRead: 0, cardsTotal: 0, cardsKnown: 0, cardsDue: 0 });
    for (const n of notesList) {
      const m = ensure(n.subjectId);
      m.notesTotal++;
      if (notesRead.includes(n.id)) m.notesRead++;
    }
    const idsBySubject: Record<string, string[]> = {};
    for (const set of sets) {
      const arr = idsBySubject[set.subjectId] ?? (idsBySubject[set.subjectId] = []);
      for (const c of set.cards) arr.push(c.id);
    }
    for (const [sid, ids] of Object.entries(idsBySubject)) {
      const m = ensure(sid);
      const st = subjectSrsStats(srsCards, ids);
      m.cardsTotal = st.total; m.cardsKnown = st.known; m.cardsDue = st.due;
    }
    return map;
  }, [notesList, sets, notesRead, srsCards]);

  const dueEntries = Object.entries(statsBySubject).filter(([, m]) => m.cardsDue > 0);
  const totalDue = dueEntries.reduce((a, [, m]) => a + m.cardsDue, 0);

  const totalCards = flashcardsData.length;
  const totalNotes = notesData.length;
  const avgScore   = quizScores.length > 0
    ? Math.round(quizScores.reduce((a, b) => a + (b.score / b.total) * 100, 0) / quizScores.length)
    : 0;
  const knownPct = totalCards > 0 ? Math.round((flashcardsKnown.length / totalCards) * 100) : 0;
  const notesPct = totalNotes > 0 ? Math.round((notesRead.length   / totalNotes) * 100) : 0;

  return (
    <div style={{ background: '#0D1117' }}>

      {/* ── GLOBE HERO ─────────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          height: 'calc(82vh - 38px)',
          minHeight: '520px',
          overflow: 'hidden',
        }}
      >
        {/* Globe / mind map canvas */}
        {heroView === 'globe'
          ? <GlobeView key={globeKey} subjects={allSubjects} />
          : <MindMap />}

        {/* View toggle — top right */}
        <div style={{
          position: 'absolute', top: 'clamp(16px, 4vw, 32px)', right: 'clamp(16px, 4vw, 32px)',
          zIndex: 11, display: 'flex', gap: '3px', padding: '3px',
          background: 'rgba(22,27,34,0.82)', border: '1px solid #30363D', borderRadius: '12px',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        }}>
          {([['globe', 'Globe'], ['mindmap', 'Mind Map']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setHeroView(key)}
              style={{
                height: '30px', padding: '0 12px', borderRadius: '9px', cursor: 'pointer', border: 'none',
                fontSize: '12px', fontWeight: 600, fontFamily: "'Inter',sans-serif",
                background: heroView === key ? 'rgba(61,126,255,0.18)' : 'transparent',
                color: heroView === key ? '#93B8FF' : '#8B949E',
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Title overlay — top left (globe only; the mind map has its own search here) */}
        {heroView === 'globe' && (
        <div
          style={{
            position: 'absolute',
            top: 'clamp(16px, 4vw, 32px)',
            left: 'clamp(16px, 4vw, 32px)',
            zIndex: 10,
            pointerEvents: 'none',
            maxWidth: 'min(55vw, 400px)',
          }}
        >
          <div style={{
            fontFamily: "'Inter',sans-serif",
            fontWeight: 600,
            fontSize: '9px',
            color: '#3D7EFF',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Global Business Studies
          </div>
          <h1 style={{
            fontFamily: "'Sora',sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1.9rem,3.5vw,2.8rem)',
            color: '#E6EDF3',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            margin: 0,
          }}>
            {getGreeting()}
          </h1>
          <p style={{
            fontFamily: "'Inter',sans-serif",
            fontSize: '13px',
            color: '#8B949E',
            margin: '8px 0 0',
            lineHeight: 1.5,
          }}>
            Click a subject on the globe to dive in.
          </p>
        </div>
        )}

        {/* Scroll hint */}
        {heroView === 'globe' && (
        <div style={{
          position: 'absolute',
          bottom: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}>
          <div style={{ fontSize: '9px', color: '#484F58', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            Scroll
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}>
            <path d="M2 4l4 4 4-4" stroke="#8B949E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        )}

        {/* Bottom gradient — blends into content */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '100px',
          background: 'linear-gradient(to bottom, transparent, #0D1117)',
          zIndex: 5,
          pointerEvents: 'none',
        }} />
      </section>

      {/* ── CONTENT — starts in the lower third ────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-16 md:pb-20" style={{ position: 'relative', zIndex: 10 }}>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <StatChip index={0} label={t('stats_studied')} value={flashcardsStudied.length} color="#3D7EFF"
            icon={<svg viewBox="0 0 16 16" width="13" height="13" fill="none"><rect x="1.5" y="4.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="4" y="2.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>} />
          <StatChip index={1} label={t('stats_known')}   value={flashcardsKnown.length}   progress={knownPct} color="#3D7EFF"
            icon={<svg viewBox="0 0 16 16" width="13" height="13" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M5.5 8.2l1.8 1.8L11 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
          <StatChip index={2} label={t('stats_score')}   value={avgScore > 0 ? `${avgScore}%` : '—'} progress={avgScore || undefined} color="#D29922"
            spark={quizScores.map(q => Math.round((q.score / q.total) * 100))}
            icon={<svg viewBox="0 0 16 16" width="13" height="13" fill="none"><polyline points="2,11 6,7 9,9 14,4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
          <StatChip index={3} label={t('stats_notes')}   value={notesRead.length}         progress={notesPct} color="#2EA043"
            icon={<svg viewBox="0 0 16 16" width="13" height="13" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>} />
        </div>

        {/* Global due-for-review line */}
        {totalDue > 0 && (
          <Link
            to="/flashcards"
            className="no-underline flex items-center gap-2.5 anim-fadein"
            style={{
              marginTop: '-24px', marginBottom: '28px', padding: '10px 14px', borderRadius: '12px',
              background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.22)', width: 'fit-content',
              transition: 'border-color 0.2s ease, background 0.2s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,81,73,0.5)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,81,73,0.22)'; }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F85149', boxShadow: '0 0 8px #F85149', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#E6EDF3' }}>
              You have <strong style={{ color: '#F97979' }}>{totalDue} card{totalDue !== 1 ? 's' : ''}</strong> due for review across {dueEntries.length} subject{dueEntries.length !== 1 ? 's' : ''}.
            </span>
            <span style={{ fontSize: '12px', color: '#F97979', fontWeight: 600 }}>Review →</span>
          </Link>
        )}

        {/* Upcoming Exams */}
        {examDates.length > 0 && (() => {
          const upcoming = examDates
            .map(d => ({ ...d, subject: allSubjects.find(s => s.id === d.subjectId) }))
            .filter(d => d.subject)
            .sort((a, b) => a.date.localeCompare(b.date));
          if (upcoming.length === 0) return null;
          return (
            <div className="mb-10">
              <SectionLabel>Upcoming Exams</SectionLabel>
              <div className="flex gap-3 flex-wrap">
                {upcoming.map((d, i) => {
                  const diff = Math.ceil((new Date(d.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const color = d.subject!.color;
                  return (
                    <Link
                      key={d.subjectId}
                      to={`/subject/${d.subjectId}`}
                      className="no-underline anim-rise"
                      style={{
                        ['--d' as string]: `${i * 50}ms`,
                        display: 'flex', alignItems: 'center', gap: '11px',
                        padding: '11px 16px', borderRadius: '14px',
                        background: '#161B22', border: `1px solid ${color}30`,
                        transition: 'transform 0.2s ease, border-color 0.2s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = color + '60'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = color + '30'; }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3' }}>{d.subject!.title}</div>
                        <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '2px' }}>
                          {d.date.replace(/-/g, '/')} · <span style={{ color, fontWeight: 600 }}>{diff > 0 ? `${diff} days left` : diff === 0 ? 'Today' : `${-diff} days ago`}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Continue where you left off */}
        {recentSubjects.length > 0 && (() => {
          const recents = recentSubjects
            .map(r => allSubjects.find(s => s.id === r.id))
            .filter((s): s is SubjectDef => Boolean(s))
            .slice(0, 5);
          if (recents.length === 0) return null;
          return (
            <div className="mb-10">
              <SectionLabel>Continue where you left off</SectionLabel>
              <div className="flex gap-3 flex-wrap">
                {recents.map((s, i) => {
                  return (
                    <Link
                      key={s.id}
                      to={`/subject/${s.id}`}
                      className="no-underline anim-rise group"
                      style={{
                        ['--d' as string]: `${i * 50}ms`,
                        position: 'relative',
                        display: 'flex', alignItems: 'center', gap: '11px',
                        padding: '11px 30px 11px 12px', borderRadius: '14px',
                        background: '#161B22', border: '1px solid #21262D',
                        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = s.color + '45'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
                    >
                      <span className="[&>svg]:w-[18px] [&>svg]:h-[18px]" style={{ width: '36px', height: '36px', borderRadius: '11px', background: s.color + '1F', border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <SubjectIcon id={s.id} icon={s.icon} color={s.color} />
                      </span>
                      <div className="min-w-0">
                        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '13px', fontWeight: 600, color: '#E6EDF3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                          {s.title}
                        </div>
                        <div style={{ fontSize: '11px', color: s.color, fontWeight: 600 }}>Resume →</div>
                      </div>
                      {/* Remove from recents */}
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); removeRecentSubject(s.id); }}
                        aria-label={`Remove ${s.title} from recents`}
                        title="Remove"
                        style={{
                          position: 'absolute', top: '7px', right: '7px',
                          width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid #30363D', color: '#8B949E',
                          transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                        }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(248,81,73,0.16)'; el.style.color = '#F97979'; el.style.borderColor = 'rgba(248,81,73,0.45)'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = '#8B949E'; el.style.borderColor = '#30363D'; }}
                      >
                        <svg viewBox="0 0 12 12" width="9" height="9" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Study modes — three pill links */}
        <div className="flex gap-3 mb-10 flex-wrap">
          {[
            { to: '/flashcards', label: t('nav_flashcards'), color: '#3D7EFF', stat: `${totalCards} cards` },
            { to: '/notes',      label: t('nav_notes'),      color: '#2EA043', stat: `${totalNotes} notes` },
            { to: '/quiz',       label: t('nav_quiz'),       color: '#D29922', stat: `${quizData.length} questions` },
            { to: '/generate',   label: t('nav_generate'),   color: '#a78bfa', stat: 'AI powered' },
          ].map(({ to, label, color, stat }) => (
            <Link
              key={to}
              to={to}
              className="no-underline flex items-center gap-2.5 px-4 h-10 text-sm font-semibold transition-all duration-400"
              style={{
                borderRadius: '999px',
                background: color + '18',
                color,
                border: `1px solid ${color}35`,
                transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px ${color}33`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = '';
                (e.currentTarget as HTMLElement).style.boxShadow = '';
              }}
            >
              {label}
              <span style={{ fontWeight: 400, fontSize: '11px', color: color + 'CC', opacity: 0.8 }}>{stat}</span>
            </Link>
          ))}
        </div>

        {/* Core subjects */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: '#8B949E' }}>
                {t('core_subjects')}
              </span>
              <span className="mono text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: '#1F2937', color: '#8B949E', border: '1px solid #30363D' }}>
                {coreSubjects.length}
              </span>
              <div className="flex-1 h-px" style={{ background: '#30363D' }} />
            </div>
            <button
              onClick={() => setManaging(true)}
              className="flex items-center gap-1.5 ml-3 h-8 px-3.5 text-xs font-semibold cursor-pointer transition-all duration-300"
              style={{ borderRadius: '999px', background: '#3D7EFF18', color: '#3D7EFF', border: '1px solid #3D7EFF35' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px #3D7EFF33'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              Manage
            </button>
          </div>
          {coreSubjects.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {coreSubjects.map((s, i) => <SubjectCard key={s.id} subject={s} isCore={true} index={i} stats={statsBySubject[s.id]} />)}
            </div>
          ) : (
            <div className="text-xs" style={{ color: '#8B949E' }}>
              No core subjects. Star one in <button onClick={() => setManaging(true)} className="underline cursor-pointer bg-transparent border-none p-0" style={{ color: '#3D7EFF' }}>Manage</button>.
            </div>
          )}
        </div>

        {/* Extended curriculum */}
        {extendedSubjects.length > 0 && (
          <div>
            <SectionLabel count={extendedSubjects.length}>{t('extended')}</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {extendedSubjects.map((s, i) => <SubjectCard key={s.id} subject={s} isCore={false} index={i} stats={statsBySubject[s.id]} />)}
            </div>
          </div>
        )}

      </div>

      {managing && <ManageSubjects onClose={() => setManaging(false)} />}
    </div>
  );
}

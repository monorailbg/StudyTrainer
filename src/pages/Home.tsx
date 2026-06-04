import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useStore } from '../store/useStore';
import { useResolvedSubjects } from '../store/useSubjects';
import type { SubjectDef } from '../data/subjects';
import flashcardsData from '../data/flashcards.json';
import quizData from '../data/quiz.json';
import notesData from '../data/notes-config.json';
import GlobeView from '../components/GlobeView';
import { ManageSubjects } from '../components/ManageSubjects';

// ── Icons ──────────────────────────────────────────────────────────────────────

const IconGlobe  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="1.5"/><path d="M3 12h18M3 8h18M3 16h18" stroke={color} strokeWidth="1.2" opacity=".5"/></svg>);
const IconChart  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="3" y="12" width="4" height="9" rx="1" fill={color} opacity=".7"/><rect x="10" y="7" width="4" height="14" rx="1" fill={color}/><rect x="17" y="4" width="4" height="17" rx="1" fill={color} opacity=".7"/></svg>);
const IconTrend  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><polyline points="3,17 8,12 13,15 21,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17,7 21,7 21,11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IconScale  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 4v16M5 20h14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M5 8L2 14h6L5 8z" stroke={color} strokeWidth="1.3" fill={color} opacity=".25" strokeLinejoin="round"/><path d="M19 8l-3 6h6l-3-6z" stroke={color} strokeWidth="1.3" fill={color} opacity=".25" strokeLinejoin="round"/></svg>);
const IconKana   = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">日</text></svg>);
const IconHanzi  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">中</text></svg>);
const IconSearch = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="10" cy="10" r="6" stroke={color} strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><path d="M7 10h6M10 7v6" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>);
const IconBrain  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 4C10 4 8 5.5 8 7.5c0 1-.5 2-1.5 2.5C5.5 10.5 5 11.5 5 12.5c0 2 1.5 3.5 3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/><path d="M12 4c2 0 4 1.5 4 3.5 0 1 .5 2 1.5 2.5 1 .5 1.5 1.5 1.5 2.5 0 2-1.5 3.5-3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/><path d="M12 16v4M9 20h6" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>);
const IconBuild  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="3" y="8" width="18" height="13" rx="1" stroke={color} strokeWidth="1.5"/><path d="M7 8V5a1 1 0 011-1h8a1 1 0 011 1v3" stroke={color} strokeWidth="1.5"/><rect x="7" y="13" width="3" height="3" rx=".5" stroke={color} strokeWidth="1.2"/><rect x="14" y="13" width="3" height="3" rx=".5" stroke={color} strokeWidth="1.2"/></svg>);
const IconPencil = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 20l2-6L17 4l4 4L9 20H3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/><path d="M14.5 6.5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>);
const IconCalc   = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.5"/><rect x="7" y="5" width="10" height="4" rx="1" fill={color} opacity=".25"/><circle cx="8" cy="14" r="1.2" fill={color}/><circle cx="12" cy="14" r="1.2" fill={color}/><circle cx="16" cy="14" r="1.2" fill={color}/><circle cx="8" cy="18" r="1.2" fill={color}/><circle cx="12" cy="18" r="1.2" fill={color}/></svg>);
const IconOrg    = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="9" y="2" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><rect x="2" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><rect x="9" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><rect x="16" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><path d="M12 6v4M12 10H5v7M12 10h7v7M12 10v7" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>);

const SubjectIconMap: Record<string, React.FC<{ color: string }>> = {
  'international-trade': IconGlobe,
  marketing:             IconChart,
  finance:               IconTrend,
  economics:             IconScale,
  japanese:              IconKana,
  chinese:               IconHanzi,
  'research-business':   IconSearch,
  'eq-pc':               IconBrain,
  'business-economics':  IconBuild,
  'pre-seminar':         IconPencil,
  'accounting-advanced': IconCalc,
  management:            IconOrg,
};

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

// ── Stat strip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, progress, color = '#3D7EFF' }: {
  label: string; value: string | number; progress?: number; color?: string;
}) {
  return (
    <div className="card-panel px-5 py-4">
      <div className="text-[9px] font-semibold uppercase tracking-[0.13em] mb-1.5" style={{ color: '#8B949E' }}>
        {label}
      </div>
      <div className="mono text-2xl leading-none" style={{ color: '#E6EDF3' }}>{value}</div>
      {progress !== undefined && (
        <div className="mt-2.5 overflow-hidden" style={{ height: '2px', background: '#30363D', borderRadius: '2px' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 1s cubic-bezier(0,0,0.2,1)' }} />
        </div>
      )}
    </div>
  );
}

// ── Subject card ───────────────────────────────────────────────────────────────

function SubjectCard({ subject, isCore }: { subject: SubjectDef; isCore: boolean }) {
  const { t } = useLang();
  const Icon = SubjectIconMap[subject.id] ?? IconGlobe;

  const fcCount = isCore && subject.flashcardTopic
    ? flashcardsData.filter(f => f.topic === subject.flashcardTopic).length : 0;
  const qCount  = isCore && subject.quizTopic
    ? quizData.filter(q => q.topic === subject.quizTopic).length : 0;

  return (
    <Link to={`/subject/${subject.id}`} className="no-underline block h-full">
      <TiltCard className="card-panel h-full" style={{ minHeight: '160px' }}>
        <div className="p-5 flex flex-col h-full gap-3">
          {/* Icon + color accent */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5"
              style={{ background: subject.color + '20', border: `1px solid ${subject.color}30` }}>
              <Icon color={subject.color} />
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
  const { flashcardsStudied, flashcardsKnown, quizScores, notesRead } = useStore();
  const { allSubjects, coreSubjects, extendedSubjects } = useResolvedSubjects();
  const [managing, setManaging] = useState(false);
  // Force the globe to rebuild when the set of subjects changes.
  const globeKey = allSubjects.map(s => s.id).join(',');

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
        {/* Globe canvas */}
        <GlobeView key={globeKey} subjects={allSubjects} />

        {/* Title overlay — top left */}
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

        {/* Scroll hint */}
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
          <StatChip label={t('stats_studied')} value={flashcardsStudied.length} color="#3D7EFF" />
          <StatChip label={t('stats_known')}   value={flashcardsKnown.length}   progress={knownPct} color="#3D7EFF" />
          <StatChip label={t('stats_score')}   value={avgScore > 0 ? `${avgScore}%` : '—'} progress={avgScore || undefined} color="#D29922" />
          <StatChip label={t('stats_notes')}   value={notesRead.length}         progress={notesPct} color="#2EA043" />
        </div>

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
              {coreSubjects.map(s => <SubjectCard key={s.id} subject={s} isCore={true} />)}
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
              {extendedSubjects.map(s => <SubjectCard key={s.id} subject={s} isCore={false} />)}
            </div>
          </div>
        )}

      </div>

      {managing && <ManageSubjects onClose={() => setManaging(false)} />}
    </div>
  );
}

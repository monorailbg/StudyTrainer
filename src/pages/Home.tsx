import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useStore } from '../store/useStore';
import { CORE_SUBJECTS, EXTENDED_SUBJECTS } from '../data/subjects';
import flashcardsData from '../data/flashcards.json';
import quizData from '../data/quiz.json';
import notesData from '../data/notes-config.json';

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const IconGlobe = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="1.5" />
    <path d="M3 12h18M3 8h18M3 16h18" stroke={color} strokeWidth="1.2" opacity="0.5" />
  </svg>
);

const IconChart = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <rect x="3" y="12" width="4" height="9" rx="1" fill={color} opacity="0.7" />
    <rect x="10" y="7" width="4" height="14" rx="1" fill={color} />
    <rect x="17" y="4" width="4" height="17" rx="1" fill={color} opacity="0.7" />
    <path d="M3 21h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconTrend = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <polyline points="3,17 8,12 13,15 21,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="17,7 21,7 21,11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconScale = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M12 4v16M5 20h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 8L2 14h6L5 8z" stroke={color} strokeWidth="1.3" fill={color} opacity="0.25" strokeLinejoin="round" />
    <path d="M19 8l-3 6h6l-3-6z" stroke={color} strokeWidth="1.3" fill={color} opacity="0.25" strokeLinejoin="round" />
  </svg>
);

const IconKana = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">日</text>
  </svg>
);

const IconHanzi = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">中</text>
  </svg>
);

const IconSearch = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="6" stroke={color} strokeWidth="1.5" />
    <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 10h6M10 7v6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconBrain = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M12 4C10 4 8 5.5 8 7.5c0 1-.5 2-1.5 2.5C5.5 10.5 5 11.5 5 12.5c0 2 1.5 3.5 3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 4c2 0 4 1.5 4 3.5 0 1 .5 2 1.5 2.5 1 .5 1.5 1.5 1.5 2.5 0 2-1.5 3.5-3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 16v4M9 20h6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconBuilding = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <rect x="3" y="8" width="18" height="13" rx="1" stroke={color} strokeWidth="1.5" />
    <path d="M7 8V5a1 1 0 011-1h8a1 1 0 011 1v3" stroke={color} strokeWidth="1.5" />
    <rect x="7" y="13" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.2" />
    <rect x="14" y="13" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.2" />
    <path d="M10.5 21v-4h3v4" stroke={color} strokeWidth="1.2" />
  </svg>
);

const IconPencil = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M3 20l2-6L17 4l4 4L9 20H3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M14.5 6.5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconCalc = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.5" />
    <rect x="7" y="5" width="10" height="4" rx="1" fill={color} opacity="0.25" />
    <circle cx="8" cy="14" r="1.2" fill={color} />
    <circle cx="12" cy="14" r="1.2" fill={color} />
    <circle cx="16" cy="14" r="1.2" fill={color} />
    <circle cx="8" cy="18" r="1.2" fill={color} />
    <circle cx="12" cy="18" r="1.2" fill={color} />
  </svg>
);

const IconOrg = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <rect x="9" y="2" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4" />
    <rect x="2" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4" />
    <rect x="9" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4" />
    <rect x="16" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4" />
    <path d="M12 6v4M12 10H5v7M12 10h7v7M12 10v7" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const SubjectIconMap: Record<string, React.FC<{ color: string }>> = {
  'international-trade': IconGlobe,
  marketing: IconChart,
  finance: IconTrend,
  economics: IconScale,
  japanese: IconKana,
  chinese: IconHanzi,
  'research-business': IconSearch,
  'eq-pc': IconBrain,
  'business-economics': IconBuilding,
  'pre-seminar': IconPencil,
  'accounting-advanced': IconCalc,
  management: IconOrg,
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Tilt Card (cursor-tracking perspective) ───────────────────────────────────

function TiltCard({ children, className, style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 7;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -5;
    el.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) translateY(-3px)`;
    el.style.boxShadow = '0 1px 0 rgba(255,255,255,0.08) inset, 0 8px 20px rgba(0,0,0,0.55), 0 24px 52px rgba(0,0,0,0.4), 0 0 0 1px rgba(61,126,255,0.25)';
    el.style.borderColor = 'rgba(61,126,255,0.35)';
  }

  function handleMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    el.style.boxShadow = '';
    el.style.borderColor = '';
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, transition: 'transform 150ms cubic-bezier(0.4,0,0.2,1), box-shadow 150ms cubic-bezier(0.4,0,0.2,1), border-color 150ms cubic-bezier(0.4,0,0.2,1)' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, progress }: {
  label: string;
  value: string | number;
  sub?: string;
  progress?: number;
}) {
  return (
    <div className="card-panel p-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] mb-2.5" style={{ color: '#8B949E' }}>
        {label}
      </div>
      <div className="mono text-3xl leading-none mb-1" style={{ color: '#E6EDF3' }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: '#8B949E' }}>
          {sub}
        </div>
      )}
      {progress !== undefined && (
        <div className="mt-3 overflow-hidden" style={{ height: '2px', background: '#30363D', borderRadius: '1px' }}>
          <div
            className="h-full"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: '#3D7EFF',
              borderRadius: '1px',
              transition: 'width 0.8s cubic-bezier(0.0,0.0,0.2,1)',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Core Subject Card ─────────────────────────────────────────────────────────

function CoreCard({ subject }: { subject: typeof CORE_SUBJECTS[0] }) {
  const { t } = useLang();
  const Icon = SubjectIconMap[subject.id] ?? IconGlobe;
  const fcCount = flashcardsData.filter((f) => f.topic === subject.flashcardTopic).length;
  const qCount = quizData.filter((q) => q.topic === subject.quizTopic).length;
  const nCount = notesData.filter((n) => n.subject === subject.notesSubject).length;

  return (
    <TiltCard className="card-panel overflow-hidden h-full">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5"
            style={{ backgroundColor: subject.color + '22', border: `1px solid ${subject.color}30` }}
          >
            <Icon color={subject.color} />
          </div>
          <div className="flex-1 pt-0.5 min-w-0">
            <div className="text-sm font-semibold text-md-on-surface leading-snug" style={{ fontFamily: "'Sora', sans-serif" }}>
              {subject.title}
            </div>
            <div className="text-xs mt-0.5 leading-relaxed" style={{ color: '#8B949E' }}>
              {subject.description}
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 mb-4 flex-wrap">
          {[
            { val: fcCount, label: t('cards') },
            { val: qCount, label: t('questions') },
            { val: nCount, label: t('notes_count') },
          ].map(({ val, label }) => (
            <span
              key={label}
              className="text-[10px] font-medium px-2 py-0.5 rounded"
              style={{ background: '#1F2937', color: '#8B949E', border: '1px solid #30363D' }}
            >
              {val} {label}
            </span>
          ))}
        </div>

        <div className="flex gap-1.5">
          {[
            { to: `/flashcards?topic=${encodeURIComponent(subject.flashcardTopic ?? '')}`, label: t('nav_flashcards') },
            { to: '/notes', label: t('nav_notes') },
            { to: `/quiz?topic=${encodeURIComponent(subject.quizTopic ?? '')}`, label: t('nav_quiz') },
          ].map(({ to, label }) => (
            <Link
              key={label}
              to={to}
              className="flex-1 flex items-center justify-center h-8 text-[11px] font-semibold no-underline transition-all duration-150 rounded"
              style={{
                backgroundColor: subject.color + '1A',
                color: subject.color,
                border: `1px solid ${subject.color}40`,
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </TiltCard>
  );
}

// ── Extended Subject Card ─────────────────────────────────────────────────────

function ExtendedCard({ subject }: { subject: typeof EXTENDED_SUBJECTS[0] }) {
  const { t } = useLang();
  const Icon = SubjectIconMap[subject.id] ?? IconGlobe;

  return (
    <Link to={`/subject/${subject.id}`} className="no-underline block h-full">
      <TiltCard className="card-panel p-4 h-full">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]"
            style={{ backgroundColor: subject.color + '22', border: `1px solid ${subject.color}30` }}
          >
            <Icon color={subject.color} />
          </div>
          <span
            className="text-[9px] font-semibold tracking-[0.1em] px-2 py-0.5 rounded"
            style={{ background: '#1F2937', color: '#8B949E', border: '1px solid #30363D' }}
          >
            UPLOAD
          </span>
        </div>

        <div className="text-sm font-semibold leading-snug mb-1" style={{ fontFamily: "'Sora', sans-serif", color: '#E6EDF3' }}>
          {subject.title}
        </div>
        <div className="text-xs leading-relaxed mb-3" style={{ color: '#8B949E' }}>
          {subject.description}
        </div>

        {subject.levels ? (
          <div className="flex gap-1 flex-wrap">
            {subject.levels.map(l => (
              <span
                key={l}
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: subject.color + '15', color: subject.color, border: `1px solid ${subject.color}30` }}
              >
                {l}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs font-medium" style={{ color: subject.color }}>
            {t('upload_cta')} →
          </div>
        )}
      </TiltCard>
    </Link>
  );
}

// ── Mode Card ─────────────────────────────────────────────────────────────────

function ModeCard({ to, iconBg, iconPath, title, desc, stat, statColor }: {
  to: string;
  iconBg: string;
  iconPath: React.ReactNode;
  title: string;
  desc: string;
  stat: string;
  statColor: string;
}) {
  return (
    <Link to={to} className="no-underline block h-full">
      <TiltCard className="card-panel p-5 h-full flex flex-col">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 flex-shrink-0" style={{ background: iconBg, border: `1px solid ${statColor}22` }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            {iconPath}
          </svg>
        </div>
        <div className="text-[15px] font-semibold mb-1.5" style={{ fontFamily: "'Sora', sans-serif", color: '#E6EDF3' }}>
          {title}
        </div>
        <div className="text-[13px] leading-relaxed flex-1" style={{ color: '#8B949E' }}>
          {desc}
        </div>
        <div className="mt-4 inline-flex">
          <span
            className="text-[11px] font-semibold px-3 py-1 rounded-full"
            style={{ background: `${statColor}22`, color: statColor, border: `1px solid ${statColor}45` }}
          >
            {stat}
          </span>
        </div>
      </TiltCard>
    </Link>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="text-sm font-semibold m-0" style={{ fontFamily: "'Sora', sans-serif", color: '#E6EDF3' }}>
        {label}
      </h2>
      {count !== undefined && (
        <span className="mono text-xs px-2 py-0.5 rounded" style={{ background: '#1F2937', color: '#8B949E', border: '1px solid #30363D' }}>
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: '#30363D' }} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Home() {
  const { t } = useLang();
  const { flashcardsStudied, flashcardsKnown, quizScores, notesRead } = useStore();

  const totalCards = flashcardsData.length;
  const totalNotes = notesData.length;
  const avgScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((a, b) => a + (b.score / b.total) * 100, 0) / quizScores.length)
    : 0;

  const knownPct = totalCards > 0 ? Math.round((flashcardsKnown.length / totalCards) * 100) : 0;
  const notesPct = totalNotes > 0 ? Math.round((notesRead.length / totalNotes) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pb-20">

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] mb-2" style={{ color: '#8B949E' }}>
          Global Business Studies
        </div>
        <h1 className="m-0 mb-1" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', color: '#E6EDF3', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {getGreeting()}
        </h1>
        <p className="text-sm mt-2 m-0" style={{ color: '#8B949E' }}>
          {t('dash_sub')}
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Stat
          label={t('stats_studied')}
          value={flashcardsStudied.length}
          sub={`of ${totalCards} total`}
        />
        <Stat
          label={t('stats_known')}
          value={flashcardsKnown.length}
          sub={`${knownPct}% mastered`}
          progress={knownPct}
        />
        <Stat
          label={t('stats_score')}
          value={avgScore > 0 ? `${avgScore}%` : '—'}
          sub={quizScores.length > 0 ? `${quizScores.length} ${t('sessions')}` : t('not_started')}
          progress={avgScore > 0 ? avgScore : undefined}
        />
        <Stat
          label={t('stats_notes')}
          value={notesRead.length}
          sub={`${notesPct}% read`}
          progress={notesPct}
        />
      </div>

      {/* ── Study Modes ──────────────────────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeader label={t('study_modes')} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ModeCard
            to="/flashcards"
            iconBg="rgba(61,126,255,0.12)"

            iconPath={<><rect x="3" y="5" width="18" height="14" rx="2" stroke="#3D7EFF" strokeWidth="1.5" /><path d="M8 12h8M8 9h5" stroke="#3D7EFF" strokeWidth="1.3" strokeLinecap="round" /></>}
            title={t('nav_flashcards')}
            desc={`${totalCards} ${t('cards')} across 4 subjects`}
            stat={`${flashcardsKnown.length} ${t('known')}`}
            statColor="#3D7EFF"
          />
          <ModeCard
            to="/notes"
            iconBg="rgba(46,160,67,0.12)"

            iconPath={<><path d="M5 3h10l4 4v14H5V3z" stroke="#2EA043" strokeWidth="1.5" strokeLinejoin="round" /><path d="M15 3v4h4" stroke="#2EA043" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 11h8M8 14h6M8 17h4" stroke="#2EA043" strokeWidth="1.3" strokeLinecap="round" /></>}
            title={t('nav_notes')}
            desc={`${totalNotes} ${t('notes_count')} · structured summaries`}
            stat={`${notesRead.length} read`}
            statColor="#2EA043"
          />
          <ModeCard
            to="/quiz"
            iconBg="rgba(210,153,34,0.12)"

            iconPath={<><circle cx="12" cy="12" r="9" stroke="#D29922" strokeWidth="1.5" /><path d="M9 9c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.5-1.5 2.25-3 3" stroke="#D29922" strokeWidth="1.5" strokeLinecap="round" /><circle cx="12" cy="17" r="1" fill="#D29922" /></>}
            title={t('nav_quiz')}
            desc={`${quizData.length} ${t('questions')} · timed & practice`}
            stat={avgScore > 0 ? `${avgScore}% avg` : t('not_started')}
            statColor="#D29922"
          />
        </div>
      </div>

      {/* ── Core Subjects ────────────────────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeader label={t('core_subjects')} count={CORE_SUBJECTS.length} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CORE_SUBJECTS.map(s => <CoreCard key={s.id} subject={s} />)}
        </div>
      </div>

      {/* ── Extended Curriculum ──────────────────────────────────────────── */}
      <div>
        <SectionHeader label={t('extended')} count={EXTENDED_SUBJECTS.length} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {EXTENDED_SUBJECTS.map(s => <ExtendedCard key={s.id} subject={s} />)}
        </div>
      </div>

    </div>
  );
}

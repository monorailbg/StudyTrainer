import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useStore } from '../store/useStore';
import { CORE_SUBJECTS, EXTENDED_SUBJECTS } from '../data/subjects';
import flashcardsData from '../data/flashcards.json';
import quizData from '../data/quiz.json';
import notesData from '../data/notes-config.json';

// ── SVG Icons ──────────────────────────────────────────────────────────────────

const IconGlobe = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="1.5" />
    <path d="M3 12h18M3 8h18M3 16h18" stroke={color} strokeWidth="1.2" opacity="0.5" />
  </svg>
);

const IconChart = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <rect x="3" y="12" width="4" height="9" rx="1" fill={color} opacity="0.7" />
    <rect x="10" y="7" width="4" height="14" rx="1" fill={color} />
    <rect x="17" y="4" width="4" height="17" rx="1" fill={color} opacity="0.7" />
    <path d="M3 21h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconTrend = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <polyline points="3,17 8,12 13,15 21,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="17,7 21,7 21,11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconScale = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M12 4v16M5 20h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 8L2 14h6L5 8z" stroke={color} strokeWidth="1.3" fill={color} opacity="0.25" strokeLinejoin="round" />
    <path d="M19 8l-3 6h6l-3-6z" stroke={color} strokeWidth="1.3" fill={color} opacity="0.25" strokeLinejoin="round" />
  </svg>
);

const IconKana = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">日</text>
  </svg>
);

const IconHanzi = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">中</text>
  </svg>
);

const IconSearch = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="6" stroke={color} strokeWidth="1.5" />
    <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 10h6M10 7v6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconBrain = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M12 4C10 4 8 5.5 8 7.5c0 1-.5 2-1.5 2.5C5.5 10.5 5 11.5 5 12.5c0 2 1.5 3.5 3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 4c2 0 4 1.5 4 3.5 0 1 .5 2 1.5 2.5 1 .5 1.5 1.5 1.5 2.5 0 2-1.5 3.5-3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 16v4M9 20h6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="9" cy="10" r="1.2" fill={color} />
    <circle cx="15" cy="10" r="1.2" fill={color} />
  </svg>
);

const IconBuilding = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <rect x="3" y="8" width="18" height="13" rx="1" stroke={color} strokeWidth="1.5" />
    <path d="M7 8V5a1 1 0 011-1h8a1 1 0 011 1v3" stroke={color} strokeWidth="1.5" />
    <rect x="7" y="13" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.2" />
    <rect x="14" y="13" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.2" />
    <path d="M10.5 21v-4h3v4" stroke={color} strokeWidth="1.2" />
  </svg>
);

const IconPencil = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M3 20l2-6L17 4l4 4L9 20H3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M14.5 6.5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 20l2-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconCalc = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.5" />
    <rect x="7" y="5" width="10" height="4" rx="1" fill={color} opacity="0.25" />
    <circle cx="8" cy="14" r="1.2" fill={color} />
    <circle cx="12" cy="14" r="1.2" fill={color} />
    <circle cx="16" cy="14" r="1.2" fill={color} />
    <circle cx="8" cy="18" r="1.2" fill={color} />
    <circle cx="12" cy="18" r="1.2" fill={color} />
    <rect x="14.5" y="16.5" width="3" height="3" rx="0.5" fill={color} opacity="0.5" />
  </svg>
);

const IconOrg = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
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

// ── Stat Card ──────────────────────────────────────────────────────────────────

function Stat({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="bg-md-surface-container rounded-3xl p-5 border border-md-outline-variant">
      <div className="font-display text-4xl text-md-primary leading-none tabular-nums">
        {value}
      </div>
      <div className="text-md-on-surface text-sm font-medium mt-2">
        {label}
      </div>
      {sub && (
        <div className="text-md-on-surface-variant text-xs mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Core Subject Card ──────────────────────────────────────────────────────────

function CoreCard({ subject }: { subject: typeof CORE_SUBJECTS[0] }) {
  const { t } = useLang();
  const Icon = SubjectIconMap[subject.id] ?? IconGlobe;
  const fcCount = flashcardsData.filter((f) => f.topic === subject.flashcardTopic).length;
  const qCount = quizData.filter((q) => q.topic === subject.quizTopic).length;
  const nCount = notesData.filter((n) => n.subject === subject.notesSubject).length;

  return (
    <div
      className="group bg-md-surface-container rounded-3xl overflow-hidden border border-md-outline-variant transition-all duration-300 hover:border-md-outline hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* Accent stripe */}
      <div className="h-0.5 w-full" style={{ backgroundColor: subject.color }} />

      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: subject.color + '20' }}
          >
            <Icon color={subject.color} />
          </div>
          <div className="flex-1 pt-0.5">
            <div className="font-display text-md-on-surface text-base leading-snug">
              {subject.title}
            </div>
            <div className="text-md-on-surface-variant text-xs mt-1 leading-relaxed">
              {subject.description}
            </div>
          </div>
        </div>

        {/* Counts */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {[
            { val: fcCount, label: t('cards') },
            { val: qCount, label: t('questions') },
            { val: nCount, label: t('notes_count') },
          ].map(({ val, label }) => (
            <span
              key={label}
              className="bg-md-surface-container-high text-md-on-surface-variant text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full border border-md-outline-variant"
            >
              {val} {label}
            </span>
          ))}
        </div>

        {/* Study links */}
        <div className="flex gap-2">
          {[
            { to: `/flashcards?topic=${encodeURIComponent(subject.flashcardTopic ?? '')}`, label: t('nav_flashcards') },
            { to: `/notes`, label: t('nav_notes') },
            { to: `/quiz?topic=${encodeURIComponent(subject.quizTopic ?? '')}`, label: t('nav_quiz') },
          ].map(({ to, label }) => (
            <Link
              key={label}
              to={to}
              className="flex-1 flex items-center justify-center h-8 rounded-full text-[11px] font-medium no-underline transition-all duration-200 border hover:brightness-110"
              style={{
                backgroundColor: subject.color + '18',
                color: subject.color,
                borderColor: subject.color + '35',
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Extended Subject Card ──────────────────────────────────────────────────────

function ExtendedCard({ subject }: { subject: typeof EXTENDED_SUBJECTS[0] }) {
  const { t } = useLang();
  const Icon = SubjectIconMap[subject.id] ?? IconGlobe;

  return (
    <Link to={`/subject/${subject.id}`} className="no-underline block group">
      <div className="bg-md-surface-container rounded-3xl p-5 border border-md-outline-variant h-full transition-all duration-300 hover:border-md-outline hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: subject.color + '20' }}
          >
            <Icon color={subject.color} />
          </div>
          <span className="bg-md-surface-container-high text-md-on-surface-variant text-[10px] font-semibold tracking-widest px-2.5 py-1 rounded-full border border-md-outline-variant">
            UPLOAD
          </span>
        </div>

        <div className="font-display text-md-on-surface text-[15px] leading-snug mb-1">
          {subject.title}
        </div>
        <div className="text-md-on-surface-variant text-xs leading-relaxed mb-3">
          {subject.description}
        </div>

        {subject.levels ? (
          <div className="flex gap-1.5 flex-wrap">
            {subject.levels.map(l => (
              <span
                key={l}
                className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: subject.color + '18',
                  color: subject.color,
                  borderColor: subject.color + '35',
                }}
              >
                {l}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs font-medium mt-1" style={{ color: subject.color }}>
            {t('upload_cta')} →
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Study Mode Card ────────────────────────────────────────────────────────────

function ModeCard({ to, icon, title, desc, stat }: {
  to: string; icon: React.ReactNode; title: string; desc: string; stat: string;
}) {
  return (
    <Link to={to} className="no-underline block group">
      <div className="bg-md-surface-container rounded-3xl p-6 border border-md-outline-variant transition-all duration-300 hover:bg-md-surface-container-high hover:-translate-y-0.5 hover:shadow-lg">
        <div className="mb-4">{icon}</div>
        <div className="font-display text-md-on-surface text-lg mb-1.5">{title}</div>
        <div className="text-md-on-surface-variant text-xs leading-relaxed mb-4">{desc}</div>
        <div
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
          style={{
            backgroundColor: 'rgba(208,188,255,0.12)',
            color: '#D0BCFF',
            borderColor: 'rgba(208,188,255,0.25)',
          }}
        >
          {stat}
        </div>
      </div>
    </Link>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="font-display text-md-on-surface text-xl">{label}</div>
      {count !== undefined && (
        <span className="bg-md-surface-container-high text-md-on-surface-variant text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-md-outline-variant">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-md-outline-variant" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Home() {
  const { t } = useLang();
  const { flashcardsStudied, flashcardsKnown, quizScores, notesRead } = useStore();

  const totalCards = flashcardsData.length;
  const totalNotes = notesData.length;
  const avgScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((a, b) => a + (b.score / b.total) * 100, 0) / quizScores.length)
    : 0;

  const FlashIcon = () => (
    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(208,188,255,0.15)' }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="#D0BCFF" strokeWidth="1.5" />
        <path d="M8 12h8M8 9h5" stroke="#D0BCFF" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );

  const NotesIcon = () => (
    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(96,165,250,0.15)' }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <path d="M5 3h10l4 4v14H5V3z" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M15 3v4h4" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 11h8M8 14h6M8 17h4" stroke="#60a5fa" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );

  const QuizIcon = () => (
    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(192,132,252,0.15)' }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="#c084fc" strokeWidth="1.5" />
        <path d="M9 9c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.5-1.5 2.25-3 3" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="#c084fc" />
      </svg>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pb-20">

      {/* ── Hero Header ──────────────────────────────────────────────────────── */}
      <div className="mb-10 relative">
        {/* Decorative blur orb */}
        <div
          className="absolute -top-12 -left-12 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #4F378B 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="text-md-on-surface-variant text-[10px] tracking-[0.2em] uppercase mb-2 font-medium">
            Global Business Studies
          </div>
          <h1 className="font-display text-md-on-surface text-4xl leading-tight tracking-tight m-0" style={{ fontSize: 'clamp(2rem,4vw,2.8rem)' }}>
            {t('dash_title')}
          </h1>
          <p className="text-md-on-surface-variant text-sm mt-2">
            {t('dash_sub')}
          </p>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-11">
        <Stat value={flashcardsStudied.length} label={t('stats_studied')} sub={`${t('of')} ${totalCards} ${t('total')}`} />
        <Stat value={flashcardsKnown.length} label={t('stats_known')} sub={t('marked_correct')} />
        <Stat
          value={avgScore > 0 ? `${avgScore}%` : '—'}
          label={t('stats_score')}
          sub={quizScores.length > 0 ? `${quizScores.length} ${t('sessions')}` : t('not_started')}
        />
        <Stat value={notesRead.length} label={t('stats_notes')} sub={`${t('of')} ${totalNotes} ${t('total')}`} />
      </div>

      {/* ── Study Modes ──────────────────────────────────────────────────────── */}
      <div className="mb-11">
        <SectionHeader label={t('study_modes')} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ModeCard
            to="/flashcards"
            icon={<FlashIcon />}
            title={t('nav_flashcards')}
            desc={`${totalCards} ${t('cards')} · 4 subjects`}
            stat={`${flashcardsKnown.length} ${t('known')}`}
          />
          <ModeCard
            to="/notes"
            icon={<NotesIcon />}
            title={t('nav_notes')}
            desc={`${totalNotes} ${t('notes_count')} · structured summaries`}
            stat={`${notesRead.length} read`}
          />
          <ModeCard
            to="/quiz"
            icon={<QuizIcon />}
            title={t('nav_quiz')}
            desc={`${quizData.length} ${t('questions')} · timed & practice`}
            stat={avgScore > 0 ? `${avgScore}% avg` : t('not_started')}
          />
        </div>
      </div>

      {/* ── Core Subjects ────────────────────────────────────────────────────── */}
      <div className="mb-11">
        <SectionHeader label={t('core_subjects')} count={CORE_SUBJECTS.length} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CORE_SUBJECTS.map(s => <CoreCard key={s.id} subject={s} />)}
        </div>
      </div>

      {/* ── Extended Curriculum ──────────────────────────────────────────────── */}
      <div>
        <SectionHeader label={t('extended')} count={EXTENDED_SUBJECTS.length} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {EXTENDED_SUBJECTS.map(s => <ExtendedCard key={s.id} subject={s} />)}
        </div>
      </div>

    </div>
  );
}

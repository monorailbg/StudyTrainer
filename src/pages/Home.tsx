import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useStore } from '../store/useStore';
import { CORE_SUBJECTS, EXTENDED_SUBJECTS } from '../data/subjects';
import flashcardsData from '../data/flashcards.json';
import quizData from '../data/quiz.json';
import notesData from '../data/notes-config.json';

// ── SVG Icons ──────────────────────────────────────────────────────────────────

const IconGlobe = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="1.5" />
    <path d="M3 12h18M3 8h18M3 16h18" stroke={color} strokeWidth="1.2" opacity="0.5" />
  </svg>
);

const IconChart = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <rect x="3" y="12" width="4" height="9" rx="1" fill={color} opacity="0.7" />
    <rect x="10" y="7" width="4" height="14" rx="1" fill={color} />
    <rect x="17" y="4" width="4" height="17" rx="1" fill={color} opacity="0.7" />
    <path d="M3 21h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconTrend = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <polyline points="3,17 8,12 13,15 21,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="17,7 21,7 21,11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconScale = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path d="M12 4v16M5 20h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 8L2 14h6L5 8z" stroke={color} strokeWidth="1.3" fill={color} opacity="0.25" strokeLinejoin="round" />
    <path d="M19 8l-3 6h6l-3-6z" stroke={color} strokeWidth="1.3" fill={color} opacity="0.25" strokeLinejoin="round" />
  </svg>
);

const IconKana = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">日</text>
  </svg>
);

const IconHanzi = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">中</text>
  </svg>
);

const IconSearch = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="6" stroke={color} strokeWidth="1.5" />
    <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 10h6M10 7v6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconBrain = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path d="M12 4C10 4 8 5.5 8 7.5c0 1-.5 2-1.5 2.5C5.5 10.5 5 11.5 5 12.5c0 2 1.5 3.5 3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 4c2 0 4 1.5 4 3.5 0 1 .5 2 1.5 2.5 1 .5 1.5 1.5 1.5 2.5 0 2-1.5 3.5-3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 16v4M9 20h6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="9" cy="10" r="1.2" fill={color} />
    <circle cx="15" cy="10" r="1.2" fill={color} />
  </svg>
);

const IconBuilding = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <rect x="3" y="8" width="18" height="13" rx="1" stroke={color} strokeWidth="1.5" />
    <path d="M7 8V5a1 1 0 011-1h8a1 1 0 011 1v3" stroke={color} strokeWidth="1.5" />
    <rect x="7" y="13" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.2" />
    <rect x="14" y="13" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.2" />
    <path d="M10.5 21v-4h3v4" stroke={color} strokeWidth="1.2" />
  </svg>
);

const IconPencil = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path d="M3 20l2-6L17 4l4 4L9 20H3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M14.5 6.5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 20l2-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconCalc = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
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
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
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
    <div style={{
      backgroundColor: '#0d1a2e',
      border: '1px solid #1e2d45',
      borderRadius: '12px',
      padding: '20px 22px',
    }}>
      <div style={{
        fontFamily: 'DM Serif Display, serif',
        fontSize: '2.2rem',
        color: '#d4a843',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#f0f4f8', marginTop: '6px', fontWeight: 500 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', marginTop: '2px' }}>
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

  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#0d1a2e',
        border: `1px solid ${hovered ? subject.color + '60' : '#1e2d45'}`,
        borderRadius: '14px',
        overflow: 'hidden',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        cursor: 'default',
      }}
    >
      {/* Accent stripe */}
      <div style={{ height: '3px', backgroundColor: subject.color }} />

      <div style={{ padding: '22px' }}>
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: subject.color + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon color={subject.color} />
          </div>
          <div style={{ flex: 1, paddingTop: '2px' }}>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.05rem', color: '#f0f4f8', lineHeight: 1.3 }}>
              {subject.title}
            </div>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#4a5a6e', marginTop: '3px', lineHeight: 1.4 }}>
              {subject.description}
            </div>
          </div>
        </div>

        {/* Counts */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { val: fcCount, label: t('cards') },
            { val: qCount, label: t('questions') },
            { val: nCount, label: t('notes_count') },
          ].map(({ val, label }) => (
            <span key={label} style={{
              backgroundColor: '#162236',
              color: '#94a3b8',
              fontSize: '10px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontWeight: 500,
              letterSpacing: '0.04em',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #1e2d45',
            }}>
              {val} {label}
            </span>
          ))}
        </div>

        {/* Study links */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { to: `/flashcards?topic=${encodeURIComponent(subject.flashcardTopic ?? '')}`, label: t('nav_flashcards') },
            { to: `/notes`, label: t('nav_notes') },
            { to: `/quiz?topic=${encodeURIComponent(subject.quizTopic ?? '')}`, label: t('nav_quiz') },
          ].map(({ to, label }) => (
            <Link
              key={label}
              to={to}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '34px',
                backgroundColor: subject.color + '14',
                color: subject.color,
                border: `1px solid ${subject.color}30`,
                borderRadius: '7px',
                fontSize: '11px',
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '0.03em',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = subject.color + '28'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = subject.color + '14'}
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
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={`/subject/${subject.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        backgroundColor: '#0d1a2e',
        border: `1px solid ${hovered ? subject.color + '50' : '#1e2d45'}`,
        borderRadius: '14px',
        padding: '18px 20px',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        height: '100%',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '9px',
            backgroundColor: subject.color + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon color={subject.color} />
          </div>
          {/* Upload arrow badge */}
          <div style={{
            backgroundColor: '#162236',
            border: '1px solid #2d4465',
            borderRadius: '5px',
            padding: '3px 8px',
            fontSize: '10px',
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontWeight: 600,
            color: '#94a3b8',
            letterSpacing: '0.06em',
          }}>
            UPLOAD
          </div>
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: '0.98rem',
          color: '#f0f4f8',
          marginBottom: '5px',
          lineHeight: 1.3,
        }}>
          {subject.title}
        </div>

        <div style={{
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontSize: '11px',
          color: '#4a5a6e',
          lineHeight: 1.5,
          marginBottom: '14px',
        }}>
          {subject.description}
        </div>

        {/* Level badges */}
        {subject.levels && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {subject.levels.map(l => (
              <span key={l} style={{
                backgroundColor: subject.color + '14',
                color: subject.color,
                border: `1px solid ${subject.color}28`,
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '2px 7px',
              }}>
                {l}
              </span>
            ))}
          </div>
        )}

        {!subject.levels && (
          <div style={{
            color: subject.color,
            fontSize: '12px',
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontWeight: 600,
            marginTop: '4px',
          }}>
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
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={to}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        backgroundColor: '#0d1a2e',
        border: `1px solid ${hovered ? '#d4a84360' : '#1e2d45'}`,
        borderRadius: '14px',
        padding: '22px',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}>
        <div style={{ marginBottom: '14px' }}>{icon}</div>
        <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', color: '#f0f4f8', marginBottom: '5px' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#4a5a6e', lineHeight: 1.5, marginBottom: '14px' }}>
          {desc}
        </div>
        <div style={{
          display: 'inline-block',
          backgroundColor: '#d4a84314',
          color: '#d4a843',
          fontSize: '11px',
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '4px 10px',
          borderRadius: '5px',
          border: '1px solid #d4a84330',
        }}>
          {stat}
        </div>
      </div>
    </Link>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', color: '#f0f4f8' }}>
        {label}
      </div>
      {count !== undefined && (
        <div style={{
          backgroundColor: '#162236',
          border: '1px solid #1e2d45',
          borderRadius: '5px',
          padding: '1px 8px',
          fontSize: '11px',
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontWeight: 600,
          color: '#94a3b8',
        }}>
          {count}
        </div>
      )}
      <div style={{ flex: 1, height: '1px', backgroundColor: '#1e2d45' }} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

import { useState } from 'react';

export default function Home() {
  const { t } = useLang();
  const { flashcardsStudied, flashcardsKnown, quizScores, notesRead } = useStore();

  const totalCards = flashcardsData.length;
  const totalNotes = notesData.length;
  const avgScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((a, b) => a + (b.score / b.total) * 100, 0) / quizScores.length)
    : 0;

  const FlashIcon = () => (
    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#d4a84318', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="#d4a843" strokeWidth="1.5" />
        <path d="M8 12h8M8 9h5" stroke="#d4a843" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );

  const NotesIcon = () => (
    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#60a5fa18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
        <path d="M5 3h10l4 4v14H5V3z" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M15 3v4h4" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 11h8M8 14h6M8 17h4" stroke="#60a5fa" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );

  const QuizIcon = () => (
    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#c084fc18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="#c084fc" strokeWidth="1.5" />
        <path d="M9 9c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.5-1.5 2.25-3 3" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="#c084fc" />
      </svg>
    </div>
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontSize: '10px',
          color: '#4a5a6e',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}>
          Global Business Studies
        </div>
        <h1 style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(2rem, 4vw, 2.8rem)',
          color: '#f0f4f8',
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '-0.5px',
        }}>
          {t('dash_title')}
        </h1>
        <p style={{
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontSize: '14px',
          color: '#94a3b8',
          marginTop: '8px',
        }}>
          {t('dash_sub')}
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '44px',
      }}>
        <Stat
          value={flashcardsStudied.length}
          label={t('stats_studied')}
          sub={`${t('of')} ${totalCards} ${t('total')}`}
        />
        <Stat
          value={flashcardsKnown.length}
          label={t('stats_known')}
          sub={t('marked_correct')}
        />
        <Stat
          value={avgScore > 0 ? `${avgScore}%` : '—'}
          label={t('stats_score')}
          sub={quizScores.length > 0 ? `${quizScores.length} ${t('sessions')}` : t('not_started')}
        />
        <Stat
          value={notesRead.length}
          label={t('stats_notes')}
          sub={`${t('of')} ${totalNotes} ${t('total')}`}
        />
      </div>

      {/* ── Study Modes ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '44px' }}>
        <SectionHeader label={t('study_modes')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
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
      <div style={{ marginBottom: '44px' }}>
        <SectionHeader label={t('core_subjects')} count={CORE_SUBJECTS.length} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {CORE_SUBJECTS.map(s => <CoreCard key={s.id} subject={s} />)}
        </div>
      </div>

      {/* ── Extended Curriculum ──────────────────────────────────────────────── */}
      <div>
        <SectionHeader label={t('extended')} count={EXTENDED_SUBJECTS.length} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {EXTENDED_SUBJECTS.map(s => <ExtendedCard key={s.id} subject={s} />)}
        </div>
      </div>

    </div>
  );
}

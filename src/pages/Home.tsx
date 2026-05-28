import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import flashcardsData from '../data/flashcards.json';
import quizData from '../data/quiz.json';
import notesData from '../data/notes-config.json';

const subjects = [
  {
    id: 'international-trade',
    title: 'International Trade',
    description: 'Comparative advantage, trade policy, Heckscher-Ohlin, terms of trade.',
    icon: '🌐',
    accentColor: '#c9a84c',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Marketing mix, segmentation, brand equity, consumer behaviour.',
    icon: '📊',
    accentColor: '#7c9fc4',
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'NPV, IRR, WACC, capital markets, EMH, risk and return.',
    icon: '💹',
    accentColor: '#6dab8a',
  },
  {
    id: 'economics',
    title: 'Economics',
    description: 'Micro & macro: elasticity, GDP, monetary policy, game theory.',
    icon: '📈',
    accentColor: '#b07cc4',
  },
];

function StatCard({ value, label, sublabel }: { value: number | string; label: string; sublabel?: string }) {
  return (
    <div
      style={{ backgroundColor: '#1a2436', border: '1px solid #243048' }}
      className="rounded-lg p-5"
    >
      <div style={{ color: '#c9a84c', fontFamily: 'DM Serif Display, serif', fontSize: '2.25rem', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ color: '#f0f4f8', fontSize: '13px', fontWeight: 500, marginTop: '4px' }}>{label}</div>
      {sublabel && <div style={{ color: '#8896a8', fontSize: '11px', marginTop: '2px' }}>{sublabel}</div>}
    </div>
  );
}

export default function Home() {
  const { flashcardsStudied, flashcardsKnown, quizScores, notesRead } = useStore();

  const totalCards = flashcardsData.length;
  const totalQuestions = quizData.length;
  const totalNotes = notesData.length;

  const avgScore = quizScores.length > 0
    ? Math.round((quizScores.reduce((a, b) => a + (b.score / b.total) * 100, 0) / quizScores.length))
    : 0;

  const subjectFlashcounts = subjects.map((s) => ({
    ...s,
    fcCount: flashcardsData.filter((f) => f.topic === s.title).length,
    qCount: quizData.filter((q) => q.topic === s.title).length,
    nCount: notesData.filter((n) => n.subject === s.title).length,
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div style={{ color: '#8896a8', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '8px' }}>
          Global Business Studies
        </div>
        <h1
          style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            color: '#f0f4f8',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.5px',
          }}
        >
          Your Study Dashboard
        </h1>
        <p style={{ color: '#8896a8', fontSize: '15px', marginTop: '8px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Track progress across flashcards, notes, and quizzes.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatCard value={flashcardsStudied.length} label="Cards Studied" sublabel={`of ${totalCards} total`} />
        <StatCard value={flashcardsKnown.length} label="Cards Known" sublabel="marked correct" />
        <StatCard value={avgScore > 0 ? `${avgScore}%` : '—'} label="Avg Quiz Score" sublabel={`${quizScores.length} sessions`} />
        <StatCard value={notesRead.length} label="Notes Read" sublabel={`of ${totalNotes} total`} />
      </div>

      {/* Quick access */}
      <div className="mb-10">
        <h2
          style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: '1.4rem',
            color: '#f0f4f8',
            marginBottom: '16px',
          }}
        >
          Study Modes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              to: '/flashcards',
              label: 'Flashcards',
              desc: `${totalCards} cards across 4 subjects`,
              icon: '🃏',
              stat: `${flashcardsKnown.length} known`,
            },
            {
              to: '/notes',
              label: 'Note Summaries',
              desc: `${totalNotes} chapter summaries available`,
              icon: '📄',
              stat: `${notesRead.length} read`,
            },
            {
              to: '/quiz',
              label: 'Multiple Choice Quiz',
              desc: `${totalQuestions} questions — timed & practice modes`,
              icon: '🎯',
              stat: quizScores.length > 0 ? `${avgScore}% avg score` : 'Not started',
            },
          ].map(({ to, label, desc, icon, stat }) => (
            <Link
              key={to}
              to={to}
              style={{
                backgroundColor: '#1a2436',
                border: '1px solid #243048',
                textDecoration: 'none',
                display: 'block',
                borderRadius: '12px',
                padding: '24px',
                transition: 'border-color 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#243048';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{icon}</div>
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', color: '#f0f4f8', marginBottom: '6px' }}>
                {label}
              </div>
              <div style={{ color: '#8896a8', fontSize: '13px', marginBottom: '16px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                {desc}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(201,168,76,0.1)',
                  color: '#c9a84c',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {stat}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Subject cards */}
      <div>
        <h2
          style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: '1.4rem',
            color: '#f0f4f8',
            marginBottom: '16px',
          }}
        >
          Subjects
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subjectFlashcounts.map((s) => (
            <div
              key={s.id}
              style={{ backgroundColor: '#1a2436', border: '1px solid #243048', borderRadius: '12px', overflow: 'hidden' }}
            >
              <div style={{ height: '4px', backgroundColor: s.accentColor }} />
              <div className="p-5">
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{s.icon}</div>
                <div style={{ fontFamily: 'DM Serif Display, serif', color: '#f0f4f8', fontSize: '1.05rem', marginBottom: '6px' }}>
                  {s.title}
                </div>
                <p style={{ color: '#8896a8', fontSize: '12px', lineHeight: '1.5', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: '14px' }}>
                  {s.description}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { val: s.fcCount, label: 'cards' },
                    { val: s.qCount, label: 'questions' },
                    { val: s.nCount, label: 'notes' },
                  ].map(({ val, label }) => (
                    <span
                      key={label}
                      style={{
                        backgroundColor: '#243048',
                        color: '#8896a8',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontFamily: 'IBM Plex Sans, sans-serif',
                      }}
                    >
                      {val} {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

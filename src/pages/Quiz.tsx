import { useState, useEffect } from 'react';
import { getAllQuizzes, type StoredQuiz } from '../lib/db';
import { isFirebaseConfigured, getAllCloudQuizzes } from '../lib/cloudDb';
import { useResolvedSubjects } from '../store/useSubjects';
import { useDimMode } from '../store/useDimMode';
import { useActivity } from '../store/useActivity';
import { useStore } from '../store/useStore';
import { DimModeToggle } from '../components/DimModeToggle';
import { QuizViewer } from '../components/QuizViewer';
import { SkeletonCardGrid } from '../components/Skeleton';
import type { SubjectDef } from '../data/subjects';

// ── Subject sidebar item ──────────────────────────────────────────────────────

function SubjectBtn({ subject, count, active, onClick }: {
  subject: SubjectDef | null; count: number; active: boolean; onClick: () => void;
}) {
  const color = subject?.color ?? '#3D7EFF';
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
        background: active ? color + '18' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: color,
        boxShadow: active ? `0 0 6px ${color}` : 'none',
      }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? '#E6EDF3' : '#8B949E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {subject?.title ?? 'All subjects'}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: active ? color : '#484F58' }}>
        {count}
      </span>
    </button>
  );
}

// ── Quiz card ─────────────────────────────────────────────────────────────────

function QuizCard({ quiz, color, onClick, index = 0 }: { quiz: StoredQuiz; color: string; onClick: () => void; index?: number }) {
  return (
    <button
      onClick={onClick}
      className="anim-rise"
      style={{
        ['--d' as string]: `${index * 45}ms`,
        background: '#161B22', border: '1px solid #21262D', borderRadius: '16px',
        padding: '16px', textAlign: 'left', cursor: 'pointer', width: '100%',
        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = color + '40'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', marginBottom: '12px',
        background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M7 7c0-1.1.9-2 2-2s2 .9 2 2c0 .8-.5 1.5-1.2 1.8L9 9.5V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="9" cy="13" r="0.7" fill="currentColor"/></svg>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {quiz.name}
      </div>
      <div style={{ fontSize: '11px', color: '#8B949E' }}>
        {quiz.questions.length} questions · {new Date(quiz.createdAt).toLocaleDateString()}
      </div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: '#8B949E', textAlign: 'center', gap: '12px' }}>
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="18" stroke="#30363D" strokeWidth="2"/><path d="M18 18c0-3.3 2.7-6 6-6s6 2.7 6 6c0 2.5-1.5 4.6-3.7 5.5L24 25V30" stroke="#484F58" strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="36" r="1.5" fill="#484F58"/></svg>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#E6EDF3', marginBottom: '4px' }}>No quizzes yet</div>
        <div style={{ fontSize: '13px' }}>Upload files to a subject and generate quizzes from the subject page.</div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Quiz() {
  const { allSubjects } = useResolvedSubjects();
  const [quizzes, setQuizzes] = useState<StoredQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<StoredQuiz | null>(null);
  const dim = useDimMode(s => s.dim);
  const record = useActivity(s => s.record);
  const addQuizScore = useStore(s => s.addQuizScore);

  useEffect(() => {
    const p = isFirebaseConfigured
      ? getAllCloudQuizzes().then(data => setQuizzes(data as StoredQuiz[]))
      : getAllQuizzes().then(data => setQuizzes(data.sort((a, b) => b.createdAt - a.createdAt)));
    p.finally(() => setLoading(false));
  }, []);

  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
  const subjectsWithQuizzes = allSubjects.filter(s => quizzes.some(q => q.subjectId === s.id));
  const visibleQuizzes = filterId ? quizzes.filter(q => q.subjectId === filterId) : quizzes;

  type Group = { subject: SubjectDef | undefined; quizzes: StoredQuiz[] };
  const groups: Group[] = filterId
    ? [{ subject: subjectMap.get(filterId), quizzes: visibleQuizzes }]
    : subjectsWithQuizzes.map(s => ({ subject: s, quizzes: quizzes.filter(q => q.subjectId === s.id) }));

  const activeSubject = activeQuiz ? subjectMap.get(activeQuiz.subjectId) : undefined;
  const activeColor = activeSubject?.color ?? '#3D7EFF';

  return (
    <>
    <DimModeToggle />
    <div className={`study-dim-root${dim ? ' dim-mode' : ''}`} style={{ display: 'flex', height: 'calc(100vh - 72px)', background: '#0D1117' }}>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col" style={{ width: '220px', flexShrink: 0, borderRight: '1px solid #21262D', padding: '16px 10px', gap: '2px', overflowY: 'auto' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '8px' }}>
          Quizzes
        </div>
        <SubjectBtn subject={null} count={quizzes.length} active={filterId === null} onClick={() => { setFilterId(null); setActiveQuiz(null); }} />
        {subjectsWithQuizzes.map(s => (
          <SubjectBtn key={s.id} subject={s} count={quizzes.filter(q => q.subjectId === s.id).length} active={filterId === s.id} onClick={() => { setFilterId(s.id); setActiveQuiz(null); }} />
        ))}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {activeQuiz ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button
                onClick={() => setActiveQuiz(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#8B949E', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ← All quizzes
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeSubject && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeColor, boxShadow: `0 0 6px ${activeColor}` }} />}
                <span style={{ fontSize: '11px', color: '#8B949E', fontWeight: 600 }}>
                  {activeSubject?.title ?? ''} · {activeQuiz.name} · {activeQuiz.questions.length} questions
                </span>
              </div>
            </div>
            <QuizViewer
              key={activeQuiz.id}
              questions={activeQuiz.questions}
              color={activeColor}
              quizId={activeQuiz.id}
              quizTitle={activeQuiz.name}
              subjectId={activeQuiz.subjectId}
              onExit={() => setActiveQuiz(null)}
              onComplete={(result) => {
                const name = activeSubject?.title ?? 'a subject';
                addQuizScore(activeSubject?.id ?? activeQuiz.subjectId, result.correctAnswers, result.totalQuestions);
                record({ type: 'quiz', subjectId: activeQuiz.subjectId, subjectName: name, detail: `Scored ${result.scorePercent}% on ${name} quiz` });
              }}
            />
          </div>
        ) : loading ? (
          <SkeletonCardGrid />
        ) : quizzes.length === 0 ? (
          <Empty />
        ) : (
          <div>
            {groups.map(({ subject, quizzes: groupQuizzes }) => {
              if (groupQuizzes.length === 0) return null;
              const color = subject?.color ?? '#3D7EFF';
              return (
                <div key={subject?.id ?? 'all'} style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#E6EDF3', letterSpacing: '0.06em' }}>{subject?.title ?? 'Unknown subject'}</span>
                    <span style={{ fontSize: '10px', color: '#484F58' }}>{groupQuizzes.length} quiz{groupQuizzes.length !== 1 ? 'zes' : ''}</span>
                    <div style={{ flex: 1, height: '1px', background: '#21262D' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {groupQuizzes.map((quiz, i) => (
                      <QuizCard key={quiz.id} quiz={quiz} color={color} index={i} onClick={() => setActiveQuiz(quiz)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
    </>
  );
}

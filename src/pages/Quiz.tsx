import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { getAllQuizzes, getFolders, saveQuiz, type StoredQuiz, type Folder } from '../lib/db';
import { isFirebaseConfigured, getAllCloudQuizzes, getCloudFolders, saveCloudQuiz } from '../lib/cloudDb';
import { useResolvedSubjects } from '../store/useSubjects';
import { useActivity } from '../store/useActivity';
import { useStore } from '../store/useStore';
import { QuizViewer } from '../components/QuizViewer';
import { SkeletonCardGrid } from '../components/Skeleton';
import type { SubjectDef } from '../data/subjects';

// ── Sidebar buttons ───────────────────────────────────────────────────────────

function SubjectBtn({ subject, count, active, onClick }: {
  subject: SubjectDef | null; count: number; active: boolean; onClick: () => void;
}) {
  const { ts } = useLang();
  const color = subject?.color ?? '#3D7EFF';
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
      background: active ? color + '18' : 'transparent', transition: 'background 0.15s ease',
    }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: color, boxShadow: active ? `0 0 6px ${color}` : 'none' }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? 'var(--text-1)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {subject?.title ?? ts('All subjects')}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: active ? color : 'var(--text-3)' }}>{count}</span>
    </button>
  );
}

function FolderBtn({ name, count, active, onClick, color }: {
  name: string; count: number; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px',
      padding: '7px 12px 7px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer',
      background: active ? color + '12' : 'transparent', transition: 'background 0.15s ease',
    }}>
      <svg viewBox="0 0 14 14" width="11" height="11" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.086a1 1 0 0 1 .707.293L6 3h5.5A1.5 1.5 0 0 1 13 4.5v6A1.5 1.5 0 0 1 11.5 12h-9A1.5 1.5 0 0 1 1 10.5v-7Z"
          stroke={active ? color : 'var(--text-3)'} strokeWidth="1.2" fill={active ? color + '20' : 'none'} />
      </svg>
      <span style={{ flex: 1, minWidth: 0, fontSize: '11px', fontWeight: active ? 600 : 400, color: active ? 'var(--text-1)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ fontSize: '10px', color: active ? color : 'var(--text-3)' }}>{count}</span>
    </button>
  );
}

// ── Quiz card ─────────────────────────────────────────────────────────────────

function QuizCard({ quiz, color, onClick, index = 0 }: { quiz: StoredQuiz; color: string; onClick: () => void; index?: number }) {
  const { ts } = useLang();
  return (
    <button onClick={onClick} className="anim-rise" style={{
      ['--d' as string]: `${index * 45}ms`,
      background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '16px',
      padding: '16px', textAlign: 'left', cursor: 'pointer', width: '100%',
      transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s ease, box-shadow 0.2s ease',
    }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.borderColor = color + '50'; el.style.boxShadow = `0 4px 16px ${color}14`; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.borderColor = 'var(--border-light)'; el.style.boxShadow = ''; }}
    >
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '12px', background: color + '18', border: `1px solid ${color}30`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M7 7c0-1.1.9-2 2-2s2 .9 2 2c0 .8-.5 1.5-1.2 1.8L9 9.5V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="9" cy="13" r="0.7" fill="currentColor"/></svg>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quiz.name}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{ts('{n} questions', { n: quiz.questions.length })} · {new Date(quiz.createdAt).toLocaleDateString()}</div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty() {
  const { ts } = useLang();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: 'var(--text-2)', textAlign: 'center', gap: '12px' }}>
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="18" stroke="var(--border-base)" strokeWidth="2"/><path d="M18 18c0-3.3 2.7-6 6-6s6 2.7 6 6c0 2.5-1.5 4.6-3.7 5.5L24 25V30" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="36" r="1.5" fill="var(--text-3)"/></svg>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>{ts('No quizzes yet')}</div>
        <div style={{ fontSize: '13px' }}>{ts('Upload files to a subject and generate quizzes from the subject page.')}</div>
      </div>
    </div>
  );
}

// ── Folder section (collapsible) ──────────────────────────────────────────────

function FolderSection({ name, count, color, collapsed, onToggle, children }: {
  name: string; count: number; color: string; collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: collapsed ? 0 : '12px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
        <svg viewBox="0 0 14 14" width="14" height="14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.086a1 1 0 0 1 .707.293L6 3h5.5A1.5 1.5 0 0 1 13 4.5v6A1.5 1.5 0 0 1 11.5 12h-9A1.5 1.5 0 0 1 1 10.5v-7Z"
            stroke={color} strokeWidth="1.2" fill={color + '18'} />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{name}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>{count}</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
        <svg viewBox="0 0 10 10" width="10" height="10" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="var(--text-3)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!collapsed && children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Quiz() {
  const { ts } = useLang();
  const { allSubjects } = useResolvedSubjects();
  const [quizzes, setQuizzes] = useState<StoredQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | 'unfiled' | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<StoredQuiz | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const record = useActivity(s => s.record);
  const addQuizScore = useStore(s => s.addQuizScore);

  const toggleFolder = (id: string) => setCollapsedFolders(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    const loadData = isFirebaseConfigured
      ? getAllCloudQuizzes().then(data => data as StoredQuiz[])
      : getAllQuizzes().then(data => data.sort((a, b) => b.createdAt - a.createdAt));

    loadData.then(data => {
      setQuizzes(data);
      const subjectIds = [...new Set(data.map(q => q.subjectId))];
      return Promise.all(subjectIds.map(id => isFirebaseConfigured
        ? getCloudFolders(id).then(f => f as Folder[])
        : getFolders(id)
      ));
    }).then(results => setFolders(results.flat())).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setFolderFilter(null); }, [filterId]);

  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
  const subjectsWithQuizzes = allSubjects.filter(s => quizzes.some(q => q.subjectId === s.id));
  const quizFolders = folders.filter(f => f.kind === 'quiz');
  const subjectQuizFolders = filterId ? quizFolders.filter(f => f.subjectId === filterId) : [];

  const visibleQuizzes = (() => {
    if (!filterId) return quizzes;
    const sq = quizzes.filter(q => q.subjectId === filterId);
    if (folderFilter === 'unfiled') return sq.filter(q => !q.folderId || !subjectQuizFolders.some(f => f.id === q.folderId));
    if (folderFilter) return sq.filter(q => q.folderId === folderFilter);
    return sq;
  })();

  const activeSubject = activeQuiz ? subjectMap.get(activeQuiz.subjectId) : undefined;
  const activeColor = activeSubject?.color ?? '#3D7EFF';
  const selectedSubject = filterId ? subjectMap.get(filterId) : undefined;
  const selectedColor = selectedSubject?.color ?? '#3D7EFF';

  const countForFolder = (subjectId: string, folderId: string) =>
    quizzes.filter(q => q.subjectId === subjectId && q.folderId === folderId).length;
  const countUnfiledFor = (subjectId: string) => {
    const sf = quizFolders.filter(f => f.subjectId === subjectId);
    return quizzes.filter(q => q.subjectId === subjectId && (!q.folderId || !sf.some(f => f.id === q.folderId))).length;
  };

  const renderQuizGrid = (groupQuizzes: StoredQuiz[], subjectId: string, color: string) => {
    const sf = quizFolders.filter(f => f.subjectId === subjectId);
    if (sf.length === 0) {
      return (
        <div className="quiz-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {groupQuizzes.map((quiz, i) => <QuizCard key={quiz.id} quiz={quiz} color={color} index={i} onClick={() => setActiveQuiz(quiz)} />)}
        </div>
      );
    }
    const unfiledQuizzes = groupQuizzes.filter(q => !q.folderId || !sf.some(f => f.id === q.folderId));
    return (
      <>
        {sf.map(folder => {
          const folderQuizzes = groupQuizzes.filter(q => q.folderId === folder.id);
          if (folderQuizzes.length === 0) return null;
          const isCollapsed = collapsedFolders.has(folder.id);
          return (
            <FolderSection key={folder.id} name={folder.name} count={folderQuizzes.length} color={color} collapsed={isCollapsed} onToggle={() => toggleFolder(folder.id)}>
              <div className="quiz-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {folderQuizzes.map((quiz, i) => <QuizCard key={quiz.id} quiz={quiz} color={color} index={i} onClick={() => setActiveQuiz(quiz)} />)}
              </div>
            </FolderSection>
          );
        })}
        {unfiledQuizzes.length > 0 && (
          <FolderSection name={ts('Unfiled')} count={unfiledQuizzes.length} color="#94a3b8" collapsed={collapsedFolders.has(`${subjectId}:unfiled`)} onToggle={() => toggleFolder(`${subjectId}:unfiled`)}>
            <div className="quiz-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {unfiledQuizzes.map((quiz, i) => <QuizCard key={quiz.id} quiz={quiz} color={color} index={i} onClick={() => setActiveQuiz(quiz)} />)}
            </div>
          </FolderSection>
        )}
      </>
    );
  };

  const renderMain = () => {
    if (loading) return <SkeletonCardGrid />;
    if (quizzes.length === 0) return <Empty />;
    if (visibleQuizzes.length === 0) return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>{ts('No quizzes here')}</div>
        <div style={{ fontSize: '13px' }}>{ts('This folder is empty.')}</div>
      </div>
    );

    if (!filterId) {
      return (
        <div>
          {subjectsWithQuizzes.map(s => {
            const groupQuizzes = quizzes.filter(q => q.subjectId === s.id);
            if (groupQuizzes.length === 0) return null;
            const color = s.color ?? '#3D7EFF';
            return (
              <div key={s.id} style={{ marginBottom: '36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.06em' }}>{s.title}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{groupQuizzes.length !== 1 ? ts('{n} quizzes', { n: groupQuizzes.length }) : ts('{n} quiz', { n: groupQuizzes.length })}</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                </div>
                {renderQuizGrid(groupQuizzes, s.id, color)}
              </div>
            );
          })}
        </div>
      );
    }

    if (folderFilter) {
      return (
        <div className="quiz-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {visibleQuizzes.map((quiz, i) => <QuizCard key={quiz.id} quiz={quiz} color={selectedColor} index={i} onClick={() => setActiveQuiz(quiz)} />)}
        </div>
      );
    }

    return renderQuizGrid(visibleQuizzes, filterId, selectedColor);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 76px)', background: 'var(--bg-page)' }}>
      <aside className="hidden md:flex flex-col" style={{
        width: activeQuiz ? '0' : '220px', flexShrink: 0,
        borderRight: activeQuiz ? 'none' : '1px solid var(--border-light)',
        padding: activeQuiz ? '0' : '16px 10px',
        gap: '2px', overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.25s ease, padding 0.25s ease',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '0 10px', marginBottom: '8px' }}>
          {ts('Quizzes')}
        </div>
        <SubjectBtn subject={null} count={quizzes.length} active={filterId === null}
          onClick={() => { setFilterId(null); setActiveQuiz(null); }} />
        {subjectsWithQuizzes.map(s => {
          const isSelected = filterId === s.id;
          const color = s.color ?? '#3D7EFF';
          const sf = quizFolders.filter(f => f.subjectId === s.id);
          return (
            <div key={s.id}>
              <SubjectBtn subject={s} count={quizzes.filter(q => q.subjectId === s.id).length}
                active={isSelected && folderFilter === null}
                onClick={() => { setFilterId(s.id); setFolderFilter(null); setActiveQuiz(null); }} />
              {isSelected && sf.length > 0 && (
                <div style={{ marginTop: '2px', marginBottom: '2px' }}>
                  {sf.map(folder => (
                    <FolderBtn key={folder.id} name={folder.name} count={countForFolder(s.id, folder.id)}
                      active={folderFilter === folder.id} color={color}
                      onClick={() => { setFolderFilter(folder.id); setActiveQuiz(null); }} />
                  ))}
                  {countUnfiledFor(s.id) > 0 && (
                    <FolderBtn name={ts('Unfiled')} count={countUnfiledFor(s.id)}
                      active={folderFilter === 'unfiled'} color={color}
                      onClick={() => { setFolderFilter('unfiled'); setActiveQuiz(null); }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(14px, 4vw, 28px)' }}>
        {activeQuiz ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button onClick={() => setActiveQuiz(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                ← {ts('All quizzes')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeSubject && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeColor, boxShadow: `0 0 6px ${activeColor}` }} />}
                <span style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 600 }}>
                  {activeSubject?.title ?? ''} · {activeQuiz.name} · {ts('{n} questions', { n: activeQuiz.questions.length })}
                </span>
              </div>
            </div>
            <QuizViewer key={activeQuiz.id} questions={activeQuiz.questions} color={activeColor}
              quizId={activeQuiz.id} quizTitle={activeQuiz.name} subjectId={activeQuiz.subjectId}
              onExit={() => setActiveQuiz(null)}
              onComplete={(result) => {
                const name = activeSubject?.title ?? ts('a subject');
                addQuizScore(activeSubject?.id ?? activeQuiz.subjectId, result.correctAnswers, result.totalQuestions);
                record({ type: 'quiz', subjectId: activeQuiz.subjectId, subjectName: name, detail: ts('Scored {percent}% on {name} quiz', { percent: result.scorePercent, name }) });
              }}
              onQuestionDelete={(questionId) => {
                const updated = { ...activeQuiz, questions: activeQuiz.questions.filter(qq => qq.id !== questionId) };
                if (isFirebaseConfigured) saveCloudQuiz(updated).catch(() => {});
                else saveQuiz(updated).catch(() => {});
                setActiveQuiz(updated);
                setQuizzes(prev => prev.map(q => q.id === updated.id ? updated : q));
              }}
              onQuestionEdit={(questionId, draft) => {
                const updated = {
                  ...activeQuiz,
                  questions: activeQuiz.questions.map(qq => qq.id === questionId
                    ? { ...qq, question: draft.question, options: draft.options, correct: draft.correct }
                    : qq),
                };
                if (isFirebaseConfigured) saveCloudQuiz(updated).catch(() => {});
                else saveQuiz(updated).catch(() => {});
                setActiveQuiz(updated);
                setQuizzes(prev => prev.map(q => q.id === updated.id ? updated : q));
              }} />
          </div>
        ) : renderMain()}
      </main>
    </div>
  );
}

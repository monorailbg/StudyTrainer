import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLang, type TKey } from '../context/LanguageContext';
import { ALL_SUBJECTS } from '../data/subjects';
import { generateFromFile } from '../lib/geminiGenerator';
import { saveFile, getFiles, deleteFile, saveContent, getContent, saveQuiz, getQuizzes, deleteQuiz, type StoredQuiz } from '../lib/db';
import type {
  GenerationType,
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
} from '../lib/generator';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { NotesViewer } from '../components/NotesViewer';
import { QuizViewer } from '../components/QuizViewer';

// ── Error helper ───────────────────────────────────────────────────────────────

function friendlyError(raw?: string): string {
  if (!raw) return 'Generation failed.';
  if (raw.includes('not set')) return 'Gemini API key not configured. Enter your key in the banner above.';
  if (raw.includes('401') || raw.includes('API_KEY_INVALID')) return 'Invalid or expired API key.';
  if (raw.includes('RESOURCE_EXHAUSTED')) return 'Quota exhausted — check your Gemini API plan.';
  if (raw.includes('429')) return 'Rate limit hit. Wait 60 seconds and try again.';
  if (raw.includes('400')) return 'File too large or unsupported format.';
  return `Generation failed: ${raw.slice(0, 140)}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface UploadedFile {
  id: string; name: string; type: string; size: number;
  url: string; rawFile: File; level: string;
}

type GenStatus = 'idle' | 'generating' | 'done' | 'error';
interface GenState { status: GenStatus; type?: GenerationType; error?: string; }
interface GenProgress { current: number; total: number; }

interface GeneratedContent {
  flashcards?: GeneratedFlashcard[];
  notes?: GeneratedNote;
  quiz?: GeneratedQuizQuestion[];
  sourceFileId?: string;
}

type View = 'dashboard' | 'upload' | 'flashcards' | 'notes' | 'quiz';

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// ── Mini icons ─────────────────────────────────────────────────────────────────

const IconDash  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>);
const IconFile  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><path d="M4 2h7l4 4v10H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M11 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>);
const IconCards = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="1" y="4" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/><rect x="4" y="2" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>);
const IconNote  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><path d="M3 2h9l4 4v10H3V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 9h8M5 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);
const IconQuiz  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 7c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5c0 1.25-1.25 1.75-2.5 2.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="9" cy="13" r=".9" fill="currentColor"/></svg>);
const IconPlus  = () => (<svg viewBox="0 0 18 18" width="14" height="14" fill="none"><path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IconSparkle = () => (<svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M8 1v4M8 11v4M1 8h4M11 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M3.22 3.22l2.83 2.83M9.95 9.95l2.83 2.83M3.22 12.78l2.83-2.83M9.95 6.05l2.83-2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);

const Spinner = ({ color }: { color: string }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
    <circle cx="8" cy="8" r="6" stroke={color + '30'} strokeWidth="2"/>
    <path d="M8 2a6 6 0 016 6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

// ── Sidebar item ───────────────────────────────────────────────────────────────

function SidebarItem({
  icon, label, sublabel, active, dot, dotColor, onClick,
}: {
  icon: React.ReactNode; label: string; sublabel?: string;
  active: boolean; dot?: boolean; dotColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-200 cursor-pointer border-none"
      style={{
        borderRadius: '14px',
        background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: active ? '#E6EDF3' : '#8B949E',
      }}
    >
      <span style={{ flexShrink: 0, color: active ? '#E6EDF3' : '#8B949E' }}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium leading-tight truncate">{label}</span>
        {sublabel && <span className="block text-[10px] mt-0.5 leading-tight" style={{ color: active ? '#8B949E' : '#484F58' }}>{sublabel}</span>}
      </span>
      {dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor || '#3D7EFF', boxShadow: `0 0 5px ${dotColor || '#3D7EFF'}` }} />}
    </button>
  );
}

// ── Content header ─────────────────────────────────────────────────────────────

function ContentHeader({ label, onRegenerate, t, children }: {
  label: string; onRegenerate: () => void; t: (k: TKey) => string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>{label}</div>
        <button onClick={onRegenerate} className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0" style={{ color: '#3D7EFF' }}>
          {t('gen_regenerate')} →
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ color, onUpload }: { color: string; onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full" style={{ minHeight: '300px' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '20px',
        background: color + '18', border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
      }}>
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
          <path d="M12 16V8M12 8l-4 4M12 8l4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 20h12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="text-sm font-semibold mb-2" style={{ color: '#E6EDF3' }}>No content yet</div>
      <div className="text-xs mb-5 text-center max-w-xs" style={{ color: '#8B949E' }}>
        Upload a file and use AI to generate flashcards, notes, or a quiz.
      </div>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 h-9 px-5 text-xs font-semibold border cursor-pointer transition-all duration-300"
        style={{ borderRadius: '999px', background: color + '18', color, borderColor: color + '35' }}
      >
        <IconPlus /> Add Files
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const subject = ALL_SUBJECTS.find(s => s.id === id);

  const [activeLevel, setActiveLevel] = useState(subject?.levels?.[0] ?? '');
  const [view, setView] = useState<View>('dashboard');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<GenerationType>('flashcards');
  const [genState, setGenState] = useState<GenState>({ status: 'idle' });
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});
  const [quizCount, setQuizCount] = useState(10);
  const [savedQuizzes, setSavedQuizzes] = useState<StoredQuiz[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  // Refs so async callbacks always read the latest values without stale closures
  const generatedContentRef = useRef<GeneratedContent>({});
  generatedContentRef.current = generatedContent;
  const filesRef = useRef<UploadedFile[]>([]);
  filesRef.current = files;

  // ── Load persisted data when subject changes ───────────────────────────────
  useEffect(() => {
    if (!id) return;

    // Reset all state when navigating to a different subject
    setFiles([]);
    setSelectedFileIds([]);
    setGeneratedContent({});
    setSavedQuizzes([]);
    setActiveQuizId(null);
    setView('dashboard');
    setGenState({ status: 'idle' });

    async function loadPersisted() {
      try {
        const [storedFiles, storedContent, storedQuizzes] = await Promise.all([
          getFiles(id!),
          getContent(id!),
          getQuizzes(id!),
        ]);

        if (storedQuizzes.length > 0) {
          setSavedQuizzes(storedQuizzes.sort((a, b) => b.createdAt - a.createdAt));
        }

        if (storedFiles.length > 0) {
          const mapped: UploadedFile[] = storedFiles.map(sf => ({
            id:      sf.id,
            name:    sf.name,
            type:    sf.type,
            size:    sf.size,
            url:     URL.createObjectURL(sf.blob),
            rawFile: new File([sf.blob], sf.name, { type: sf.type }),
            level:   sf.level,
          }));
          setFiles(mapped);
          setSelectedFileIds(mapped.map(f => f.id));
        }

        if (storedContent) {
          setGeneratedContent({
            flashcards: storedContent.flashcards as GeneratedFlashcard[] | undefined,
            notes:      storedContent.notes      as GeneratedNote        | undefined,
          });
        }
      } catch (err) {
        console.error('Failed to load persisted subject data:', err);
      }
    }

    loadPersisted();

    return () => {
      // Revoke blob URLs when leaving this subject
      filesRef.current.forEach(f => URL.revokeObjectURL(f.url));
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File management ────────────────────────────────────────────────────────
  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => ACCEPTED.includes(f.type));
    const mapped: UploadedFile[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name, type: f.type, size: f.size,
      url: URL.createObjectURL(f), rawFile: f, level: activeLevel,
    }));
    setFiles(prev => [...prev, ...mapped]);
    setSelectedFileIds(prev => [...prev, ...mapped.map(m => m.id)]);
    // Persist blobs to IndexedDB
    for (const file of mapped) {
      await saveFile({ id: file.id, subjectId: id!, name: file.name, type: file.type, size: file.size, level: file.level, blob: file.rawFile }).catch(() => {});
    }
  }, [activeLevel, id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === fileId);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter(x => x.id !== fileId);
    });
    setSelectedFileIds(prev => prev.filter(fid => fid !== fileId));
    deleteFile(fileId).catch(() => {});
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(fid => fid !== fileId) : [...prev, fileId]
    );
  };

  const removeQuiz = (quizId: string) => {
    setSavedQuizzes(prev => prev.filter(q => q.id !== quizId));
    if (activeQuizId === quizId) setActiveQuizId(null);
    deleteQuiz(quizId).catch(() => {});
  };

  // ── Generation ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const selectedFiles = levelFiles.filter(f => selectedFileIds.includes(f.id));
    if (selectedFiles.length === 0) return;
    try {
      setGenState({ status: 'generating', type: selectedType });
      setGenProgress({ current: 0, total: selectedFiles.length });

      const results: unknown[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        setGenProgress({ current: i + 1, total: selectedFiles.length });
        const result = await generateFromFile(selectedFiles[i].rawFile, selectedType, subject!.title, quizCount);
        results.push(result);
      }

      if (selectedType === 'quiz') {
        // Each generation is saved as its own quiz in the "previous quizzes" folder
        const allQuestions = (results as GeneratedQuizQuestion[][]).flat().map((q, i) => ({ ...q, id: `m${i}-${q.id}` }));
        const baseNames = selectedFiles.map(f => f.name.replace(/\.[^.]+$/, ''));
        const name = baseNames.length === 1
          ? baseNames[0]
          : `${baseNames[0]} +${baseNames.length - 1} more`;
        const quiz: StoredQuiz = {
          id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          subjectId: id!,
          name,
          createdAt: Date.now(),
          questions: allQuestions,
        };
        await saveQuiz(quiz).catch(() => {});
        setSavedQuizzes(prev => [quiz, ...prev]);
        setActiveQuizId(quiz.id);
      } else {
        // Flashcards / notes are merged into the subject's single content record
        let newPart: Partial<GeneratedContent>;
        if (selectedType === 'flashcards') {
          newPart = { flashcards: (results as GeneratedFlashcard[][]).flat() };
        } else if (results.length === 1) {
          newPart = { notes: results[0] as GeneratedNote };
        } else {
          const sections = (results as GeneratedNote[]).flatMap(n => n.sections);
          newPart = { notes: { title: subject!.title, summary: `Combined notes from ${results.length} files.`, sections } };
        }
        const nextContent: GeneratedContent = { ...generatedContentRef.current, ...newPart };
        setGeneratedContent(nextContent);
        await saveContent(id!, nextContent as Record<string, unknown>).catch(() => {});
      }

      setGenState({ status: 'done', type: selectedType });
      setView(selectedType);
    } catch (err) {
      setGenState({ status: 'error', type: selectedType, error: String(err) });
    } finally {
      setGenProgress(null);
    }
  };

  if (!subject) {
    return (
      <div className="text-center py-20 px-6">
        <div className="text-2xl mb-3" style={{ fontFamily: "'Sora',sans-serif", color: '#E6EDF3' }}>Subject not found</div>
        <Link to="/" className="text-sm no-underline" style={{ color: '#3D7EFF' }}>{t('back')}</Link>
      </div>
    );
  }

  const levelFiles = files.filter(f => !subject.levels || f.level === activeLevel);
  const isGenerating = genState.status === 'generating';
  const selectedLevelFileIds = selectedFileIds.filter(id => levelFiles.some(f => f.id === id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 76px)' }}>

      {/* ── Header strip ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0 px-4 py-3 md:px-7 md:py-4" style={{
        borderBottom: '1px solid #21262D',
        background: '#0D1117',
      }}>
        <Link to="/" style={{ color: '#8B949E', textDecoration: 'none', fontSize: '12px', flexShrink: 0 }}>
          ←
        </Link>
        <div style={{ width: '1px', height: '14px', background: '#30363D', flexShrink: 0 }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: subject.color, boxShadow: `0 0 8px ${subject.color}`, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '15px', color: '#E6EDF3' }}>
            {subject.title}
          </span>
          <span className="hidden sm:inline" style={{ fontSize: '12px', color: '#8B949E', marginLeft: '10px' }}>
            {subject.description}
          </span>
        </div>
        {/* Level tabs */}
        {subject.levels && (
          <div className="flex gap-1 overflow-x-auto flex-shrink-0" style={{ maxWidth: '200px' }}>
            {subject.levels.map(level => (
              <button
                key={level}
                onClick={() => setActiveLevel(level)}
                className="h-7 px-3 text-xs font-medium border cursor-pointer transition-all duration-200 flex-shrink-0"
                style={{
                  borderRadius: '999px',
                  background: activeLevel === level ? subject.color + '20' : 'transparent',
                  color:      activeLevel === level ? subject.color          : '#8B949E',
                  borderColor: activeLevel === level ? subject.color + '45'  : '#30363D',
                }}
              >
                {level}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile tab strip (hidden on md+) ─────────────────────────────────── */}
      <div className="md:hidden flex items-center gap-1 px-3 py-2 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #21262D', background: '#0D1117' }}>
        {([
          { id: 'dashboard',  label: 'Overview', dot: false },
          { id: 'upload',     label: 'Files',    dot: false },
          { id: 'flashcards', label: 'Cards',    dot: !!generatedContent.flashcards },
          { id: 'notes',      label: 'Notes',    dot: !!generatedContent.notes },
          { id: 'quiz',       label: 'Quizzes',  dot: savedQuizzes.length > 0 },
        ] as { id: View; label: string; dot: boolean }[]).map(({ id, label, dot }) => (
          <button
            key={id}
            onClick={() => { if (id === 'quiz') setActiveQuizId(null); setView(id); }}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold flex-shrink-0 cursor-pointer border transition-all duration-200"
            style={{
              borderRadius: '999px',
              background:  view === id ? subject.color + '20' : 'transparent',
              color:       view === id ? subject.color : '#8B949E',
              borderColor: view === id ? subject.color + '45' : 'transparent',
            }}
          >
            {dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: subject.color, flexShrink: 0 }} />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Sidebar + content ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left sidebar — hidden on mobile */}
        <aside className="hidden md:flex flex-col" style={{
          width: '260px',
          flexShrink: 0,
          borderRight: '1px solid #21262D',
          background: '#0D1117',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
          gap: '2px',
          overflowY: 'auto',
        }}>
          {/* Overview / dashboard */}
          <div style={{ marginBottom: '8px' }}>
            <SidebarItem
              icon={<IconDash />}
              label="Overview"
              sublabel="Subject dashboard"
              active={view === 'dashboard'}
              onClick={() => setView('dashboard')}
            />
          </div>

          {/* Upload / files section */}
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '4px' }}>
              Files
            </div>

            <SidebarItem
              icon={<IconPlus />}
              label="Add Files"
              active={view === 'upload' && levelFiles.length === 0}
              onClick={() => { setView('upload'); }}
            />

            {levelFiles.map(file => {
              const isFileSelected = selectedFileIds.includes(file.id);
              return (
                <div key={file.id}>
                  <SidebarItem
                    icon={<IconFile />}
                    label={file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name}
                    sublabel={`${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.type === 'application/pdf' ? 'PDF' : 'Image'}`}
                    active={view === 'upload'}
                    dot={isFileSelected}
                    dotColor={subject.color}
                    onClick={() => { toggleFileSelection(file.id); setView('upload'); }}
                  />
                </div>
              );
            })}
          </div>

          {/* Generated content section */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '4px' }}>
              Content
            </div>

            <SidebarItem
              icon={<IconCards />}
              label={t('nav_flashcards')}
              sublabel={generatedContent.flashcards ? `${generatedContent.flashcards.length} cards` : 'Not generated'}
              active={view === 'flashcards'}
              dot={!!generatedContent.flashcards}
              dotColor={subject.color}
              onClick={() => setView('flashcards')}
            />
            <SidebarItem
              icon={<IconNote />}
              label={t('nav_notes')}
              sublabel={generatedContent.notes ? `${generatedContent.notes.sections.length} sections` : 'Not generated'}
              active={view === 'notes'}
              dot={!!generatedContent.notes}
              dotColor={subject.color}
              onClick={() => setView('notes')}
            />
            <SidebarItem
              icon={<IconQuiz />}
              label="Quizzes"
              sublabel={savedQuizzes.length > 0 ? `${savedQuizzes.length} saved` : 'None yet'}
              active={view === 'quiz' && !activeQuizId}
              dot={savedQuizzes.length > 0}
              dotColor={subject.color}
              onClick={() => { setActiveQuizId(null); setView('quiz'); }}
            />
          </div>

          {/* Previous quizzes folder */}
          {savedQuizzes.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '4px' }}>
                Previous Quizzes
              </div>
              {savedQuizzes.map(quiz => (
                <SidebarItem
                  key={quiz.id}
                  icon={<IconQuiz />}
                  label={quiz.name}
                  sublabel={`${quiz.questions.length} questions`}
                  active={view === 'quiz' && activeQuizId === quiz.id}
                  dot={view === 'quiz' && activeQuizId === quiz.id}
                  dotColor={subject.color}
                  onClick={() => { setActiveQuizId(quiz.id); setView('quiz'); }}
                />
              ))}
            </div>
          )}

          {/* Generate panel in sidebar */}
          {levelFiles.length > 0 && (
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #21262D' }}>
              <div className="flex items-center justify-between px-1 mb-2">
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58' }}>
                  Generate
                </div>
                <div style={{ fontSize: '9px', color: selectedLevelFileIds.length > 0 ? subject.color : '#484F58', fontWeight: 600 }}>
                  {selectedLevelFileIds.length}/{levelFiles.length} selected
                </div>
              </div>

              {/* Type selector */}
              <div className="flex gap-1.5 flex-wrap px-1 mb-3">
                {(['flashcards', 'notes', 'quiz'] as GenerationType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="h-7 px-2.5 text-[10px] border cursor-pointer transition-all duration-200 font-semibold"
                    style={{
                      borderRadius: '999px',
                      background:   selectedType === type ? subject.color + '20' : 'transparent',
                      color:        selectedType === type ? subject.color          : '#8B949E',
                      borderColor:  selectedType === type ? subject.color + '50'   : '#30363D',
                    }}
                  >
                    {type === 'flashcards' ? 'Cards' : type === 'notes' ? 'Notes' : 'Quiz'}
                  </button>
                ))}
              </div>

              {/* Question count — only for quizzes, chosen before generation */}
              {selectedType === 'quiz' && (
                <div className="px-1 mb-3">
                  <div style={{ fontSize: '9px', color: '#8B949E', marginBottom: '6px', fontWeight: 600 }}>
                    Questions per file
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[5, 10, 15, 20].map(n => (
                      <button
                        key={n}
                        onClick={() => setQuizCount(n)}
                        className="h-7 w-9 text-[11px] border cursor-pointer transition-all duration-200 font-semibold"
                        style={{
                          borderRadius: '999px',
                          background:   quizCount === n ? subject.color + '20' : 'transparent',
                          color:        quizCount === n ? subject.color          : '#8B949E',
                          borderColor:  quizCount === n ? subject.color + '50'   : '#30363D',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedLevelFileIds.length === 0}
                className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all duration-300"
                style={{
                  borderRadius: '999px',
                  background:   isGenerating ? '#1F2937' : subject.color + '18',
                  color:        isGenerating ? '#8B949E' : subject.color,
                  borderColor:  isGenerating ? '#30363D' : subject.color + '45',
                }}
              >
                {isGenerating ? <><Spinner color={subject.color} /> Generating…</> : <><IconSparkle /> Generate {selectedType === 'quiz' ? `${quizCount} Q` : ''}</>}
              </button>

              {isGenerating && genProgress && genProgress.total > 1 && (
                <div className="mt-2 text-center text-[10px]" style={{ color: '#8B949E' }}>
                  File {genProgress.current} of {genProgress.total}…
                </div>
              )}

              {genState.status === 'error' && (
                <div className="mt-2 px-1 text-[10px] leading-relaxed" style={{ color: '#f87171' }}>
                  {friendlyError(genState.error)}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8" style={{ background: '#0D1117' }}>

          {/* Mobile generate strip */}
          {levelFiles.length > 0 && (
            <div className="md:hidden flex items-center gap-2 p-3 mb-4 flex-wrap" style={{ background: '#161B22', borderRadius: '16px', border: '1px solid #21262D' }}>
              {(['flashcards', 'notes', 'quiz'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className="h-7 px-3 text-[10px] font-semibold border cursor-pointer transition-all duration-200"
                  style={{
                    borderRadius: '999px',
                    background:  selectedType === type ? subject.color + '20' : 'transparent',
                    color:       selectedType === type ? subject.color : '#8B949E',
                    borderColor: selectedType === type ? subject.color + '45' : '#30363D',
                  }}
                >
                  {type === 'flashcards' ? 'Cards' : type === 'notes' ? 'Notes' : 'Quiz'}
                </button>
              ))}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedLevelFileIds.length === 0}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all duration-200 ml-auto"
                style={{
                  borderRadius: '999px',
                  background:  isGenerating ? '#1F2937' : subject.color + '18',
                  color:       isGenerating ? '#8B949E' : subject.color,
                  borderColor: isGenerating ? '#30363D' : subject.color + '45',
                }}
              >
                {isGenerating ? <><Spinner color={subject.color} /> Generating…</> : <><IconSparkle /> Generate {selectedType === 'quiz' ? `${quizCount} Q` : ''}</>}
              </button>

              {/* Question count — only for quizzes */}
              {selectedType === 'quiz' && (
                <div className="w-full flex items-center gap-1.5 flex-wrap">
                  <span style={{ fontSize: '9px', color: '#8B949E', fontWeight: 600 }}>Questions/file:</span>
                  {[5, 10, 15, 20].map(n => (
                    <button
                      key={n}
                      onClick={() => setQuizCount(n)}
                      className="h-6 w-8 text-[10px] border cursor-pointer transition-all duration-200 font-semibold"
                      style={{
                        borderRadius: '999px',
                        background:  quizCount === n ? subject.color + '20' : 'transparent',
                        color:       quizCount === n ? subject.color : '#8B949E',
                        borderColor: quizCount === n ? subject.color + '50' : '#30363D',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {genState.status === 'error' && (
                <div className="w-full text-[10px] leading-relaxed" style={{ color: '#f87171' }}>
                  {friendlyError(genState.error)}
                </div>
              )}
            </div>
          )}

          {/* Dashboard view */}
          {view === 'dashboard' && (
            <div>
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '20px', color: '#E6EDF3', marginBottom: '4px' }}>
                  {subject.title}
                </div>
                <div style={{ fontSize: '13px', color: '#8B949E' }}>{subject.description}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>

                {/* Files tile */}
                <button
                  onClick={() => setView('upload')}
                  style={{
                    background: '#161B22', border: '1px solid #21262D',
                    borderRadius: '20px', padding: '20px',
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.01)'; (e.currentTarget as HTMLElement).style.borderColor = subject.color + '40'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: subject.color + '18', color: subject.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '14px',
                  }}>
                    <IconFile />
                  </div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '14px', color: '#E6EDF3', marginBottom: '4px' }}>
                    Files
                  </div>
                  <div style={{ fontSize: '12px', color: levelFiles.length > 0 ? subject.color : '#484F58', fontWeight: 600 }}>
                    {levelFiles.length > 0 ? `${levelFiles.length} uploaded` : 'No files yet'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#484F58', marginTop: '2px' }}>
                    {levelFiles.length > 0 ? 'Click to manage' : 'Upload to get started'}
                  </div>
                </button>

                {/* Notes tile */}
                <button
                  onClick={() => setView('notes')}
                  style={{
                    background: '#161B22', border: '1px solid #21262D',
                    borderRadius: '20px', padding: '20px',
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.01)'; (e.currentTarget as HTMLElement).style.borderColor = subject.color + '40'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: generatedContent.notes ? subject.color + '18' : '#1F2937',
                    color: generatedContent.notes ? subject.color : '#484F58',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '14px',
                  }}>
                    <IconNote />
                  </div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '14px', color: '#E6EDF3', marginBottom: '4px' }}>
                    Notes
                  </div>
                  <div style={{ fontSize: '12px', color: generatedContent.notes ? subject.color : '#484F58', fontWeight: 600 }}>
                    {generatedContent.notes ? `${generatedContent.notes.sections.length} sections` : 'Not generated'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#484F58', marginTop: '2px' }}>
                    {generatedContent.notes ? 'AI structured notes' : 'Generate from files'}
                  </div>
                </button>

                {/* Flashcards tile */}
                <button
                  onClick={() => setView('flashcards')}
                  style={{
                    background: '#161B22', border: '1px solid #21262D',
                    borderRadius: '20px', padding: '20px',
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.01)'; (e.currentTarget as HTMLElement).style.borderColor = subject.color + '40'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: generatedContent.flashcards ? subject.color + '18' : '#1F2937',
                    color: generatedContent.flashcards ? subject.color : '#484F58',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '14px',
                  }}>
                    <IconCards />
                  </div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '14px', color: '#E6EDF3', marginBottom: '4px' }}>
                    Flashcards
                  </div>
                  <div style={{ fontSize: '12px', color: generatedContent.flashcards ? subject.color : '#484F58', fontWeight: 600 }}>
                    {generatedContent.flashcards ? `${generatedContent.flashcards.length} cards` : 'Not generated'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#484F58', marginTop: '2px' }}>
                    {generatedContent.flashcards ? 'Ready to study' : 'Generate from files'}
                  </div>
                </button>

                {/* Quizzes tile */}
                <button
                  onClick={() => { setActiveQuizId(null); setView('quiz'); }}
                  style={{
                    background: '#161B22', border: '1px solid #21262D',
                    borderRadius: '20px', padding: '20px',
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.01)'; (e.currentTarget as HTMLElement).style.borderColor = subject.color + '40'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: savedQuizzes.length > 0 ? subject.color + '18' : '#1F2937',
                    color: savedQuizzes.length > 0 ? subject.color : '#484F58',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '14px',
                  }}>
                    <IconQuiz />
                  </div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '14px', color: '#E6EDF3', marginBottom: '4px' }}>
                    Quizzes
                  </div>
                  <div style={{ fontSize: '12px', color: savedQuizzes.length > 0 ? subject.color : '#484F58', fontWeight: 600 }}>
                    {savedQuizzes.length > 0 ? `${savedQuizzes.length} saved` : 'None yet'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#484F58', marginTop: '2px' }}>
                    {savedQuizzes.length > 0 ? 'Test your knowledge' : 'Generate from files'}
                  </div>
                </button>

              </div>
            </div>
          )}

          {/* Upload view */}
          {view === 'upload' && (
            <>
              <div
                role="button" tabIndex={0} aria-label="Upload files"
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                className="text-center cursor-pointer outline-none transition-all duration-300 p-8 sm:p-14"
                style={{
                  border: `2px dashed ${isDragging ? subject.color : '#30363D'}`,
                  borderRadius: '24px',
                  background: isDragging ? subject.color + '08' : '#161B22',
                  marginBottom: '20px',
                  transform: isDragging ? 'scale(1.01)' : 'scale(1)',
                }}
              >
                <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*"
                  className="hidden" aria-hidden="true"
                  onChange={e => e.target.files && addFiles(e.target.files)} />

                <div style={{
                  width: '52px', height: '52px', borderRadius: '18px',
                  background: subject.color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 18px',
                }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                    <path d="M12 16V8M12 8l-4 4M12 8l4 4" stroke={subject.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 20h12" stroke={subject.color} strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>

                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '16px', color: isDragging ? subject.color : '#E6EDF3', marginBottom: '6px' }}>
                  {isDragging ? t('drop_active') : t('upload_title')}
                </div>
                <div style={{ fontSize: '13px', color: '#8B949E', marginBottom: '16px' }}>
                  {t('upload_desc')}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: '#1F2937', border: '1px solid #30363D',
                  borderRadius: '999px', padding: '3px 10px',
                  fontSize: '11px', color: '#8B949E',
                }}>
                  {t('file_types')}
                </span>
              </div>

              {/* File list */}
              {levelFiles.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B949E' }}>
                      {t('uploaded_files')} ({levelFiles.length})
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedFileIds(levelFiles.map(f => f.id))}
                        style={{ fontSize: '10px', fontWeight: 600, color: subject.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Select all
                      </button>
                      <span style={{ color: '#30363D', fontSize: '10px' }}>·</span>
                      <button
                        onClick={() => setSelectedFileIds([])}
                        style={{ fontSize: '10px', fontWeight: 600, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {levelFiles.map(file => {
                      const isPDF = file.type === 'application/pdf';
                      const iconColor = isPDF ? '#f87171' : '#60a5fa';
                      const isFileSelected = selectedFileIds.includes(file.id);
                      return (
                        <div
                          key={file.id}
                          onClick={() => toggleFileSelection(file.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            background: isFileSelected ? subject.color + '08' : '#161B22',
                            border: `1px solid ${isFileSelected ? subject.color + '40' : '#30363D'}`,
                            borderRadius: '16px', padding: '12px 16px',
                            cursor: 'pointer', transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                            background: isFileSelected ? subject.color : 'transparent',
                            border: `2px solid ${isFileSelected ? subject.color : '#484F58'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s ease',
                          }}>
                            {isFileSelected && (
                              <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
                                <path d="M2 6l2.5 2.5L10 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>

                          <div style={{
                            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                            background: iconColor + '18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <svg viewBox="0 0 20 20" width="17" height="17" fill="none">
                              {isPDF
                                ? <><path d="M5 2h8l4 4v12H5V2z" stroke={iconColor} strokeWidth="1.3" strokeLinejoin="round"/><path d="M13 2v4h4" stroke={iconColor} strokeWidth="1.3" strokeLinejoin="round"/><path d="M7 10h6M7 13h4" stroke={iconColor} strokeWidth="1.2" strokeLinecap="round"/></>
                                : <><rect x="2" y="3" width="16" height="14" rx="2" stroke={iconColor} strokeWidth="1.3"/><circle cx="7" cy="8" r="1.5" stroke={iconColor} strokeWidth="1.2"/><path d="M3 14l4-5 4 4 2-2 4 3" stroke={iconColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></>
                              }
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '2px' }}>
                              {(file.size / 1024 / 1024).toFixed(2)} MB · {isPDF ? 'PDF' : 'Image'}{activeLevel && ` · ${activeLevel}`}
                            </div>
                          </div>
                          {!isPDF && (
                            <img src={file.url} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); removeFile(file.id); }}
                            style={{
                              height: '30px', padding: '0 12px', borderRadius: '999px',
                              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                              background: 'transparent', color: '#f87171',
                              border: '1px solid rgba(248,113,113,0.25)', flexShrink: 0,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Flashcards view */}
          {view === 'flashcards' && (
            generatedContent.flashcards
              ? <ContentHeader label={`${generatedContent.flashcards.length} ${t('cards')} · AI Generated`} onRegenerate={() => setView('upload')} t={t}>
                  <FlashcardViewer cards={generatedContent.flashcards} color={subject.color} />
                </ContentHeader>
              : <EmptyState color={subject.color} onUpload={() => setView('upload')} />
          )}

          {/* Notes view */}
          {view === 'notes' && (
            generatedContent.notes
              ? <ContentHeader label={`${generatedContent.notes.sections.length} sections · AI Generated`} onRegenerate={() => setView('upload')} t={t}>
                  <NotesViewer notes={generatedContent.notes} />
                </ContentHeader>
              : <EmptyState color={subject.color} onUpload={() => setView('upload')} />
          )}

          {/* Quiz view — either the active quiz or the "previous quizzes" folder */}
          {view === 'quiz' && (() => {
            const activeQuiz = activeQuizId ? savedQuizzes.find(q => q.id === activeQuizId) : undefined;

            if (activeQuiz) {
              return (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <button
                      onClick={() => setActiveQuizId(null)}
                      className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0 flex items-center gap-1.5"
                      style={{ color: '#8B949E' }}
                    >
                      ← All quizzes
                    </button>
                    <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
                      {activeQuiz.name} · {activeQuiz.questions.length} {t('questions')}
                    </div>
                  </div>
                  <QuizViewer key={activeQuiz.id} questions={activeQuiz.questions} color={subject.color} />
                </div>
              );
            }

            if (savedQuizzes.length === 0) {
              return <EmptyState color={subject.color} onUpload={() => setView('upload')} />;
            }

            return (
              <div>
                <div className="text-[10px] tracking-[0.12em] uppercase font-medium mb-4" style={{ color: '#8B949E' }}>
                  Previous Quizzes ({savedQuizzes.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedQuizzes.map(quiz => (
                    <div
                      key={quiz.id}
                      onClick={() => setActiveQuizId(quiz.id)}
                      className="card-panel card-panel-lift p-4 cursor-pointer flex items-center gap-3"
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                        background: subject.color + '18', color: subject.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconQuiz />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {quiz.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '2px' }}>
                          {quiz.questions.length} questions · {new Date(quiz.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); removeQuiz(quiz.id); }}
                        aria-label="Delete quiz"
                        style={{
                          width: '30px', height: '30px', borderRadius: '999px',
                          fontSize: '11px', cursor: 'pointer', flexShrink: 0,
                          background: 'transparent', color: '#f87171',
                          border: '1px solid rgba(248,113,113,0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLang, type TKey } from '../context/LanguageContext';
import { ALL_SUBJECTS } from '../data/subjects';
import { generateFromFile } from '../lib/geminiGenerator';
import type {
  GenerationType,
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
} from '../lib/generator';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { NotesViewer } from '../components/NotesViewer';
import { QuizViewer } from '../components/QuizViewer';

function subjectFriendlyError(raw?: string): string {
  if (!raw) return 'Generation failed.';
  if (raw.includes('VITE_GEMINI_API_KEY') || raw.includes('not set'))
    return 'Gemini API key not configured. Enter your key in the banner above.';
  if (raw.includes('401') || raw.includes('403') || raw.includes('API_KEY_INVALID') || raw.includes('UNAUTHENTICATED'))
    return 'Invalid or expired API key. Click "Remove" in the banner and paste a fresh key.';
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('limit: 0')) {
    const isPerMinute = raw.toLowerCase().includes('per minute') || raw.toLowerCase().includes('rpm');
    if (isPerMinute)
      return 'Per-minute rate limit hit (15 req/min on free tier). Wait 2 minutes and try again.';
    return 'Quota exhausted — check your plan and billing at ai.google.dev/gemini-api/docs/rate-limits. If on the free tier your daily limit (1,500 req/day) may be reached.';
  }
  if (raw.toLowerCase().includes('quota'))
    return 'Quota limit reached. Check your Gemini API usage at ai.google.dev.';
  if (raw.includes('429'))
    return 'Rate limit hit. Wait 60 seconds and try again.';
  if (raw.includes('400'))
    return 'File too large or unsupported format.';
  return `Generation failed: ${raw.slice(0, 160)}`;
}

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  rawFile: File;
  level: string;
}

type GenStatus = 'idle' | 'generating' | 'done' | 'error';

interface GenState {
  status: GenStatus;
  type?: GenerationType;
  error?: string;
}

interface GeneratedContent {
  flashcards?: GeneratedFlashcard[];
  notes?: GeneratedNote;
  quiz?: GeneratedQuizQuestion[];
  sourceFileId?: string;
}

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MODES = ['upload', 'flashcards', 'notes', 'quiz'] as const;
type Mode = typeof MODES[number];

const PDFIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M5 2h8l4 4v12H5V2z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M13 2v4h4" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M7 10h6M7 13h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const ImageIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
    <rect x="2" y="3" width="16" height="14" rx="2" stroke={color} strokeWidth="1.3" />
    <circle cx="7" cy="8" r="1.5" stroke={color} strokeWidth="1.2" />
    <path d="M3 14l4-5 4 4 2-2 4 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SparkleIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4.22 4.22l2.83 2.83M12.95 12.95l2.83 2.83M4.22 15.78l2.83-2.83M12.95 7.05l2.83-2.83" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const Spinner = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"
    style={{ animation: 'spin 0.8s linear infinite' }}>
    <circle cx="8" cy="8" r="6" stroke={color + '30'} strokeWidth="2" />
    <path d="M8 2a6 6 0 016 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

const EmptyIcon = ({ color, mode }: { color: string; mode: Mode }) => {
  if (mode === 'flashcards') return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="20" fill={color + '15'} />
      <rect x="12" y="18" width="40" height="28" rx="8" stroke={color} strokeWidth="1.8" />
      <path d="M20 32h24M20 38h16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
  if (mode === 'notes') return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="20" fill={color + '15'} />
      <path d="M18 14h20l10 10v26H18V14z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M38 14v10h10" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M24 30h16M24 36h16M24 42h10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="20" fill={color + '15'} />
      <circle cx="32" cy="30" r="14" stroke={color} strokeWidth="1.8" />
      <path d="M27 26c0-2.761 2.239-5 5-5s5 2.239 5 5c0 2.5-2.5 3.5-5 5v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="32" cy="38" r="1.5" fill={color} />
    </svg>
  );
};

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const subject = ALL_SUBJECTS.find(s => s.id === id);

  const [activeLevel, setActiveLevel] = useState(subject?.levels?.[0] ?? '');
  const [activeMode, setActiveMode] = useState<Mode>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<GenerationType>('flashcards');
  const [genState, setGenState] = useState<GenState>({ status: 'idle' });
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => ACCEPTED.includes(f.type));
    const mapped: UploadedFile[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name, type: f.type, size: f.size,
      url: URL.createObjectURL(f), rawFile: f, level: activeLevel,
    }));
    setFiles(prev => {
      const next = [...prev, ...mapped];
      if (!selectedFileId && next.length > 0) setSelectedFileId(next[0].id);
      return next;
    });
  }, [activeLevel, selectedFileId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === fileId);
      if (f) URL.revokeObjectURL(f.url);
      const next = prev.filter(x => x.id !== fileId);
      if (selectedFileId === fileId) setSelectedFileId(next[0]?.id ?? '');
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!selectedFileId) return;
    const file = files.find(f => f.id === selectedFileId);
    if (!file) return;
    try {
      setGenState({ status: 'generating', type: selectedType });
      const result = await generateFromFile(file.rawFile, selectedType, subject!.title);
      setGeneratedContent(prev => ({
        ...prev,
        sourceFileId: selectedFileId,
        ...(selectedType === 'flashcards' && { flashcards: result as GeneratedFlashcard[] }),
        ...(selectedType === 'notes' && { notes: result as GeneratedNote }),
        ...(selectedType === 'quiz' && { quiz: result as GeneratedQuizQuestion[] }),
      }));
      setGenState({ status: 'done', type: selectedType });
      setActiveMode(selectedType);
    } catch (err) {
      setGenState({ status: 'error', type: selectedType, error: String(err) });
    }
  };

  if (!subject) {
    return (
      <div className="text-center py-20 px-6">
        <div className="font-display text-md-on-surface text-2xl mb-3">Subject not found</div>
        <Link to="/" className="text-md-primary text-sm no-underline hover:underline">{t('back')}</Link>
      </div>
    );
  }

  const levelFiles = files.filter(f => !subject.levels || f.level === activeLevel);
  const modeTabs: { key: Mode; label: string; hasContent: boolean }[] = [
    { key: 'upload', label: t('upload_tab'), hasContent: false },
    { key: 'flashcards', label: t('nav_flashcards'), hasContent: !!generatedContent.flashcards },
    { key: 'notes', label: t('nav_notes'), hasContent: !!generatedContent.notes },
    { key: 'quiz', label: t('nav_quiz'), hasContent: !!generatedContent.quiz },
  ];
  const isGenerating = genState.status === 'generating';

  return (
    <div className="max-w-3xl mx-auto px-6 py-9 pb-20">

      {/* Breadcrumb */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-md-on-surface-variant text-xs no-underline mb-6 hover:text-md-on-surface transition-colors">
        ← {t('back')}
      </Link>

      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
          <span className="text-md-on-surface-variant text-[10px] tracking-[0.15em] uppercase">
            {t('extended_label')}
          </span>
        </div>
        <h1 className="font-display text-md-on-surface m-0 mb-1.5" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)' }}>
          {subject.title}
        </h1>
        <p className="text-md-on-surface-variant text-sm m-0">{subject.description}</p>
      </div>

      {/* Level tabs */}
      {subject.levels && (
        <div className="flex border-b border-md-outline-variant mb-6">
          {subject.levels.map(level => (
            <button
              key={level}
              onClick={() => setActiveLevel(level)}
              className={`px-5 py-2.5 bg-transparent border-none border-b-2 cursor-pointer text-sm font-medium transition-all duration-150 -mb-px ${
                activeLevel === level
                  ? 'text-md-on-surface'
                  : 'text-md-on-surface-variant hover:text-md-on-surface'
              }`}
              style={{ borderBottomColor: activeLevel === level ? subject.color : 'transparent' }}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      {/* Mode pill tabs */}
      <div className="flex gap-1 bg-md-surface-container rounded-2xl p-1 border border-md-outline-variant mb-7 w-fit">
        {modeTabs.map(({ key, label, hasContent }) => (
          <button
            key={key}
            onClick={() => setActiveMode(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer border-none min-h-[36px] ${
              activeMode === key
                ? 'bg-md-surface-container-highest text-md-on-surface'
                : 'bg-transparent text-md-on-surface-variant hover:text-md-on-surface'
            }`}
          >
            {label}
            {hasContent && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Upload Mode ──────────────────────────────────────────────────────── */}
      {activeMode === 'upload' && (
        <>
          {/* Drop zone */}
          <div
            role="button" tabIndex={0} aria-label="Upload files"
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            className={`rounded-3xl p-14 text-center cursor-pointer border-2 border-dashed transition-all duration-200 mb-6 outline-none ${
              isDragging ? 'scale-[1.01]' : ''
            }`}
            style={{
              borderColor: isDragging ? subject.color : 'var(--color-md-outline-variant)',
              backgroundColor: isDragging ? subject.color + '0a' : 'var(--color-md-surface-container)',
            }}
          >
            <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*"
              className="hidden" aria-hidden="true"
              onChange={e => e.target.files && addFiles(e.target.files)} />
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center" style={{ backgroundColor: subject.color + '18' }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
                  <path d="M12 16V8M12 8l-4 4M12 8l4 4" stroke={subject.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 20v2a2 2 0 002 2h8a2 2 0 002-2v-2" stroke={subject.color} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <div className="font-display text-md-on-surface text-lg mb-1.5" style={{ color: isDragging ? subject.color : undefined }}>
              {isDragging ? t('drop_active') : t('upload_title')}
            </div>
            <div className="text-md-on-surface-variant text-sm mb-4">
              {t('upload_desc')}
            </div>
            <span className="inline-flex items-center bg-md-surface-container-high border border-md-outline-variant rounded-full px-3 py-1 text-md-on-surface-variant text-xs font-medium">
              {t('file_types')}
            </span>
          </div>

          {/* File list */}
          {levelFiles.length > 0 && (
            <div className="mb-7">
              <div className="flex items-center justify-between mb-3">
                <div className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-medium">
                  {t('uploaded_files')} ({levelFiles.length})
                </div>
                <div className="text-md-outline text-[10px]">{t('session_note')}</div>
              </div>

              <div className="flex flex-col gap-2">
                {levelFiles.map(file => {
                  const isPDF = file.type === 'application/pdf';
                  const iconColor = isPDF ? '#f87171' : '#60a5fa';
                  return (
                    <div
                      key={file.id}
                      className="bg-md-surface-container rounded-2xl px-4 py-3.5 flex items-center gap-3 border border-md-outline-variant"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: iconColor + '18' }}
                      >
                        {isPDF ? <PDFIcon color={iconColor} /> : <ImageIcon color={iconColor} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-md-on-surface text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                          {file.name}
                        </div>
                        <div className="text-md-on-surface-variant text-[11px] mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB{activeLevel && ` · ${activeLevel}`}{` · ${isPDF ? 'PDF' : 'Image'}`}
                        </div>
                      </div>
                      {!isPDF && (
                        <img src={file.url} alt="" className="w-11 h-11 object-cover rounded-xl flex-shrink-0" />
                      )}
                      <div className="flex gap-2 flex-shrink-0">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center h-8 px-3 rounded-full text-xs font-medium no-underline border transition-all duration-150"
                          style={{ backgroundColor: subject.color + '18', color: subject.color, borderColor: subject.color + '35' }}
                        >
                          {t('open')}
                        </a>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="flex items-center h-8 px-3 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer text-red-400 border-red-400/25 hover:bg-red-400/10 bg-transparent"
                        >
                          {t('remove')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate panel */}
          {levelFiles.length > 0 && (
            <div
              className="bg-md-surface-container rounded-3xl p-6 border border-t-2"
              style={{ borderColor: 'var(--color-md-outline-variant)', borderTopColor: subject.color }}
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <SparkleIcon color={subject.color} />
                <span className="font-display text-md-on-surface text-lg">{t('gen_section')}</span>
              </div>
              <p className="text-md-on-surface-variant text-xs m-0 mb-5 leading-relaxed">
                {t('gen_desc')}
              </p>

              {/* File selector */}
              {levelFiles.length > 1 && (
                <div className="mb-4">
                  <label className="text-md-on-surface-variant text-xs font-medium block mb-2">
                    {t('gen_select_file')}
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {levelFiles.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFileId(f.id)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-2xl text-left cursor-pointer border transition-all duration-150 text-sm"
                        style={{
                          backgroundColor: selectedFileId === f.id ? subject.color + '15' : 'var(--color-md-surface-container-high)',
                          borderColor: selectedFileId === f.id ? subject.color + '45' : 'var(--color-md-outline-variant)',
                          color: 'var(--color-md-on-surface)',
                        }}
                      >
                        {f.type === 'application/pdf' ? <PDFIcon color="#f87171" /> : <ImageIcon color="#60a5fa" />}
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type selector */}
              <div className="mb-5">
                <label className="text-md-on-surface-variant text-xs font-medium block mb-2">
                  {t('gen_select_type')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['flashcards', 'notes', 'quiz'] as GenerationType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className="h-9 px-4 rounded-full text-sm border cursor-pointer transition-all duration-150 font-medium"
                      style={{
                        backgroundColor: selectedType === type ? subject.color + '18' : 'var(--color-md-surface-container-high)',
                        borderColor: selectedType === type ? subject.color + '55' : 'var(--color-md-outline-variant)',
                        color: selectedType === type ? subject.color : 'var(--color-md-on-surface-variant)',
                      }}
                    >
                      {type === 'flashcards' ? t('gen_btn_fc') : type === 'notes' ? t('gen_btn_notes') : t('gen_btn_quiz')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button + status */}
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !selectedFileId}
                  className="h-10 px-6 rounded-full text-sm font-semibold flex items-center gap-2 border transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                  style={{
                    backgroundColor: isGenerating ? 'var(--color-md-surface-container-high)' : subject.color + '18',
                    borderColor: isGenerating ? 'var(--color-md-outline-variant)' : subject.color + '55',
                    color: isGenerating ? 'var(--color-md-on-surface-variant)' : subject.color,
                  }}
                >
                  {isGenerating ? (
                    <><Spinner color={subject.color} />{t('gen_generating')}</>
                  ) : (
                    <><SparkleIcon color={subject.color} />{t('gen_go')}</>
                  )}
                </button>

                {genState.status === 'done' && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                      <path d="M3 8l3.5 3.5L13 5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-green-400">
                      {genState.type === 'flashcards' ? t('gen_done_fc') : genState.type === 'notes' ? t('gen_done_notes') : t('gen_done_quiz')}
                    </span>
                    <button
                      onClick={() => setActiveMode(genState.type!)}
                      className="ml-1 bg-transparent border-none text-md-primary cursor-pointer text-sm font-semibold p-0 hover:underline"
                    >
                      {t('gen_view')} →
                    </button>
                  </div>
                )}

                {genState.status === 'error' && (
                  <div className="text-red-400 text-sm">
                    <div>{subjectFriendlyError(genState.error)}</div>
                    {genState.error && (
                      <div className="mt-1 text-[11px] opacity-50 break-all" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {genState.error.slice(0, 220)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {levelFiles.length === 0 && (
            <div className="bg-md-surface-container rounded-2xl p-6 border border-md-outline-variant text-center">
              <div className="text-md-outline text-sm">{t('no_files')}</div>
              <div className="text-md-outline-variant text-xs mt-1">{t('session_note')}</div>
            </div>
          )}
        </>
      )}

      {/* ── Content modes ────────────────────────────────────────────────────── */}
      {activeMode === 'flashcards' && (
        generatedContent.flashcards ? (
          <ContentHeader
            label={`${generatedContent.flashcards.length} ${t('cards')} · AI Generated`}
            onRegenerate={() => setActiveMode('upload')}
            t={t}
          >
            <FlashcardViewer cards={generatedContent.flashcards} color={subject.color} />
          </ContentHeader>
        ) : <EmptyStudyState mode="flashcards" color={subject.color} onUpload={() => setActiveMode('upload')} t={t} />
      )}

      {activeMode === 'notes' && (
        generatedContent.notes ? (
          <ContentHeader
            label={`${generatedContent.notes.sections.length} sections · AI Generated`}
            onRegenerate={() => setActiveMode('upload')}
            t={t}
          >
            <NotesViewer notes={generatedContent.notes} />
          </ContentHeader>
        ) : <EmptyStudyState mode="notes" color={subject.color} onUpload={() => setActiveMode('upload')} t={t} />
      )}

      {activeMode === 'quiz' && (
        generatedContent.quiz ? (
          <ContentHeader
            label={`${generatedContent.quiz.length} ${t('questions')} · AI Generated`}
            onRegenerate={() => setActiveMode('upload')}
            t={t}
          >
            <QuizViewer questions={generatedContent.quiz} color={subject.color} />
          </ContentHeader>
        ) : <EmptyStudyState mode="quiz" color={subject.color} onUpload={() => setActiveMode('upload')} t={t} />
      )}
    </div>
  );
}

function ContentHeader({ label, onRegenerate, t, children }: {
  label: string; onRegenerate: () => void; t: (k: TKey) => string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="text-md-on-surface-variant text-[10px] tracking-[0.12em] uppercase font-medium">{label}</div>
        <button
          onClick={onRegenerate}
          className="bg-transparent border-none text-md-primary text-xs font-semibold cursor-pointer hover:underline p-0"
        >
          {t('gen_regenerate')} →
        </button>
      </div>
      {children}
    </div>
  );
}

function EmptyStudyState({ mode, color, onUpload, t }: {
  mode: Exclude<Mode, 'upload'>; color: string; onUpload: () => void; t: (k: TKey) => string;
}) {
  const emptyMessages: Record<Exclude<Mode, 'upload'>, string> = {
    flashcards: t('empty_fc'),
    notes: t('empty_notes'),
    quiz: t('empty_quiz'),
  };

  return (
    <div className="bg-md-surface-container rounded-3xl p-16 border border-md-outline-variant text-center">
      <div className="flex justify-center mb-5">
        <EmptyIcon color={color} mode={mode} />
      </div>
      <div className="font-display text-md-on-surface text-xl mb-4">{emptyMessages[mode]}</div>
      <button
        onClick={onUpload}
        className="inline-flex items-center h-10 px-5 rounded-full text-sm font-semibold border cursor-pointer transition-all duration-150 hover:brightness-110"
        style={{ backgroundColor: color + '18', color, borderColor: color + '35' }}
      >
        {t('upload_cta')} →
      </button>
    </div>
  );
}

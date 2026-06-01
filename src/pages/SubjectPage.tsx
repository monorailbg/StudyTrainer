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

interface GeneratedContent {
  flashcards?: GeneratedFlashcard[];
  notes?: GeneratedNote;
  quiz?: GeneratedQuizQuestion[];
  sourceFileId?: string;
}

type View = 'upload' | 'flashcards' | 'notes' | 'quiz';

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// ── Mini icons ─────────────────────────────────────────────────────────────────

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
  const [view, setView] = useState<View>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileId, setSelectedFileId] = useState('');
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
    e.preventDefault(); setIsDragging(false);
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
        ...(selectedType === 'notes'      && { notes:      result as GeneratedNote }),
        ...(selectedType === 'quiz'       && { quiz:       result as GeneratedQuizQuestion[] }),
      }));
      setGenState({ status: 'done', type: selectedType });
      setView(selectedType);
    } catch (err) {
      setGenState({ status: 'error', type: selectedType, error: String(err) });
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 76px)' }}>

      {/* ── Header strip ────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: '1px solid #21262D',
        padding: '18px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
        background: '#0D1117',
      }}>
        <Link to="/" style={{ color: '#8B949E', textDecoration: 'none', fontSize: '12px', flexShrink: 0 }}>
          ← {t('back')}
        </Link>
        <div style={{ width: '1px', height: '14px', background: '#30363D' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: subject.color, boxShadow: `0 0 8px ${subject.color}`, flexShrink: 0 }} />
        <div>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '15px', color: '#E6EDF3' }}>
            {subject.title}
          </span>
          <span style={{ fontSize: '12px', color: '#8B949E', marginLeft: '10px' }}>
            {subject.description}
          </span>
        </div>
        {/* Level tabs */}
        {subject.levels && (
          <div className="flex gap-1 ml-auto">
            {subject.levels.map(level => (
              <button
                key={level}
                onClick={() => setActiveLevel(level)}
                className="h-7 px-3 text-xs font-medium border cursor-pointer transition-all duration-200"
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

      {/* ── Sidebar + content ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left sidebar */}
        <aside style={{
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

            {levelFiles.map(file => (
              <div key={file.id} style={{ position: 'relative' }}>
                <SidebarItem
                  icon={<IconFile />}
                  label={file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name}
                  sublabel={`${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.type === 'application/pdf' ? 'PDF' : 'Image'}`}
                  active={view === 'upload' && selectedFileId === file.id}
                  onClick={() => { setSelectedFileId(file.id); setView('upload'); }}
                />
              </div>
            ))}
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
              label={t('nav_quiz')}
              sublabel={generatedContent.quiz ? `${generatedContent.quiz.length} questions` : 'Not generated'}
              active={view === 'quiz'}
              dot={!!generatedContent.quiz}
              dotColor={subject.color}
              onClick={() => setView('quiz')}
            />
          </div>

          {/* Generate panel in sidebar */}
          {levelFiles.length > 0 && (
            <div style={{
              marginTop: 'auto',
              paddingTop: '16px',
              borderTop: '1px solid #21262D',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '8px' }}>
                Generate
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

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedFileId}
                className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all duration-300"
                style={{
                  borderRadius: '999px',
                  background:   isGenerating ? '#1F2937' : subject.color + '18',
                  color:        isGenerating ? '#8B949E' : subject.color,
                  borderColor:  isGenerating ? '#30363D' : subject.color + '45',
                }}
              >
                {isGenerating ? <><Spinner color={subject.color} /> Generating…</> : <><IconSparkle /> Generate</>}
              </button>

              {genState.status === 'error' && (
                <div className="mt-2 px-1 text-[10px] leading-relaxed" style={{ color: '#f87171' }}>
                  {friendlyError(genState.error)}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Main content area */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 32px',
          background: '#0D1117',
        }}>

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
                className="text-center cursor-pointer outline-none transition-all duration-300"
                style={{
                  border: `2px dashed ${isDragging ? subject.color : '#30363D'}`,
                  borderRadius: '24px',
                  padding: '56px 40px',
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
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B949E', marginBottom: '10px' }}>
                    {t('uploaded_files')} ({levelFiles.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {levelFiles.map(file => {
                      const isPDF = file.type === 'application/pdf';
                      const iconColor = isPDF ? '#f87171' : '#60a5fa';
                      return (
                        <div key={file.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: '#161B22', border: '1px solid #30363D', borderRadius: '16px',
                          padding: '12px 16px',
                        }}>
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
                          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <button
                              onClick={() => { setSelectedFileId(file.id); }}
                              style={{
                                height: '30px', padding: '0 12px', borderRadius: '999px',
                                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                background: selectedFileId === file.id ? subject.color + '25' : 'transparent',
                                color: selectedFileId === file.id ? subject.color : '#8B949E',
                                border: `1px solid ${selectedFileId === file.id ? subject.color + '50' : '#30363D'}`,
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {selectedFileId === file.id ? '✓ Selected' : 'Select'}
                            </button>
                            <button
                              onClick={() => removeFile(file.id)}
                              style={{
                                height: '30px', padding: '0 12px', borderRadius: '999px',
                                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                background: 'transparent', color: '#f87171',
                                border: '1px solid rgba(248,113,113,0.25)',
                              }}
                            >
                              Remove
                            </button>
                          </div>
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

          {/* Quiz view */}
          {view === 'quiz' && (
            generatedContent.quiz
              ? <ContentHeader label={`${generatedContent.quiz.length} ${t('questions')} · AI Generated`} onRegenerate={() => setView('upload')} t={t}>
                  <QuizViewer questions={generatedContent.quiz} color={subject.color} />
                </ContentHeader>
              : <EmptyState color={subject.color} onUpload={() => setView('upload')} />
          )}
        </main>
      </div>
    </div>
  );
}

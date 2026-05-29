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

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Small SVG Icons ────────────────────────────────────────────────────────

const PDFIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M5 2h8l4 4v12H5V2z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M13 2v4h4" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M7 10h6M7 13h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const ImageIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
    <rect x="2" y="3" width="16" height="14" rx="2" stroke={color} strokeWidth="1.3" />
    <circle cx="7" cy="8" r="1.5" stroke={color} strokeWidth="1.2" />
    <path d="M3 14l4-5 4 4 2-2 4 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UploadCloudIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 48 48" width="52" height="52" fill="none" aria-hidden="true">
    <rect width="48" height="48" rx="14" fill={color + '14'} />
    <path d="M24 32V20M24 20l-5 5M24 20l5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 30v4a2 2 0 002 2h16a2 2 0 002-2v-4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SparkleIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
    <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4.22 4.22l2.83 2.83M12.95 12.95l2.83 2.83M4.22 15.78l2.83-2.83M12.95 7.05l2.83-2.83" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const KeyIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
    <circle cx="7.5" cy="10" r="4.5" stroke={color} strokeWidth="1.4" />
    <path d="M11.5 10h7M15.5 10v2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const EmptyIcon = ({ color, mode }: { color: string; mode: Mode }) => {
  if (mode === 'flashcards') return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={color + '12'} />
      <rect x="12" y="18" width="40" height="28" rx="6" stroke={color} strokeWidth="1.8" />
      <path d="M20 32h24M20 38h16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
  if (mode === 'notes') return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={color + '12'} />
      <path d="M18 14h20l10 10v26H18V14z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M38 14v10h10" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M24 30h16M24 36h16M24 42h10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={color + '12'} />
      <circle cx="32" cy="30" r="14" stroke={color} strokeWidth="1.8" />
      <path d="M27 26c0-2.761 2.239-5 5-5s5 2.239 5 5c0 2.5-2.5 3.5-5 5v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="32" cy="38" r="1.5" fill={color} />
    </svg>
  );
};

// ── Spinner ────────────────────────────────────────────────────────────────

const Spinner = ({ color }: { color: string }) => (
  <svg
    width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
    style={{ animation: 'spin 0.8s linear infinite' }}
  >
    <circle cx="8" cy="8" r="6" stroke={color + '30'} strokeWidth="2" />
    <path d="M8 2a6 6 0 016 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

// ── Main Component ─────────────────────────────────────────────────────────

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const subject = ALL_SUBJECTS.find(s => s.id === id);

  const [activeLevel, setActiveLevel] = useState(subject?.levels?.[0] ?? '');
  const [activeMode, setActiveMode] = useState<Mode>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini-api-key') ?? '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyForm, setShowKeyForm] = useState(false);

  // Generation
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<GenerationType>('flashcards');
  const [genState, setGenState] = useState<GenState>({ status: 'idle' });
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => ACCEPTED.includes(f.type));
    const mapped: UploadedFile[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      type: f.type,
      size: f.size,
      url: URL.createObjectURL(f),
      rawFile: f,
      level: activeLevel,
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

  const saveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    localStorage.setItem('gemini-api-key', trimmed);
    setApiKeyInput('');
    setShowKeyForm(false);
  };

  const handleGenerate = async () => {
    if (!apiKey || !selectedFileId) return;
    const file = files.find(f => f.id === selectedFileId);
    if (!file) return;

    try {
      setGenState({ status: 'generating', type: selectedType });

      const result = await generateFromFile(apiKey, file.rawFile, selectedType, subject!.title);

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
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ fontFamily: 'DM Serif Display, serif', color: '#f0f4f8', fontSize: '1.5rem', marginBottom: '12px' }}>
          Subject not found
        </div>
        <Link to="/" style={{ color: '#d4a843', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px' }}>
          {t('back')}
        </Link>
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
  const genStatusLabel = t('gen_generating');

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '36px 24px 80px' }}>

      {/* Breadcrumb */}
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: '#4a5a6e', fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: '13px', textDecoration: 'none', marginBottom: '24px',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#4a5a6e'}
      >
        {t('back')}
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: subject.color }} />
          <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '10px', color: '#4a5a6e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {t('extended_label')}
          </span>
        </div>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', color: '#f0f4f8', margin: '0 0 6px' }}>
          {subject.title}
        </h1>
        <p style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px', color: '#94a3b8', margin: 0 }}>
          {subject.description}
        </p>
      </div>

      {/* Level tabs */}
      {subject.levels && (
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2d45', marginBottom: '24px' }}>
          {subject.levels.map(level => (
            <button key={level} onClick={() => setActiveLevel(level)} style={{
              padding: '10px 20px', backgroundColor: 'transparent', border: 'none',
              borderBottom: `2px solid ${activeLevel === level ? subject.color : 'transparent'}`,
              color: activeLevel === level ? '#f0f4f8' : '#4a5a6e',
              cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '13px', fontWeight: activeLevel === level ? 600 : 400,
              marginBottom: '-1px', transition: 'color 0.15s, border-color 0.15s', minHeight: '44px',
            }}>
              {level}
            </button>
          ))}
        </div>
      )}

      {/* Mode pill tabs */}
      <div style={{
        display: 'flex', gap: '3px', backgroundColor: '#0d1a2e',
        borderRadius: '10px', padding: '3px', border: '1px solid #1e2d45',
        marginBottom: '28px', width: 'fit-content',
      }}>
        {modeTabs.map(({ key, label, hasContent }) => (
          <button key={key} onClick={() => setActiveMode(key)} style={{
            padding: '7px 16px', minHeight: '36px',
            backgroundColor: activeMode === key ? '#162236' : 'transparent',
            border: 'none', borderRadius: '7px',
            color: activeMode === key ? '#f0f4f8' : '#4a5a6e',
            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: '13px', fontWeight: activeMode === key ? 600 : 400,
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {label}
            {hasContent && (
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: subject.color, display: 'inline-block',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Upload Mode ───────────────────────────────────────────────────── */}
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
            style={{
              border: `2px dashed ${isDragging ? subject.color : '#2d4465'}`,
              borderRadius: '16px', padding: '52px 32px', textAlign: 'center',
              cursor: 'pointer', backgroundColor: isDragging ? subject.color + '0a' : '#0d1a2e',
              transition: 'border-color 0.15s, background-color 0.15s',
              marginBottom: '24px', outline: 'none',
            }}
          >
            <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*"
              style={{ display: 'none' }} aria-hidden="true"
              onChange={e => e.target.files && addFiles(e.target.files)} />
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <UploadCloudIcon color={subject.color} />
            </div>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', color: isDragging ? subject.color : '#f0f4f8', marginBottom: '6px', transition: 'color 0.15s' }}>
              {isDragging ? t('drop_active') : t('upload_title')}
            </div>
            <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#4a5a6e', marginBottom: '14px' }}>
              {t('upload_desc')}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#162236', border: '1px solid #2d4465', borderRadius: '6px',
              padding: '5px 12px', fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '11px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.06em',
            }}>
              {t('file_types')}
            </div>
          </div>

          {/* File list */}
          {levelFiles.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {t('uploaded_files')} ({levelFiles.length})
                </div>
                <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#2d4465' }}>
                  {t('session_note')}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {levelFiles.map(file => {
                  const isPDF = file.type === 'application/pdf';
                  const iconColor = isPDF ? '#f87171' : '#60a5fa';
                  return (
                    <div key={file.id} style={{
                      backgroundColor: '#0d1a2e', border: '1px solid #1e2d45',
                      borderRadius: '10px', padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '8px',
                        backgroundColor: iconColor + '14',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {isPDF ? <PDFIcon color={iconColor} /> : <ImageIcon color={iconColor} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </div>
                        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', marginTop: '2px' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB{activeLevel && ` · ${activeLevel}`}{` · ${isPDF ? 'PDF' : 'Image'}`}
                        </div>
                      </div>
                      {!isPDF && (
                        <img src={file.url} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                      )}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <a href={file.url} target="_blank" rel="noopener noreferrer" style={{
                          display: 'flex', alignItems: 'center', height: '34px', padding: '0 12px',
                          backgroundColor: subject.color + '14', color: subject.color,
                          border: `1px solid ${subject.color}30`, borderRadius: '7px',
                          fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600, textDecoration: 'none',
                        }}>
                          {t('open')}
                        </a>
                        <button onClick={() => removeFile(file.id)} style={{
                          display: 'flex', alignItems: 'center', height: '34px', padding: '0 12px',
                          backgroundColor: '#162236', color: '#f87171', border: '1px solid #f8717120',
                          borderRadius: '7px', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600, cursor: 'pointer',
                        }}>
                          {t('remove')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Generate Panel ─────────────────────────────────────────────── */}
          {levelFiles.length > 0 && (
            <div style={{
              backgroundColor: '#0d1a2e',
              border: `1px solid ${subject.color}25`,
              borderRadius: '16px',
              padding: '24px',
              borderTop: `2px solid ${subject.color}`,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <SparkleIcon color={subject.color} />
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', color: '#f0f4f8' }}>
                  {t('gen_section')}
                </span>
              </div>
              <p style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#4a5a6e', margin: '0 0 20px', lineHeight: 1.5 }}>
                {t('gen_desc')}
              </p>

              {/* API Key */}
              <div style={{ marginBottom: '20px' }}>
                {apiKey && !showKeyForm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      backgroundColor: '#162236', border: '1px solid #4ade8030',
                      borderRadius: '7px', padding: '6px 12px',
                    }}>
                      <KeyIcon color="#4ade80" />
                      <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>
                        {t('gen_api_key_stored')}
                      </span>
                    </div>
                    <button onClick={() => setShowKeyForm(true)} style={{
                      backgroundColor: 'transparent', border: 'none', color: '#4a5a6e',
                      cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px',
                      textDecoration: 'underline',
                    }}>
                      {t('gen_api_key_change')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                      {t('gen_api_key_label')}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveApiKey()}
                        placeholder={t('gen_api_key_placeholder')}
                        style={{
                          flex: 1, height: '40px', padding: '0 12px',
                          backgroundColor: '#162236', border: '1px solid #4a5568',
                          borderRadius: '8px', color: '#f0f4f8',
                          fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px',
                          outline: 'none',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#d4a843')}
                        onBlur={e => (e.target.style.borderColor = '#4a5568')}
                      />
                      <button onClick={saveApiKey} disabled={!apiKeyInput.trim()} style={{
                        height: '40px', padding: '0 16px', borderRadius: '8px',
                        backgroundColor: apiKeyInput.trim() ? '#d4a843' : '#162236',
                        border: 'none', color: apiKeyInput.trim() ? '#07111f' : '#2d4465',
                        cursor: apiKeyInput.trim() ? 'pointer' : 'default',
                        fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
                      }}>
                        {t('gen_api_key_save')}
                      </button>
                      {apiKey && (
                        <button onClick={() => setShowKeyForm(false)} style={{
                          height: '40px', padding: '0 14px', borderRadius: '8px',
                          backgroundColor: '#162236', border: '1px solid #1e2d45',
                          color: '#4a5a6e', cursor: 'pointer',
                          fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px',
                        }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {apiKey && (
                <>
                  {/* File selector */}
                  {levelFiles.length > 1 && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                        {t('gen_select_file')}
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {levelFiles.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setSelectedFileId(f.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 12px', borderRadius: '8px', textAlign: 'left',
                              backgroundColor: selectedFileId === f.id ? subject.color + '14' : '#162236',
                              border: `1px solid ${selectedFileId === f.id ? subject.color + '40' : '#1e2d45'}`,
                              color: '#f0f4f8', cursor: 'pointer',
                              fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px',
                              transition: 'all 0.15s',
                            }}
                          >
                            {f.type === 'application/pdf' ? <PDFIcon color="#f87171" /> : <ImageIcon color="#60a5fa" />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Type selector */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                      {t('gen_select_type')}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(['flashcards', 'notes', 'quiz'] as GenerationType[]).map(type => (
                        <button
                          key={type}
                          onClick={() => setSelectedType(type)}
                          style={{
                            height: '36px', padding: '0 16px', borderRadius: '8px',
                            backgroundColor: selectedType === type ? subject.color + '18' : '#162236',
                            border: `1px solid ${selectedType === type ? subject.color + '50' : '#1e2d45'}`,
                            color: selectedType === type ? subject.color : '#4a5a6e',
                            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                            fontSize: '13px', fontWeight: selectedType === type ? 600 : 400,
                            transition: 'all 0.15s',
                          }}
                        >
                          {type === 'flashcards' ? t('gen_btn_fc') : type === 'notes' ? t('gen_btn_notes') : t('gen_btn_quiz')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !selectedFileId}
                      style={{
                        height: '44px', padding: '0 24px', borderRadius: '8px',
                        backgroundColor: isGenerating ? '#162236' : subject.color + '18',
                        border: `1px solid ${isGenerating ? '#1e2d45' : subject.color + '50'}`,
                        color: isGenerating ? '#4a5a6e' : subject.color,
                        cursor: isGenerating ? 'default' : 'pointer',
                        fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {isGenerating ? (
                        <>
                          <Spinner color={subject.color} />
                          {genStatusLabel}
                        </>
                      ) : (
                        <>
                          <SparkleIcon color={subject.color} />
                          {t('gen_go')}
                        </>
                      )}
                    </button>

                    {/* Status */}
                    {genState.status === 'done' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px' }}>
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true"><path d="M3 8l3.5 3.5L13 5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span style={{ color: '#4ade80' }}>
                          {genState.type === 'flashcards' ? t('gen_done_fc') : genState.type === 'notes' ? t('gen_done_notes') : t('gen_done_quiz')}
                        </span>
                        <button
                          onClick={() => setActiveMode(genState.type!)}
                          style={{
                            marginLeft: '4px', backgroundColor: 'transparent',
                            border: 'none', color: '#d4a843',
                            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                            fontSize: '13px', fontWeight: 600, padding: 0,
                          }}
                        >
                          {t('gen_view')} →
                        </button>
                      </div>
                    )}

                    {genState.status === 'error' && (
                      <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#f87171' }}>
                        {t('gen_error')}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Empty state when no files */}
          {levelFiles.length === 0 && (
            <div style={{
              backgroundColor: '#0d1a2e', border: '1px solid #1e2d45',
              borderRadius: '10px', padding: '24px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#2d4465' }}>
                {t('no_files')}
              </div>
              <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#1e2d45', marginTop: '4px' }}>
                {t('session_note')}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Flashcards Mode ───────────────────────────────────────────────── */}
      {activeMode === 'flashcards' && (
        generatedContent.flashcards ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {generatedContent.flashcards.length} {t('cards')} · AI Generated
              </div>
              <button onClick={() => setActiveMode('upload')} style={{
                backgroundColor: 'transparent', border: 'none', color: subject.color,
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', fontWeight: 600,
              }}>
                {t('gen_regenerate')} →
              </button>
            </div>
            <FlashcardViewer cards={generatedContent.flashcards} color={subject.color} />
          </div>
        ) : (
          <EmptyStudyState mode="flashcards" color={subject.color} onUpload={() => setActiveMode('upload')} t={t} />
        )
      )}

      {/* ── Notes Mode ────────────────────────────────────────────────────── */}
      {activeMode === 'notes' && (
        generatedContent.notes ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {generatedContent.notes.sections.length} sections · AI Generated
              </div>
              <button onClick={() => setActiveMode('upload')} style={{
                backgroundColor: 'transparent', border: 'none', color: subject.color,
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', fontWeight: 600,
              }}>
                {t('gen_regenerate')} →
              </button>
            </div>
            <NotesViewer notes={generatedContent.notes} />
          </div>
        ) : (
          <EmptyStudyState mode="notes" color={subject.color} onUpload={() => setActiveMode('upload')} t={t} />
        )
      )}

      {/* ── Quiz Mode ─────────────────────────────────────────────────────── */}
      {activeMode === 'quiz' && (
        generatedContent.quiz ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {generatedContent.quiz.length} {t('questions')} · AI Generated
              </div>
              <button onClick={() => setActiveMode('upload')} style={{
                backgroundColor: 'transparent', border: 'none', color: subject.color,
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '12px', fontWeight: 600,
              }}>
                {t('gen_regenerate')} →
              </button>
            </div>
            <QuizViewer questions={generatedContent.quiz} color={subject.color} />
          </div>
        ) : (
          <EmptyStudyState mode="quiz" color={subject.color} onUpload={() => setActiveMode('upload')} t={t} />
        )
      )}
    </div>
  );
}

// ── Empty state helper ─────────────────────────────────────────────────────

function EmptyStudyState({ mode, color, onUpload, t }: {
  mode: Exclude<Mode, 'upload'>;
  color: string;
  onUpload: () => void;
  t: (k: TKey) => string;
}) {
  const emptyMessages: Record<Exclude<Mode, 'upload'>, string> = {
    flashcards: t('empty_fc'),
    notes: t('empty_notes'),
    quiz: t('empty_quiz'),
  };

  return (
    <div style={{
      backgroundColor: '#0d1a2e', border: '1px solid #1e2d45',
      borderRadius: '16px', padding: '72px 32px', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <EmptyIcon color={color} mode={mode} />
      </div>
      <div style={{ fontFamily: 'DM Serif Display, serif', color: '#f0f4f8', fontSize: '1.25rem', marginBottom: '8px' }}>
        {emptyMessages[mode]}
      </div>
      <button
        onClick={onUpload}
        style={{
          marginTop: '12px', display: 'inline-flex', alignItems: 'center',
          height: '40px', padding: '0 20px', backgroundColor: color + '14',
          color, border: `1px solid ${color}30`, borderRadius: '8px',
          fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', transition: 'background-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = color + '28'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = color + '14'}
      >
        {t('upload_cta')} →
      </button>
    </div>
  );
}

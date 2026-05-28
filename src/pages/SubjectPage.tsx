import { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { ALL_SUBJECTS } from '../data/subjects';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  level: string;
}

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MODES = ['upload', 'flashcards', 'notes', 'quiz'] as const;
type Mode = typeof MODES[number];

const PDFIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M5 2h8l4 4v12H5V2z" stroke={color} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
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

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const subject = ALL_SUBJECTS.find(s => s.id === id);

  const [activeLevel, setActiveLevel] = useState(subject?.levels?.[0] ?? '');
  const [activeMode, setActiveMode] = useState<Mode>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => ACCEPTED.includes(f.type));
    const mapped: UploadedFile[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      type: f.type,
      size: f.size,
      url: URL.createObjectURL(f),
      level: activeLevel,
    }));
    setFiles(prev => [...prev, ...mapped]);
  }, [activeLevel]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === fileId);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter(x => x.id !== fileId);
    });
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

  const modeTabs: { key: Mode; label: string }[] = [
    { key: 'upload', label: t('upload_tab') },
    { key: 'flashcards', label: t('nav_flashcards') },
    { key: 'notes', label: t('nav_notes') },
    { key: 'quiz', label: t('nav_quiz') },
  ];

  const emptyMessages: Record<Exclude<Mode, 'upload'>, string> = {
    flashcards: t('empty_fc'),
    notes: t('empty_notes'),
    quiz: t('empty_quiz'),
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '36px 24px 80px' }}>

      {/* Breadcrumb */}
      <Link to="/" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: '#4a5a6e',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: '13px',
        textDecoration: 'none',
        marginBottom: '24px',
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
          <span style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: '10px',
            color: '#4a5a6e',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            {t('extended_label')}
          </span>
        </div>
        <h1 style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
          color: '#f0f4f8',
          margin: '0 0 6px',
        }}>
          {subject.title}
        </h1>
        <p style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px', color: '#94a3b8', margin: 0 }}>
          {subject.description}
        </p>
      </div>

      {/* Level tabs */}
      {subject.levels && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #1e2d45',
          marginBottom: '24px',
          gap: '0',
        }}>
          {subject.levels.map(level => (
            <button
              key={level}
              onClick={() => setActiveLevel(level)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeLevel === level ? subject.color : 'transparent'}`,
                color: activeLevel === level ? '#f0f4f8' : '#4a5a6e',
                cursor: 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: '13px',
                fontWeight: activeLevel === level ? 600 : 400,
                marginBottom: '-1px',
                transition: 'color 0.15s, border-color 0.15s',
                minHeight: '44px',
              }}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      {/* Mode pill tabs */}
      <div style={{
        display: 'flex',
        gap: '3px',
        backgroundColor: '#0d1a2e',
        borderRadius: '10px',
        padding: '3px',
        border: '1px solid #1e2d45',
        marginBottom: '28px',
        width: 'fit-content',
      }}>
        {modeTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveMode(key)}
            style={{
              padding: '7px 18px',
              minHeight: '36px',
              backgroundColor: activeMode === key ? '#162236' : 'transparent',
              border: 'none',
              borderRadius: '7px',
              color: activeMode === key ? '#f0f4f8' : '#4a5a6e',
              cursor: 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '13px',
              fontWeight: activeMode === key ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Upload mode ─────────────────────────────────────────────────────── */}
      {activeMode === 'upload' && (
        <>
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload files"
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? subject.color : '#2d4465'}`,
              borderRadius: '16px',
              padding: '52px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragging ? subject.color + '0a' : '#0d1a2e',
              transition: 'border-color 0.15s, background-color 0.15s',
              marginBottom: '24px',
              outline: 'none',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/*"
              style={{ display: 'none' }}
              aria-hidden="true"
              onChange={e => e.target.files && addFiles(e.target.files)}
            />
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <UploadCloudIcon color={subject.color} />
            </div>
            <div style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: '1.2rem',
              color: isDragging ? subject.color : '#f0f4f8',
              marginBottom: '6px',
              transition: 'color 0.15s',
            }}>
              {isDragging ? t('drop_active') : t('upload_title')}
            </div>
            <div style={{
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '13px',
              color: '#4a5a6e',
              marginBottom: '14px',
            }}>
              {t('upload_desc')}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#162236',
              border: '1px solid #2d4465',
              borderRadius: '6px',
              padding: '5px 12px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '11px',
              color: '#94a3b8',
              fontWeight: 600,
              letterSpacing: '0.06em',
            }}>
              {t('file_types')}
            </div>
          </div>

          {/* File list */}
          {levelFiles.length > 0 ? (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <div style={{
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: '11px',
                  color: '#4a5a6e',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  {t('uploaded_files')} ({levelFiles.length})
                </div>
                <div style={{
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: '11px',
                  color: '#2d4465',
                }}>
                  {t('session_note')}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {levelFiles.map(file => {
                  const isPDF = file.type === 'application/pdf';
                  const iconColor = isPDF ? '#f87171' : '#60a5fa';
                  return (
                    <div
                      key={file.id}
                      style={{
                        backgroundColor: '#0d1a2e',
                        border: '1px solid #1e2d45',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: iconColor + '14',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {isPDF ? <PDFIcon color={iconColor} /> : <ImageIcon color={iconColor} />}
                      </div>

                      {/* Name + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'IBM Plex Sans, sans-serif',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#f0f4f8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {file.name}
                        </div>
                        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '11px', color: '#4a5a6e', marginTop: '2px' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                          {activeLevel && ` · ${activeLevel}`}
                          {` · ${isPDF ? 'PDF' : 'Image'}`}
                        </div>
                      </div>

                      {/* Image thumbnail */}
                      {!isPDF && (
                        <img
                          src={file.url}
                          alt=""
                          style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                        />
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '34px',
                            padding: '0 12px',
                            backgroundColor: subject.color + '14',
                            color: subject.color,
                            border: `1px solid ${subject.color}30`,
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontFamily: 'IBM Plex Sans, sans-serif',
                            fontWeight: 600,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('open')}
                        </a>
                        <button
                          onClick={() => removeFile(file.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '34px',
                            padding: '0 12px',
                            backgroundColor: '#162236',
                            color: '#f87171',
                            border: '1px solid #f8717120',
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontFamily: 'IBM Plex Sans, sans-serif',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {t('remove')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#0d1a2e',
              border: '1px solid #1e2d45',
              borderRadius: '10px',
              padding: '24px',
              textAlign: 'center',
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

      {/* ── Empty states for study modes ─────────────────────────────────────── */}
      {activeMode !== 'upload' && (
        <div style={{
          backgroundColor: '#0d1a2e',
          border: '1px solid #1e2d45',
          borderRadius: '16px',
          padding: '72px 32px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <EmptyIcon color={subject.color} mode={activeMode} />
          </div>
          <div style={{
            fontFamily: 'DM Serif Display, serif',
            color: '#f0f4f8',
            fontSize: '1.25rem',
            marginBottom: '8px',
          }}>
            {emptyMessages[activeMode as Exclude<Mode, 'upload'>]}
          </div>
          <button
            onClick={() => setActiveMode('upload')}
            style={{
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              height: '40px',
              padding: '0 20px',
              backgroundColor: subject.color + '14',
              color: subject.color,
              border: `1px solid ${subject.color}30`,
              borderRadius: '8px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = subject.color + '28'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = subject.color + '14'}
          >
            {t('upload_cta')} →
          </button>
        </div>
      )}
    </div>
  );
}

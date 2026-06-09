import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useResolvedSubjects } from '../store/useSubjects';
import { useStore } from '../store/useStore';
import { useActivity } from '../store/useActivity';
import { useToast } from '../components/Toast';
import { generateFromFile } from '../lib/geminiProxy';
import { extractTextFromFile, renderPdfPagesAsJpeg } from '../lib/pdfExtractor';

import { useExamDates } from '../store/useExamDates';
import {
  saveFile, getFiles, deleteFile,
  saveQuiz, getQuizzes, deleteQuiz, type StoredQuiz,
  saveNote, getNotes, deleteNote, type StoredNote,
  saveFlashcardSet, getFlashcardSets, deleteFlashcardSet, type StoredFlashcardSet,
  saveFolder, getFolders, deleteFolder, type Folder, type FolderKind,
  getQuizResults, type QuizResult,
  saveDictionaryEntry, getDictionaryEntries, deleteDictionaryEntry, type DictionaryEntry,
} from '../lib/db';
import {
  isFirebaseConfigured, isSupabaseConfigured,
  uploadFileToStorage, saveCloudFile, getCloudFiles, deleteCloudFile,
  saveCloudNote, getCloudNotes, deleteCloudNote, renameCloudNote,
  saveCloudFlashcardSet, getCloudFlashcardSets, deleteCloudFlashcardSet, renameCloudFlashcardSet,
  saveCloudQuiz, getCloudQuizzes, deleteCloudQuiz, renameCloudQuiz,
  saveCloudFolder, getCloudFolders, deleteCloudFolder,
  migrateSubjectFromIndexedDB,
} from '../lib/cloudDb';
import type {
  GenerationType,
  GeneratedFlashcard,
  GeneratedNote,
  GeneratedQuizQuestion,
} from '../lib/generator';
import { generateDefinition, generateJapaneseDefinition } from '../lib/geminiProxy';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { NotesViewer } from '../components/NotesViewer';
import { QuizViewer } from '../components/QuizViewer';
import { DictionaryView } from '../components/DictionaryView';
import { FlashcardProgressDashboard, QuizProgressDashboard } from '../components/ProgressDashboard';
import { useSRS, subjectSrsStats } from '../store/useSRS';
import { getStudyQueue } from '../lib/srs';

// ── Error helper ───────────────────────────────────────────────────────────────

function friendlyError(raw?: string): string {
  if (!raw) return 'Generation failed.';
  if (raw.includes('401') || raw.includes('API_KEY_INVALID')) return 'Invalid or expired API key. Check the server configuration.';
  if (raw.includes('RESOURCE_EXHAUSTED')) return 'Quota exhausted — try again tomorrow.';
  if (raw.includes('429')) return 'Rate limit hit. Wait 60 seconds and try again.';
  if (raw.includes('unsupported') || raw.includes('Unsupported') || raw.includes('INVALID_ARGUMENT')) return 'File format not supported. Try a PDF or image file.';
  return `Generation failed: ${raw.replace(/^Error:\s*/i, '').slice(0, 140)}`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface UploadedFile {
  id: string; name: string; type: string; size: number;
  url: string; rawFile: File | null; level: string; storageUrl?: string;
  folderId?: string | null; compressing?: boolean;
}

// Treat pre-compressed pages blobs the same as PDF for display purposes.
const isPdfType = (t: string) =>
  t === 'application/pdf' || t === 'application/x-studytrainer-pages';

const PDF_COMPRESS_THRESHOLD = 3 * 1024 * 1024; // 3 MB

type GenStatus = 'idle' | 'generating' | 'done' | 'error';
interface GenState { status: GenStatus; type?: GenerationType; error?: string; }
interface GenProgress { current: number; total: number; }

type View = 'dashboard' | 'upload' | 'flashcards' | 'notes' | 'quiz' | 'dictionary';

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// ── Mini icons ─────────────────────────────────────────────────────────────────

const IconDash   = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>);
const IconPencil = () => (<svg viewBox="0 0 16 16" width="12" height="12" fill="none"><path d="M11 2.5l2.5 2.5-7.5 7.5H3.5v-2.5L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M9.5 4l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>);
const IconFile  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><path d="M4 2h7l4 4v10H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M11 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>);
const IconCards = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="1" y="4" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/><rect x="4" y="2" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>);
const IconNote  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><path d="M3 2h9l4 4v10H3V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 9h8M5 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);
const IconQuiz  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 7c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5c0 1.25-1.25 1.75-2.5 2.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="9" cy="13" r=".9" fill="currentColor"/></svg>);
const IconPlus  = () => (<svg viewBox="0 0 18 18" width="14" height="14" fill="none"><path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IconSparkle = () => (<svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M8 1v4M8 11v4M1 8h4M11 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M3.22 3.22l2.83 2.83M9.95 9.95l2.83 2.83M3.22 12.78l2.83-2.83M9.95 6.05l2.83-2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);
const IconDict  = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><path d="M2 2.5A1.5 1.5 0 013.5 1h11A1.5 1.5 0 0116 2.5v13a1.5 1.5 0 01-1.5 1.5H3.5A1.5 1.5 0 012 15.5v-13z" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5.5h8M5 8.5h8M5 11.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);

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
        <span className="block text-[13px] font-medium leading-tight truncate" style={{ fontFamily: "'Sora',sans-serif" }}>{label}</span>
        {sublabel && <span className="block text-[11px] mt-0.5 leading-tight" style={{ color: active ? '#8B949E' : '#484F58' }}>{sublabel}</span>}
      </span>
      {dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor || '#3D7EFF', boxShadow: `0 0 5px ${dotColor || '#3D7EFF'}` }} />}
    </button>
  );
}

// ── Quiz history panel ────────────────────────────────────────────────────────

function QuizHistoryPanel({ history, onRedo }: {
  history: import('../lib/db').QuizResult[];
  onRedo: (r: import('../lib/db').QuizResult) => void;
}) {
  const { ts } = useLang();
  const [showAll, setShowAll] = useState(false);

  const scoreColor = (pct: number) => pct >= 80 ? '#56D364' : pct >= 60 ? '#D29922' : '#F97979';
  const relDate = (tms: number) => {
    const d = Math.floor((Date.now() - tms) / 86400000);
    if (d === 0) return ts('Today'); if (d === 1) return ts('Yesterday');
    if (d < 7) return `${d}d ago`;
    return new Date(tms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const fmtTime = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60 > 0 ? `${s % 60}s` : ''}`.trim();

  const grouped = history.reduce<Record<string, typeof history>>((acc, r) => {
    (acc[r.quizTitle] ??= []).push(r);
    return acc;
  }, {});

  const totalCorrect = history.reduce((a, r) => a + r.correctAnswers, 0);
  const totalQs = history.reduce((a, r) => a + r.totalQuestions, 0);
  const avgPct = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
  const bestResult = history.reduce<typeof history[0] | null>((best, r) => (!best || r.scorePercent > best.scorePercent) ? r : best, null);

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58' }}>
          {ts('Past Results')}
        </span>
        <div style={{ flex: 1, height: '1px', background: '#21262D' }} />
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', background: '#161B22', border: '1px solid #21262D' }}>
          <span style={{ fontSize: '11px', color: '#484F58' }}>{ts('Average')}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: scoreColor(avgPct) }}>{avgPct}%</span>
          <div style={{ width: '60px', height: '4px', background: '#21262D', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${avgPct}%`, background: scoreColor(avgPct), borderRadius: '999px' }} />
          </div>
          <span style={{ fontSize: '10px', color: '#484F58' }}>{ts('{n} attempts', { n: history.length })}</span>
        </div>
        {bestResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: '#161B22', border: '1px solid #21262D' }}>
            <span style={{ fontSize: '11px', color: '#484F58' }}>{ts('Best')}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#56D364' }}>{bestResult.scorePercent}%</span>
            <span style={{ fontSize: '10px', color: '#484F58' }}>{ts('on {date}', { date: relDate(bestResult.completedAt) })}</span>
          </div>
        )}
      </div>

      {/* Result rows grouped by quiz */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Object.entries(grouped).map(([title, results]) => {
          const shown = showAll ? results : results.slice(0, 5);
          return (
            <div key={title}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B949E', marginBottom: '8px' }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {shown.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '10px 14px', borderRadius: '10px',
                    background: '#161B22', border: '1px solid #21262D',
                  }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                      background: scoreColor(r.scorePercent) + '18',
                      color: scoreColor(r.scorePercent),
                      border: `1px solid ${scoreColor(r.scorePercent)}33`,
                      flexShrink: 0,
                    }}>
                      {r.scorePercent}%
                    </span>
                    <span style={{ fontSize: '11px', color: '#8B949E' }}>{r.correctAnswers} / {r.totalQuestions}</span>
                    <span style={{ fontSize: '10px', color: '#484F58' }}>{relDate(r.completedAt)}</span>
                    <span style={{ fontSize: '10px', color: '#484F58' }}>{fmtTime(r.timeTakenSeconds)}</span>
                    <div style={{ flex: 1 }} />
                    {r.incorrectAnswers > 0 && (
                      <button
                        onClick={() => onRedo(r)}
                        style={{
                          height: '26px', padding: '0 10px', borderRadius: '999px',
                          background: 'rgba(210,153,34,0.1)', color: '#D29922',
                          border: '1px solid rgba(210,153,34,0.3)',
                          fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {ts('Redo wrong →')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {results.length > 5 && (
                <button onClick={() => setShowAll(s => !s)} style={{
                  marginTop: '6px', fontSize: '11px', color: '#484F58', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                }}>
                  {showAll ? ts('Show less') : ts('+ {n} more', { n: results.length - 5 })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ color, onUpload }: { color: string; onUpload: () => void }) {
  const { ts } = useLang();
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
      <div className="text-sm font-semibold mb-2" style={{ color: '#E6EDF3' }}>{ts('No content yet')}</div>
      <div className="text-xs mb-5 text-center max-w-xs" style={{ color: '#8B949E' }}>
        {ts('Upload a file and use AI to generate flashcards, notes, or a quiz.')}
      </div>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 h-9 px-5 text-xs font-semibold border cursor-pointer transition-all duration-300"
        style={{ borderRadius: '999px', background: color + '18', color, borderColor: color + '35' }}
      >
        <IconPlus /> {ts('Add Files')}
      </button>
    </div>
  );
}

// ── Subject Banner ─────────────────────────────────────────────────────────────

function SubjectBanner({
  subject, levelFiles, savedNotes, savedFlashcardSets, savedQuizzes, dictEntries,
  examDate, daysLeft, onExamDateChange, onExamDateClear,
}: {
  subject: import('../data/subjects').SubjectDef;
  levelFiles: UploadedFile[];
  savedNotes: import('../lib/db').StoredNote[];
  savedFlashcardSets: import('../lib/db').StoredFlashcardSet[];
  savedQuizzes: import('../lib/db').StoredQuiz[];
  dictEntries: import('../lib/db').DictionaryEntry[];
  examDate: { subjectId: string; date: string } | undefined;
  daysLeft: number;
  onExamDateChange: (iso: string) => void;
  onExamDateClear: () => void;
}) {
  const { ts } = useLang();
  const totalCards = savedFlashcardSets.reduce((a, s) => a + s.cards.length, 0);

  const pills: { label: string; count: number }[] = [
    { label: `${levelFiles.length} files`, count: levelFiles.length },
    { label: `${savedNotes.length} notes`, count: savedNotes.length },
    { label: `${totalCards} cards`, count: totalCards },
    { label: `${savedQuizzes.length} quizzes`, count: savedQuizzes.length },
    { label: `${dictEntries.length} terms`, count: dictEntries.length },
  ].filter(p => p.count > 0);

  // Dot grid SVG: 8 rows × 12 cols
  const dotGridSvg = () => {
    const dots = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        dots.push(<circle key={`${r}-${c}`} cx={c * 18 + 9} cy={r * 18 + 9} r={1.5} fill={subject.color} />);
      }
    }
    return (
      <svg
        width={12 * 18} height={8 * 18}
        style={{ position: 'absolute', top: 0, right: 0, opacity: 0.07, pointerEvents: 'none' }}
      >
        {dots}
      </svg>
    );
  };

  return (
    <div style={{
      background: `linear-gradient(135deg, ${subject.color}20 0%, ${subject.color}08 55%, #0D1117 100%)`,
      border: `1.5px solid ${subject.color}28`,
      borderRadius: '24px',
      padding: '32px 36px',
      marginBottom: '32px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: -80, right: -80,
        width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, ${subject.color}18 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, left: -60,
        width: 160, height: 160, borderRadius: '50%',
        background: `radial-gradient(circle, ${subject.color}10 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      {/* Dot grid */}
      {dotGridSvg()}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Row 1: title + exam date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          {/* LEFT: title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: subject.color,
                boxShadow: `0 0 14px ${subject.color}`,
                flexShrink: 0,
              }} />
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text-1)' }}>
                {subject.title}
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#8B949E', paddingLeft: 20 }}>
              {subject.description}
            </div>
          </div>

          {/* RIGHT: exam date */}
          <div>
            {examDate ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 999,
                background: subject.color + '18',
                border: `1.5px solid ${subject.color}40`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: subject.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: subject.color }}>
                  {ts('{n} days left', { n: daysLeft })}
                </span>
                <span style={{ fontSize: 10, color: '#8B949E' }}>
                  {examDate.date.replace(/-/g, '/')}
                </span>
                <button
                  onClick={onExamDateClear}
                  style={{ background: 'none', border: 'none', color: '#484F58', cursor: 'pointer', fontSize: 13, padding: '0 0 0 4px', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder={ts('Set exam date')}
                maxLength={10}
                style={{
                  background: 'transparent', border: '1px solid #30363D', borderRadius: 8,
                  color: '#8B949E', padding: '7px 12px', fontSize: 12, outline: 'none',
                  fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em', width: '136px',
                }}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') return;
                  const iso = raw.replace(/\//g, '-');
                  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) onExamDateChange(iso);
                }}
              />
            )}
          </div>
        </div>

        {/* Row 2: quick stat pills */}
        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {pills.length > 0 ? pills.map(p => (
            <span key={p.label} style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              color: '#8B949E', background: '#161B22', border: '1px solid #30363D',
            }}>
              {p.label}
            </span>
          )) : (
            <span style={{ fontSize: 12, color: '#484F58' }}>
              {ts('No content yet — upload files to begin')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section Card ───────────────────────────────────────────────────────────────

function SectionCard({
  icon, label, color, stat, subtext, secondary, onClick, index, inactive,
}: {
  icon: React.ReactNode; label: string; color: string;
  stat: string | number; subtext?: string; secondary?: string;
  onClick: () => void; index: number; inactive?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${inactive ? 'var(--bg-surface)' : color + '10'} 0%, 'var(--bg-surface)' 100%)`,
        border: `1.5px solid ${inactive ? 'var(--border-base)' : color + '30'}`,
        borderRadius: 20,
        padding: 22,
        minHeight: 170,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease, border-color 0.25s ease',
        ['--idx' as string]: index,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-5px)';
        el.style.boxShadow = `0 16px 40px ${color}20, 0 0 0 1.5px ${color}40`;
        el.style.borderColor = color + '55';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.boxShadow = '';
        el.style.borderColor = inactive ? '#21262D' : color + '30';
      }}
    >
      {/* Decorative glow */}
      <div style={{
        position: 'absolute', top: '-70%', right: '-30%',
        width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}08 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: color + '18', color,
        border: `1px solid ${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}>
        {icon}
      </div>

      {/* Bottom content */}
      <div style={{ marginTop: 'auto', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 38, fontWeight: 800, color: inactive ? '#30363D' : 'var(--accent-primary)',
          fontFamily: "'Sora',sans-serif", lineHeight: 1, marginBottom: 4,
          textShadow: inactive ? 'none' : `0 0 25px ${color}35`,
        }}>
          {stat}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: inactive ? '#484F58' : 'var(--text-1)', marginBottom: 3 }}>
          {label}
        </div>
        {subtext && (
          <div style={{ fontSize: 11, color: inactive ? '#30363D' : color + 'BB', fontWeight: 500 }}>
            {subtext}
          </div>
        )}
        {secondary && (
          <div style={{ fontSize: 10, color: '#484F58', marginTop: 4 }}>
            {secondary}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Folder icons ─────────────────────────────────────────────────────────────

const IconFolder = () => (<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><path d="M2 5a1.5 1.5 0 011.5-1.5h3l1.5 2H14.5A1.5 1.5 0 0116 7v6.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 13.5V5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>);
const IconFolderPlus = () => (<svg viewBox="0 0 18 18" width="14" height="14" fill="none"><path d="M2 5a1.5 1.5 0 011.5-1.5h3l1.5 2H14.5A1.5 1.5 0 0116 7v6.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 13.5V5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 8.5v3M7.5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>);

// ── Folder board ─────────────────────────────────────────────────────────────
// Generic drag-and-drop organiser used by every content type. Items carry an
// optional `folderId`; dragging an item onto a folder header (or the Unfiled
// zone) re-files it. Each kind keeps its own set of folders.

function FolderBoard<T extends { id: string; folderId?: string | null }>({
  kind, label, color, folders, items, draggedId, cols = 2, headerExtra,
  onDragStart, onDragEnd, onDropToFolder, onCreateFolder, onDeleteFolder, renderItem, onReorder,
  sortAccessors,
}: {
  kind: FolderKind;
  label: string;
  color: string;
  folders: Folder[];
  items: T[];
  draggedId: string | null;
  cols?: 1 | 2 | 3 | 5;
  headerExtra?: React.ReactNode;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropToFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  renderItem: (item: T) => React.ReactNode;
  onReorder?: (reordered: T[]) => void;
  sortAccessors?: { name: (item: T) => string; date?: (item: T) => number };
}) {
  const { ts } = useLang();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [hoverFolder, setHoverFolder] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  // Per-zone enter-count counters fix the "dragLeave fires on child-enter" bug.
  const enterCounts = useRef<Map<string, number>>(new Map());
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after');
  const [sortKey, setSortKey] = useState<'none' | 'latest' | 'oldest' | 'az' | 'za'>('none');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const isDragging = draggedId != null;
  const gridClass = cols === 1 ? 'grid grid-cols-1 gap-2' : cols === 5 ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2' : cols === 3 ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3';

  const toggleFolder = (folderId: string) => setCollapsedFolders(prev => {
    const next = new Set(prev);
    if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
    return next;
  });

  const submit = () => {
    const n = newName.trim();
    if (n) onCreateFolder(n);
    setNewName(''); setCreating(false);
  };

  const kindFolders = folders.filter(f => f.kind === kind);

  const sortedItems: T[] = (() => {
    if (sortKey === 'none' || !sortAccessors) return items;
    const arr = [...items];
    if (sortKey === 'latest' && sortAccessors.date) return arr.sort((a, b) => sortAccessors.date!(b) - sortAccessors.date!(a));
    if (sortKey === 'oldest' && sortAccessors.date) return arr.sort((a, b) => sortAccessors.date!(a) - sortAccessors.date!(b));
    if (sortKey === 'az') return arr.sort((a, b) => sortAccessors.name(a).localeCompare(sortAccessors.name(b)));
    if (sortKey === 'za') return arr.sort((a, b) => sortAccessors.name(b).localeCompare(sortAccessors.name(a)));
    return arr;
  })();

  const unfiled = sortedItems.filter(it => !it.folderId || !kindFolders.some(f => f.id === it.folderId));

  const zone = (folderId: string | null, children: React.ReactNode) => {
    const key = folderId ?? '__unfiled__';
    const isHover = hoverFolder === key && isDragging;
    const inc = () => { const n = (enterCounts.current.get(key) ?? 0) + 1; enterCounts.current.set(key, n); return n; };
    const dec = () => { const n = Math.max(0, (enterCounts.current.get(key) ?? 0) - 1); enterCounts.current.set(key, n); return n; };
    return (
      <div
        onDragEnter={e => { e.preventDefault(); if (inc() >= 1 && isDragging) setHoverFolder(key); }}
        onDragLeave={() => { if (dec() === 0) setHoverFolder(h => h === key ? null : h); }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDrop={e => {
          e.preventDefault();
          enterCounts.current.set(key, 0);
          setHoverFolder(null);
          onDropToFolder(folderId);
        }}
        style={{
          borderRadius: '16px',
          border: `1px dashed ${isHover ? color : 'transparent'}`,
          background: isHover ? color + '0E' : 'transparent',
          padding: isDragging ? '4px' : 0,
          minHeight: isDragging ? '48px' : undefined,
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {children}
      </div>
    );
  };

  // Wrap each draggable item. Handles two modes:
  // - Drop on item in same folder → reorder (calls onReorder)
  // - Drop on item in different folder → move to that folder (calls onDropToFolder)
  // Zone-level drops (folder headers, empty areas) still handled by zone().
  const draggableItem = (it: T) => {
    const isDropTarget = dragOverItemId === it.id && draggedId !== null && draggedId !== it.id;
    return (
      <div
        key={it.id}
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('text/plain', it.id);
          e.dataTransfer.effectAllowed = 'move';
          requestAnimationFrame(() => onDragStart(it.id));
        }}
        onDragEnd={() => {
          enterCounts.current.clear();
          setHoverFolder(null);
          setDragOverItemId(null);
          onDragEnd();
        }}
        onDragEnter={e => {
          e.preventDefault();
          e.stopPropagation();
          if (draggedId && draggedId !== it.id) setDragOverItemId(it.id);
        }}
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDropPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
        }}
        onDragLeave={e => {
          e.stopPropagation();
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            setDragOverItemId(null);
          }
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          if (!draggedId || draggedId === it.id) { setDragOverItemId(null); return; }
          const dragSrc = items.find(x => x.id === draggedId);
          if (!dragSrc) { setDragOverItemId(null); return; }
          const kFolders = folders.filter(f => f.kind === kind);
          const srcFolder = dragSrc.folderId && kFolders.some(f => f.id === dragSrc.folderId) ? dragSrc.folderId : null;
          const tgtFolder = it.folderId && kFolders.some(f => f.id === it.folderId) ? it.folderId : null;
          enterCounts.current.clear();
          setHoverFolder(null);
          if (srcFolder !== tgtFolder) {
            onDropToFolder(tgtFolder);
          } else if (onReorder && sortKey === 'none') {
            const without = sortedItems.filter(x => x.id !== draggedId);
            const tgtIdx = without.findIndex(x => x.id === it.id);
            const insertIdx = dropPosition === 'after' ? tgtIdx + 1 : tgtIdx;
            onReorder([...without.slice(0, insertIdx), dragSrc, ...without.slice(insertIdx)]);
            onDragEnd();
          }
          setDragOverItemId(null);
        }}
        style={{
          position: 'relative',
          opacity: draggedId === it.id ? 0.35 : 1,
          cursor: 'grab',
          transition: 'opacity 0.15s',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {isDropTarget && dropPosition === 'before' && (
          <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: '2px', background: color, borderRadius: '1px', zIndex: 10, pointerEvents: 'none' }} />
        )}
        <div style={{ pointerEvents: isDragging ? 'none' : 'auto' }}>
          {renderItem(it)}
        </div>
        {isDropTarget && dropPosition === 'after' && (
          <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '2px', background: color, borderRadius: '1px', zIndex: 10, pointerEvents: 'none' }} />
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
          {label} ({items.length}){kindFolders.length > 0 && ` · ${ts('{n} folders', { n: kindFolders.length })}`}
        </div>
        <div className="flex items-center gap-3 ml-auto">
        {/* Sort dropdown */}
        {sortAccessors && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSortMenu(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: sortKey !== 'none' ? color + '14' : 'transparent',
                color: sortKey !== 'none' ? color : '#8B949E',
                border: `1px solid ${sortKey !== 'none' ? color + '33' : '#30363D'}`,
                borderRadius: '999px', fontSize: '11px', fontWeight: 600, padding: '5px 10px',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <svg viewBox="0 0 14 14" width="11" height="11" fill="none">
                <path d="M2 3h10M4 7h6M6 11h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {sortKey === 'none' ? ts('Sort') : sortKey === 'latest' ? ts('Latest') : sortKey === 'oldest' ? ts('Oldest') : sortKey === 'az' ? 'A → Z' : 'Z → A'}
            </button>
            {showSortMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowSortMenu(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#161B22', border: '1px solid #30363D', borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: '4px', zIndex: 50,
                  minWidth: '136px',
                }}>
                  {([
                    { key: 'none',   label: ts('Default order') },
                    { key: 'latest', label: ts('Latest first') },
                    { key: 'oldest', label: ts('Oldest first') },
                    { key: 'az',     label: 'A → Z' },
                    { key: 'za',     label: 'Z → A' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setSortKey(key); setShowSortMenu(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 12px', borderRadius: '8px',
                        background: sortKey === key ? color + '14' : 'transparent',
                        color: sortKey === key ? color : '#C9D1D9',
                        border: 'none', cursor: 'pointer',
                        fontSize: '12px', fontWeight: sortKey === key ? 600 : 400,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {headerExtra}
        {creating ? (
          <input
            autoFocus value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={submit}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setNewName(''); setCreating(false); } }}
            placeholder={ts('Folder name…')}
            style={{ background: '#0D1117', border: `1px solid ${color}55`, borderRadius: '999px', color: '#E6EDF3', fontSize: '11px', padding: '5px 12px', outline: 'none', width: '160px' }}
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 cursor-pointer"
            style={{ background: color + '14', color, border: `1px solid ${color}33`, borderRadius: '999px', fontSize: '11px', fontWeight: 600, padding: '5px 12px' }}
          >
            <IconFolderPlus /> {ts('New folder')}
          </button>
        )}
        </div>
      </div>

      {isDragging && (
        <div className="mb-3 text-[11px]" style={{ color: color }}>
          {ts('Drop onto a folder to organise, or onto “Unfiled” to remove.')}
        </div>
      )}

      {/* Folder sections */}
      {kindFolders.map(folder => {
        const folderItems = sortedItems.filter(it => it.folderId === folder.id);
        const isCollapsed = collapsedFolders.has(folder.id);
        return (
          <div key={folder.id} style={{ marginBottom: '18px' }}>
            {zone(folder.id, <>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <button
                  onClick={() => toggleFolder(folder.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1, minWidth: 0 }}
                >
                  <span style={{ color }}><IconFolder /></span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', flex: 1, textAlign: 'left' }}>{folder.name}</span>
                  <span style={{ fontSize: '11px', color: '#8B949E' }}>{folderItems.length}</span>
                  <svg viewBox="0 0 10 6" width="10" height="10" fill="none" style={{ flexShrink: 0, transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: '#484F58' }}>
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => onDeleteFolder(folder.id)}
                  aria-label={ts('Delete folder')}
                  className="cursor-pointer"
                  style={{ background: 'transparent', border: 'none', color: '#484F58', padding: '2px', lineHeight: 0, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#484F58')}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              {!isCollapsed && (folderItems.length === 0 ? (
                <div className="px-1 pb-1 text-[11px]" style={{ color: '#484F58' }}>{ts('Empty — drag items here.')}</div>
              ) : (
                <div className={gridClass}>
                  {folderItems.map(it => draggableItem(it))}
                </div>
              ))}
            </>)}
          </div>
        );
      })}

      {/* Unfiled */}
      {zone(null, <>
        {kindFolders.length > 0 && (
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#8B949E' }}>{ts('Unfiled')}</span>
            <span style={{ fontSize: '11px', color: '#484F58' }}>{unfiled.length}</span>
          </div>
        )}
        <div className={gridClass}>
          {unfiled.map(it => draggableItem(it))}
        </div>
      </>)}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t, ts } = useLang();
  const { allSubjects } = useResolvedSubjects();
  const { toast } = useToast();
  const visitSubject = useStore(s => s.visitSubject);
  const recordActivity = useActivity(s => s.record);
  const subject = allSubjects.find(s => s.id === id);

  const [activeLevel, setActiveLevel] = useState(subject?.levels?.[0] ?? '');
  const [view, setView] = useState<View>('dashboard');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [activeSidebarFileId, setActiveSidebarFileId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<GenerationType>('flashcards');
  const [genState, setGenState] = useState<GenState>({ status: 'idle' });
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [quizCount, setQuizCount] = useState(10);
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [cardCount, setCardCount] = useState(0); // 0 = undecided; multiples of 5 up to 50
  const [flashcardMode, setFlashcardMode] = useState<'standard' | 'vocabulary'>('standard');
  const [focusTopic, setFocusTopic] = useState('');
  const [notesDetail, setNotesDetail] = useState<'concise' | 'standard' | 'comprehensive'>('standard');
  const [notesIncludes, setNotesIncludes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedQuizzes, setSavedQuizzes] = useState<StoredQuiz[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([]);
  const [redoingResult, setRedoingResult] = useState<QuizResult | null>(null);
  const [savedNotes, setSavedNotes] = useState<StoredNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [savedFlashcardSets, setSavedFlashcardSets] = useState<StoredFlashcardSet[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [draggedItem, setDraggedItem] = useState<{ kind: FolderKind; id: string } | null>(null);
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genLanguage, setGenLanguage] = useState<'english' | 'japanese' | 'both'>('english');
  const [dictEntries, setDictEntries] = useState<DictionaryEntry[]>([]);
  const [dictPending, setDictPending] = useState<{ id: string; term: string }[]>([]);
  const [expandedSidebarFolderIds, setExpandedSidebarFolderIds] = useState<Set<string>>(new Set());
  const srsCards = useSRS(s => s.cards);

  // Refs so async callbacks always read the latest values without stale closures
  const filesRef = useRef<UploadedFile[]>([]);
  filesRef.current = files;

  // ── Load persisted data when subject changes ───────────────────────────────
  useEffect(() => {
    if (!id) return;

    visitSubject(id);

    // Reset all state when navigating to a different subject
    setFiles([]);
    setSelectedFileIds([]);
    setActiveSidebarFileId(null);
    setSidebarFilesExpanded(false);
    setSavedQuizzes([]);
    setActiveQuizId(null);
    setSavedNotes([]);
    setActiveNoteId(null);
    setSavedFlashcardSets([]);
    setActiveSetId(null);
    setFolders([]);
    setView('dashboard');
    setGenState({ status: 'idle' });

    async function loadPersisted() {
      try {
        if (isFirebaseConfigured) {
          await migrateSubjectFromIndexedDB(id!);
          const [cloudFiles, cloudQuizzes, cloudNotes, cloudSets, cloudFolders, localHistory] = await Promise.all([
            getCloudFiles(id!),
            getCloudQuizzes(id!),
            getCloudNotes(id!),
            getCloudFlashcardSets(id!),
            getCloudFolders(id!),
            getQuizResults(id!),
          ]);
          setQuizHistory(localHistory);
          if (cloudFolders.length > 0) setFolders(cloudFolders);
          if (cloudQuizzes.length > 0) setSavedQuizzes(cloudQuizzes);
          if (cloudNotes.length > 0) setSavedNotes(cloudNotes);
          if (cloudSets.length > 0) setSavedFlashcardSets(cloudSets);
          // Also load locally-saved files (fallback blobs from failed cloud uploads).
          const localFiles = await getFiles(id!).catch(() => []);
          const localById = new Map(localFiles.map(f => [f.id, f]));

          if (cloudFiles.length > 0 || localFiles.length > 0) {
            // Merge: cloud records take priority; attach local blob when available.
            const cloudMapped: UploadedFile[] = cloudFiles.map(cf => {
              const local = localById.get(cf.id);
              const rawFile = local?.blob ? new File([local.blob], cf.name, { type: cf.type }) : null;
              return { id: cf.id, name: cf.name, type: cf.type, size: cf.size, url: cf.storageUrl, rawFile, level: cf.level, storageUrl: cf.storageUrl, folderId: cf.folderId ?? null };
            });
            // Include local-only files not present in the cloud list.
            const cloudIds = new Set(cloudFiles.map(cf => cf.id));
            const localOnlyMapped: UploadedFile[] = localFiles
              .filter(f => !cloudIds.has(f.id))
              .map(sf => ({ id: sf.id, name: sf.name, type: sf.type, size: sf.size, url: URL.createObjectURL(sf.blob), rawFile: new File([sf.blob], sf.name, { type: sf.type }), level: sf.level, folderId: sf.folderId ?? null }));
            setFiles([...cloudMapped, ...localOnlyMapped]);
          }
        } else {
          const [storedFiles, storedQuizzes, storedNotes, storedSets, storedFolders, storedHistory] = await Promise.all([
            getFiles(id!),
            getQuizzes(id!),
            getNotes(id!),
            getFlashcardSets(id!),
            getFolders(id!),
            getQuizResults(id!),
          ]);
          setQuizHistory(storedHistory);
          if (storedFolders.length > 0) setFolders(storedFolders);
          if (storedQuizzes.length > 0) setSavedQuizzes(storedQuizzes.sort((a, b) => b.createdAt - a.createdAt));
          if (storedNotes.length > 0) setSavedNotes(storedNotes.sort((a, b) => b.createdAt - a.createdAt));
          if (storedSets.length > 0) setSavedFlashcardSets(storedSets.sort((a, b) => b.createdAt - a.createdAt));
          if (storedFiles.length > 0) {
            const mapped: UploadedFile[] = storedFiles.map(sf => ({
              id: sf.id, name: sf.name, type: sf.type, size: sf.size,
              url: URL.createObjectURL(sf.blob),
              rawFile: new File([sf.blob], sf.name, { type: sf.type }),
              level: sf.level,
              folderId: sf.folderId ?? null,
            }));
            setFiles(mapped);
          }
        }
      } catch (err) {
        console.error('Failed to load persisted subject data:', err);
      }
      // Dictionary entries are always local-only (not shared via cloud)
      getDictionaryEntries(id!).then(entries => {
        setDictEntries(entries.sort((a, b) => a.term.localeCompare(b.term)));
      }).catch(() => {});
    }

    loadPersisted();

    return () => {
      filesRef.current.forEach(f => { if (f.url.startsWith('blob:')) URL.revokeObjectURL(f.url); });
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File management ────────────────────────────────────────────────────────
  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const all = Array.from(newFiles);
    const valid = all.filter(f => ACCEPTED.includes(f.type));
    const rejected = all.length - valid.length;
    if (rejected > 0) {
      toast('error', ts('{n} files skipped', { n: rejected }), ts('Only PDF and image files are supported.'));
    }
    if (valid.length === 0) return;

    // Add all files to state immediately; mark large PDFs as compressing.
    const entries: UploadedFile[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name, type: f.type, size: f.size,
      url: URL.createObjectURL(f), rawFile: f, level: activeLevel,
      compressing: f.type === 'application/pdf' && f.size > PDF_COMPRESS_THRESHOLD,
    }));
    setFiles(prev => [...prev, ...entries]);
    setSelectedFileIds(prev => [...prev, ...entries.map(e => e.id)]);
    toast('success', ts('{n} files added', { n: entries.length }), undefined);

    // Process each file: compress large scanned PDFs to pre-rendered JPEG pages.
    const finalFiles: Array<{ entry: UploadedFile; file: File; type: string }> = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rawFile = valid[i];
      let fileToStore: File = rawFile;
      let typeToStore = rawFile.type;

      if (rawFile.type === 'application/pdf' && rawFile.size > PDF_COMPRESS_THRESHOLD) {
        try {
          const text = await extractTextFromFile(rawFile);
          if (!text.trim()) {
            // Scanned PDF: render pages as compressed JPEG images and store as custom format.
            const pages = await renderPdfPagesAsJpeg(rawFile, 15, 0.65);
            const blob = new File([JSON.stringify(pages)], rawFile.name, { type: 'application/x-studytrainer-pages' });
            fileToStore = blob;
            typeToStore = 'application/x-studytrainer-pages';
          }
        } catch (compressErr) {
          console.warn('[compress] PDF compression failed, keeping original:', compressErr);
        }
      }

      setFiles(prev => prev.map(f =>
        f.id === entry.id
          ? { ...f, rawFile: fileToStore, type: typeToStore, size: fileToStore.size, compressing: false }
          : f,
      ));
      await saveFile({ id: entry.id, subjectId: id!, name: rawFile.name, type: typeToStore, size: fileToStore.size, level: activeLevel, blob: fileToStore }).catch(() => {});
      finalFiles.push({ entry, file: fileToStore, type: typeToStore });
    }

    // Best-effort cloud sync — never blocks or errors the user.
    if (isFirebaseConfigured && isSupabaseConfigured) {
      for (const { entry, file, type } of finalFiles) {
        try {
          const storageUrl = await uploadFileToStorage(id!, entry.id, file);
          await saveCloudFile({ id: entry.id, subjectId: id!, name: entry.name, type, size: file.size, level: activeLevel, storageUrl, createdAt: Date.now() });
          setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, storageUrl } : f));
        } catch (err) {
          console.warn('[CloudSync] Supabase upload failed for', entry.name, '—', err instanceof Error ? err.message : err);
        }
      }
    }
  }, [activeLevel, id, toast, ts]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === fileId);
      if (f?.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
      return prev.filter(x => x.id !== fileId);
    });
    setSelectedFileIds(prev => prev.filter(fid => fid !== fileId));
    // Always wipe the local IndexedDB copy so it doesn't reappear on next load
    // via the local-only merge path, even when cloud sync is active.
    deleteFile(fileId).catch(() => {});
    if (isFirebaseConfigured) deleteCloudFile(id!, fileId).catch(() => {});
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(fid => fid !== fileId) : [...prev, fileId]
    );
  };

  const removeQuiz = (quizId: string) => {
    setSavedQuizzes(prev => prev.filter(q => q.id !== quizId));
    if (activeQuizId === quizId) setActiveQuizId(null);
    if (isFirebaseConfigured) deleteCloudQuiz(quizId).catch(() => {}); else deleteQuiz(quizId).catch(() => {});
  };

  const removeNote = (noteId: string) => {
    setSavedNotes(prev => prev.filter(n => n.id !== noteId));
    if (activeNoteId === noteId) setActiveNoteId(null);
    if (isFirebaseConfigured) deleteCloudNote(noteId).catch(() => {}); else deleteNote(noteId).catch(() => {});
  };

  const removeSet = (setId: string) => {
    setSavedFlashcardSets(prev => prev.filter(s => s.id !== setId));
    if (activeSetId === setId) setActiveSetId(null);
    if (isFirebaseConfigured) deleteCloudFlashcardSet(setId).catch(() => {}); else deleteFlashcardSet(setId).catch(() => {});
  };

  // ── Rename ─────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [sidebarFilesExpanded, setSidebarFilesExpanded] = useState(false);
  const [fullFocus, setFullFocus] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { dates: examDatesList, setDate: setExamDate, removeDate: removeExamDate } = useExamDates();

  useEffect(() => {
    if (fullFocus && (view !== 'notes' || !activeNoteId)) setFullFocus(false);
  }, [view, activeNoteId]);

  useEffect(() => {
    const active = fullFocus && view === 'notes';
    document.body.classList.toggle('notes-focus-active', active);
    return () => { document.body.classList.remove('notes-focus-active'); };
  }, [fullFocus, view]);

  useEffect(() => {
    const reading = view === 'notes' && !!activeNoteId;
    document.body.classList.toggle('notes-reading', reading);
    return () => { document.body.classList.remove('notes-reading'); };
  }, [view, activeNoteId]);

  const examDate = examDatesList.find(d => d.subjectId === id);

  const [renaming, setRenaming] = useState<{ id: string; value: string; kind: 'quiz' | 'note' | 'set' | 'file' } | null>(null);

  const startRename = (itemId: string, currentName: string, kind: 'quiz' | 'note' | 'set' | 'file' = 'set') => {
    setRenaming({ id: itemId, value: currentName, kind });
  };

  const commitRename = (type: 'quiz' | 'note' | 'set' | 'file') => {
    if (!renaming) return;
    const name = renaming.value.trim();
    if (!name) { setRenaming(null); return; }
    if (type === 'quiz') {
      setSavedQuizzes(prev => prev.map(q => q.id === renaming.id ? { ...q, name } : q));
      if (isFirebaseConfigured) {
        renameCloudQuiz(renaming.id, name).catch(() => {});
      } else {
        const quiz = savedQuizzes.find(q => q.id === renaming.id);
        if (quiz) saveQuiz({ ...quiz, name }).catch(() => {});
      }
    } else if (type === 'note') {
      setSavedNotes(prev => prev.map(n => n.id === renaming.id ? { ...n, name } : n));
      if (isFirebaseConfigured) {
        renameCloudNote(renaming.id, name).catch(() => {});
      } else {
        const note = savedNotes.find(n => n.id === renaming.id);
        if (note) saveNote({ ...note, name }).catch(() => {});
      }
    } else if (type === 'file') {
      setFiles(prev => prev.map(f => f.id === renaming.id ? { ...f, name } : f));
      if (isFirebaseConfigured) {
        const file = files.find(f => f.id === renaming.id);
        if (file) {
          saveCloudFile({
            id: file.id, subjectId: id!, name, type: file.type, size: file.size,
            level: file.level, storageUrl: file.storageUrl ?? '', createdAt: Date.now(),
            folderId: file.folderId ?? undefined,
          }).catch(() => {});
        }
      }
    } else {
      setSavedFlashcardSets(prev => prev.map(s => s.id === renaming.id ? { ...s, name } : s));
      if (isFirebaseConfigured) {
        renameCloudFlashcardSet(renaming.id, name).catch(() => {});
      } else {
        const set = savedFlashcardSets.find(s => s.id === renaming.id);
        if (set) saveFlashcardSet({ ...set, name }).catch(() => {});
      }
    }
    setRenaming(null);
  };

  function daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const toggleInclude = (item: string) =>
    setNotesIncludes(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);

  // ── Folders ────────────────────────────────────────────────────────────────
  const createFolder = (kind: FolderKind, name: string) => {
    const folder: Folder = {
      id: `folder-${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      subjectId: id!, kind, name, createdAt: Date.now(),
    };
    setFolders(prev => [...prev, folder]);
    if (isFirebaseConfigured) saveCloudFolder(folder).catch(() => {});
    else saveFolder(folder).catch(() => {});
  };

  const removeFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    // Orphan any items in this folder back to "Unfiled".
    moveAllOutOfFolder(folderId);
    if (isFirebaseConfigured) deleteCloudFolder(folderId).catch(() => {});
    else deleteFolder(folderId).catch(() => {});
  };

  const persistFileFolder = (file: UploadedFile, folderId: string | null) => {
    if (isFirebaseConfigured) {
      saveCloudFile({
        id: file.id, subjectId: id!, name: file.name, type: file.type, size: file.size,
        level: file.level, storageUrl: file.storageUrl ?? '', createdAt: Date.now(), folderId,
      }).catch(() => {});
    } else if (file.rawFile) {
      saveFile({
        id: file.id, subjectId: id!, name: file.name, type: file.type, size: file.size,
        level: file.level, blob: file.rawFile, folderId,
      }).catch(() => {});
    }
  };

  const moveItemToFolder = (kind: FolderKind, itemId: string, folderId: string | null) => {
    if (kind === 'file') {
      setFiles(prev => prev.map(f => {
        if (f.id !== itemId) return f;
        const updated = { ...f, folderId };
        persistFileFolder(updated, folderId);
        return updated;
      }));
    } else if (kind === 'quiz') {
      setSavedQuizzes(prev => prev.map(q => {
        if (q.id !== itemId) return q;
        const updated = { ...q, folderId };
        if (isFirebaseConfigured) saveCloudQuiz({ ...updated, subjectId: id! }).catch(() => {});
        else saveQuiz(updated).catch(() => {});
        return updated;
      }));
    } else if (kind === 'note') {
      setSavedNotes(prev => prev.map(n => {
        if (n.id !== itemId) return n;
        const updated = { ...n, folderId };
        if (isFirebaseConfigured) saveCloudNote({ ...updated, subjectId: id! }).catch(() => {});
        else saveNote(updated).catch(() => {});
        return updated;
      }));
    } else {
      setSavedFlashcardSets(prev => prev.map(s => {
        if (s.id !== itemId) return s;
        const updated = { ...s, folderId };
        if (isFirebaseConfigured) saveCloudFlashcardSet({ ...updated, subjectId: id! }).catch(() => {});
        else saveFlashcardSet(updated).catch(() => {});
        return updated;
      }));
    }
  };

  // When a folder is deleted, drop every item it held back to Unfiled.
  const moveAllOutOfFolder = (folderId: string) => {
    files.filter(f => f.folderId === folderId).forEach(f => moveItemToFolder('file', f.id, null));
    savedQuizzes.filter(q => q.folderId === folderId).forEach(q => moveItemToFolder('quiz', q.id, null));
    savedNotes.filter(n => n.folderId === folderId).forEach(n => moveItemToFolder('note', n.id, null));
    savedFlashcardSets.filter(s => s.folderId === folderId).forEach(s => moveItemToFolder('card', s.id, null));
  };

  const handleItemDrop = (kind: FolderKind, folderId: string | null) => {
    if (draggedItem && draggedItem.kind === kind) {
      moveItemToFolder(kind, draggedItem.id, folderId);
    }
    setDraggedItem(null);
  };

  // ── Dictionary ─────────────────────────────────────────────────────────────
  const addToDictionary = async (term: string, sourceNoteTitle?: string, sourceNoteId?: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const pendingId = Math.random().toString(36).slice(2);
    setDictPending(p => [...p, { id: pendingId, term: trimmed }]);
    toast('info', `Adding "${trimmed}" to dictionary…`);
    try {
      const definition = await generateDefinition(trimmed, subject?.title ?? '');
      const entry: DictionaryEntry = {
        id: `dict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subjectId: id!,
        term: trimmed,
        definition,
        sourceNoteTitle,
        sourceNoteId,
        createdAt: Date.now(),
      };
      await saveDictionaryEntry(entry);
      setDictEntries(prev => [...prev, entry].sort((a, b) => a.term.localeCompare(b.term)));
      toast('success', `"${trimmed}" added to dictionary`, definition.replace(/^[•\-*]\s*/gm, '').trim());
    } catch (err) {
      toast('error', `Failed to define "${trimmed}"`, friendlyError(String(err)));
    } finally {
      setDictPending(p => p.filter(x => x.id !== pendingId));
    }
  };

  const addToJapaneseDictionary = async (term: string, sourceNoteTitle?: string, sourceNoteId?: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const pendingId = Math.random().toString(36).slice(2);
    setDictPending(p => [...p, { id: pendingId, term: trimmed }]);
    toast('info', `翻訳中 "${trimmed}"…`);
    try {
      const definition = await generateJapaneseDefinition(trimmed, subject?.title ?? '');
      const entry: DictionaryEntry = {
        id: `dict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subjectId: id!,
        term: trimmed,
        definition,
        folder: '翻訳',
        sourceNoteTitle,
        sourceNoteId,
        createdAt: Date.now(),
      };
      await saveDictionaryEntry(entry);
      setDictEntries(prev => [...prev, entry].sort((a, b) => a.term.localeCompare(b.term)));
      toast('success', `"${trimmed}" を翻訳しました`, definition.replace(/^[•\-*]\s*/gm, '').trim());
    } catch (err) {
      toast('error', `翻訳に失敗しました "${trimmed}"`, friendlyError(String(err)));
    } finally {
      setDictPending(p => p.filter(x => x.id !== pendingId));
    }
  };

  // ── Generation ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const selectedFiles = levelFiles.filter(f => selectedFileIds.includes(f.id));
    if (selectedFiles.length === 0) return;
    if (selectedFiles.some(f => f.compressing)) {
      toast('info', 'PDF still compressing', 'Please wait a moment and try again.');
      return;
    }
    try {
      setGenState({ status: 'generating', type: selectedType });
      setGenProgress({ current: 0, total: selectedFiles.length });

      const results: unknown[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        setGenProgress({ current: i + 1, total: selectedFiles.length });
        let fileForGen = selectedFiles[i].rawFile;
        if (!fileForGen) {
          // Try local IndexedDB first (covers failed cloud uploads with local fallback).
          const local = await import('../lib/db').then(m => m.getFiles(id!)).catch(() => []);
          const localMatch = local.find(f => f.id === selectedFiles[i].id);
          if (localMatch?.blob) {
            fileForGen = new File([localMatch.blob], selectedFiles[i].name, { type: selectedFiles[i].type });
          } else {
            const url = selectedFiles[i].storageUrl;
            if (!url) throw new Error(`File "${selectedFiles[i].name}" is no longer available. Please re-upload it.`);
            try {
              const blob = await fetch(url).then(r => r.blob());
              fileForGen = new File([blob], selectedFiles[i].name, { type: selectedFiles[i].type });
            } catch {
              throw new Error(`Could not download "${selectedFiles[i].name}" from cloud storage. Please re-upload the file.`);
            }
          }
        }
        const result = await generateFromFile(fileForGen, selectedType, subject!.title, {
          cardCount: cardCount === 0 ? undefined : cardCount,
          questionCount: quizCount,
          difficulty: quizDifficulty,
          focusTopic: focusTopic.trim() || undefined,
          notesDetail,
          notesIncludes,
          customPrompt: customPrompt.trim() || undefined,
          language: genLanguage,
          flashcardMode: selectedType === 'flashcards' ? flashcardMode : undefined,
        });
        results.push(result);
      }

      // A friendly name derived from the source file(s) — shared across types
      const baseNames = selectedFiles.map(f => f.name.replace(/\.[^.]+$/, ''));
      const name = baseNames.length === 1
        ? baseNames[0]
        : `${baseNames[0]} +${baseNames.length - 1} more`;
      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      if (selectedType === 'quiz') {
        // Each generation is saved as its own quiz in the "previous quizzes" folder
        const allQuestions = (results as GeneratedQuizQuestion[][]).flat().map((q, i) => ({ ...q, id: `m${i}-${q.id}` }));
        const quiz: StoredQuiz = {
          id: `quiz-${uid()}`,
          subjectId: id!,
          name,
          createdAt: Date.now(),
          questions: allQuestions,
        };
        if (isFirebaseConfigured) {
          await saveCloudQuiz({ id: quiz.id, subjectId: id!, name, createdAt: quiz.createdAt, questions: quiz.questions }).catch(() => {});
        } else {
          await saveQuiz(quiz).catch(() => {});
        }
        setSavedQuizzes(prev => [quiz, ...prev]);
        setActiveQuizId(quiz.id);
      } else if (selectedType === 'flashcards') {
        // Each generation is saved as its own flashcard set in the folder
        const cards = (results as GeneratedFlashcard[][]).flat();
        const set: StoredFlashcardSet = {
          id: `set-${uid()}`,
          subjectId: id!,
          name,
          createdAt: Date.now(),
          cards,
        };
        if (isFirebaseConfigured) {
          await saveCloudFlashcardSet({ id: set.id, subjectId: id!, name, createdAt: set.createdAt, cards: set.cards }).catch(() => {});
        } else {
          await saveFlashcardSet(set).catch(() => {});
        }
        setSavedFlashcardSets(prev => [set, ...prev]);
        setActiveSetId(set.id);
      } else {
        // Each generation is saved as its own note in the notes folder
        let note: GeneratedNote;
        if (results.length === 1) {
          note = results[0] as GeneratedNote;
        } else {
          const sections = (results as GeneratedNote[]).flatMap(n => n.sections);
          note = { title: name, summary: `Combined notes from ${results.length} files.`, sections };
        }
        const stored: StoredNote = {
          id: `note-${uid()}`,
          subjectId: id!,
          name,
          createdAt: Date.now(),
          note,
        };
        if (isFirebaseConfigured) {
          await saveCloudNote({ id: stored.id, subjectId: id!, name, createdAt: stored.createdAt, note: stored.note }).catch(() => {});
        } else {
          await saveNote(stored).catch(() => {});
        }
        setSavedNotes(prev => [stored, ...prev]);
        setActiveNoteId(stored.id);
      }

      setGenState({ status: 'done', type: selectedType });
      setView(selectedType);
      const typeLabel = selectedType === 'flashcards' ? ts('Flashcards') : selectedType === 'quiz' ? ts('Quiz') : ts('Notes');
      toast('success', ts('{type} ready', { type: typeLabel }), ts('Generated from {n} files.', { n: selectedFiles.length }));
      recordActivity({ type: 'generate', subjectId: subject!.id, subjectName: subject!.title, detail: `Generated ${typeLabel.toLowerCase()} for ${subject!.title}` });
    } catch (err) {
      setGenState({ status: 'error', type: selectedType, error: String(err) });
      toast('error', ts('Generation failed'), ts(friendlyError(String(err))));
    } finally {
      setGenProgress(null);
    }
  };

  if (!subject) {
    return (
      <div className="text-center py-20 px-6">
        <div className="text-2xl mb-3" style={{ fontFamily: "'Sora',sans-serif", color: '#E6EDF3' }}>{ts('Subject not found')}</div>
        <Link to="/" className="text-sm no-underline" style={{ color: '#3D7EFF' }}>{t('back')}</Link>
      </div>
    );
  }

  const levelFiles = files.filter(f => !subject.levels || f.level === activeLevel);
  const isGenerating = genState.status === 'generating';
  const selectedLevelFileIds = selectedFileIds.filter(id => levelFiles.some(f => f.id === id));

  return (
    <div className="subject-page-root" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)' }}>

      {/* ── Header strip ────────────────────────────────────────────────────── */}
      <div className="subject-breadcrumb-strip flex items-center gap-3 flex-shrink-0 px-4 py-3 md:px-7 md:py-4" style={{
        borderBottom: '1px solid #21262D',
        background: 'var(--bg-page)',
      }}>
        <Link to="/" className="flex-shrink-0 transition-colors" style={{ color: '#8B949E', textDecoration: 'none', fontSize: '12px', fontWeight: 500 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#E6EDF3')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8B949E')}>
          {t('nav_dashboard')}
        </Link>
        <span className="flex-shrink-0" style={{ color: '#484F58', fontSize: '11px' }}>›</span>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: subject.color, boxShadow: `0 0 8px ${subject.color}`, flexShrink: 0 }} />
        <div className="flex-1 min-w-0 flex items-baseline gap-2.5">
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '15px', color: '#E6EDF3' }}>
            {subject.title}
          </span>
          {view !== 'dashboard' && (
            <>
              <span className="flex-shrink-0 hidden sm:inline" style={{ color: '#484F58', fontSize: '11px' }}>›</span>
              <span className="hidden sm:inline" style={{ fontSize: '12px', fontWeight: 500, color: '#8B949E', textTransform: 'capitalize' }}>
                {view === 'upload' ? ts('Files') : view}
              </span>
            </>
          )}
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
      <div className="subject-mobile-tabs md:hidden flex items-center gap-1 px-3 py-2 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #21262D', background: 'var(--bg-page)' }}>
        {([
          { id: 'dashboard',  label: ts('Overview'), dot: false },
          { id: 'upload',     label: ts('Files'),    dot: false },
          { id: 'flashcards', label: ts('Cards'),    dot: savedFlashcardSets.length > 0 },
          { id: 'notes',      label: ts('Notes'),    dot: savedNotes.length > 0 },
          { id: 'quiz',       label: ts('Quizzes'),  dot: savedQuizzes.length > 0 },
        ] as { id: View; label: string; dot: boolean }[]).map(({ id, label, dot }) => (
          <button
            key={id}
            onClick={() => {
              if (id === 'quiz') setActiveQuizId(null);
              if (id === 'notes') setActiveNoteId(null);
              if (id === 'flashcards') setActiveSetId(null);
              setView(id);
            }}
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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Show-sidebar button when collapsed — desktop only */}
        {!sidebarOpen && (
          <button
            className="hidden md:flex"
            onClick={() => setSidebarOpen(true)}
            title={ts('Show sidebar')}
            style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              zIndex: 30, width: '20px', height: '48px', borderRadius: '0 8px 8px 0',
              background: 'var(--bg-surface)', border: '1px solid #30363D', borderLeft: 'none',
              color: '#8B949E', cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px',
            }}
          >
            ►
          </button>
        )}

        {/* Left sidebar — hidden on mobile */}
        <aside className="subject-sidebar hidden md:flex flex-col" style={{
          width: sidebarOpen ? '360px' : '0',
          flexShrink: 0,
          borderRight: sidebarOpen ? '1px solid #21262D' : 'none',
          background: 'var(--bg-page)',
          overflow: 'hidden',
          transition: 'width 0.25s ease',
        }}>
          {/* Sidebar header — sticky */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: sidebarOpen ? '20px 20px 12px' : '0',
            flexShrink: 0,
            borderBottom: '1px solid #21262D',
            background: 'var(--bg-page)',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8B949E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
              {subject.title.slice(0, 22)}
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              title={ts('Collapse sidebar')}
              style={{ background: 'transparent', border: '1px solid #30363D', borderRadius: '6px', color: '#484F58', cursor: 'pointer', fontSize: '9px', padding: '3px 6px', flexShrink: 0 }}
            >
              ◄
            </button>
          </div>

          {/* Scrollable sidebar content */}
          <div style={{ overflowY: 'auto', flex: 1, padding: sidebarOpen ? '12px 16px 20px' : '0', display: 'flex', flexDirection: 'column', gap: '3px' }}>

          {/* Overview / dashboard */}
          <div style={{ marginBottom: '8px' }}>
            <SidebarItem
              icon={<IconDash />}
              label={ts('Overview')}
              sublabel={ts('Subject dashboard')}
              active={view === 'dashboard'}
              onClick={() => { setActiveSidebarFileId(null); setView('dashboard'); setFullFocus(false); }}
            />
          </div>

          {/* Upload / files section */}
          <div style={{ marginBottom: '4px' }}>
            <button
              onClick={() => setFilesExpanded(v => !v)}
              style={{
                display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center',
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 10px', marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#484F58', fontFamily: "'Sora',sans-serif" }}>
                {ts('Files')} ({levelFiles.length})
              </span>
              <span style={{ fontSize: '10px', color: '#484F58' }}>{filesExpanded ? '▾' : '▸'}</span>
            </button>

            {filesExpanded && (
              <>
                <SidebarItem
                  icon={<IconPlus />}
                  label={ts('Add Files')}
                  active={view === 'upload' && levelFiles.length === 0}
                  onClick={() => { setActiveSidebarFileId(null); setView('upload'); setFullFocus(false); }}
                />

                {(() => {
                  const fileFolders = folders.filter(f => f.kind === 'file');
                  const sorted = [...levelFiles].sort((a, b) => {
                    const ta = parseInt(a.id.split('-')[0]) || 0;
                    const tb = parseInt(b.id.split('-')[0]) || 0;
                    return tb - ta;
                  });

                  const sidebarFileItem = (file: UploadedFile, indent = false) => {
                    const isSidebarActive = activeSidebarFileId === file.id;
                    return (
                      <div key={file.id} style={indent ? { paddingLeft: '8px' } : {}}>
                        <SidebarItem
                          icon={<IconFile />}
                          label={file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name}
                          sublabel={`${(file.size / 1024 / 1024).toFixed(1)} MB · ${isPdfType(file.type) ? 'PDF' : ts('Image')}`}
                          active={isSidebarActive}
                          dot={isSidebarActive}
                          dotColor={subject.color}
                          onClick={() => { setActiveSidebarFileId(file.id); setSelectedFileIds([file.id]); setView('upload'); setFullFocus(false); }}
                        />
                      </div>
                    );
                  };

                  if (fileFolders.length === 0) {
                    const visible = sidebarFilesExpanded ? sorted : sorted.slice(0, 3);
                    const hidden = sorted.length - 3;
                    return (<>
                      {visible.map(f => sidebarFileItem(f))}
                      {sorted.length > 3 && (
                        <button
                          onClick={() => setSidebarFilesExpanded(v => !v)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '8px', color: '#484F58', fontSize: '10px', fontWeight: 600, transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#8B949E')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#484F58')}
                        >
                          <svg viewBox="0 0 10 6" width="9" height="9" fill="none" style={{ flexShrink: 0, transform: sidebarFilesExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {sidebarFilesExpanded ? ts('Show less') : ts('{n} more files', { n: hidden })}
                        </button>
                      )}
                    </>);
                  }

                  const sidebarFolderHeader = (folder: typeof fileFolders[0], count: number, onClick: () => void) => {
                    const isCollapsed = !expandedSidebarFolderIds.has(folder.id);
                    return (
                      <div key={folder.id + '-hdr'} style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '2px' }}>
                        <button
                          onClick={onClick}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '7px 4px 7px 10px', borderRadius: '10px', color: '#C9D1D9', fontSize: '13px', fontWeight: 600, textAlign: 'left', minWidth: 0 }}
                        >
                          <span style={{ color: subject.color, flexShrink: 0, transform: 'scale(1.2)', transformOrigin: 'center' }}><IconFolder /></span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                          {count > 0 && <span style={{ color: '#8B949E', flexShrink: 0, fontSize: '12px' }}>{count}</span>}
                        </button>
                        <button
                          onClick={() => setExpandedSidebarFolderIds(prev => {
                            const next = new Set(prev);
                            if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
                            return next;
                          })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 10px 7px 4px', color: '#8B949E', flexShrink: 0, lineHeight: 0 }}
                        >
                          <svg viewBox="0 0 10 6" width="11" height="11" fill="none" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  };

                  const unfiledFiles = sorted.filter(f => !fileFolders.some(fo => fo.id === f.folderId));
                  return (<>
                    {fileFolders.map(folder => {
                      const folderFiles = sorted.filter(f => f.folderId === folder.id);
                      return (
                        <div key={folder.id}>
                          {sidebarFolderHeader(folder, folderFiles.length, () => { setActiveSidebarFileId(null); setView('upload'); setFullFocus(false); })}
                          {expandedSidebarFolderIds.has(folder.id) && folderFiles.map(f => sidebarFileItem(f, true))}
                        </div>
                      );
                    })}
                    {unfiledFiles.length > 0 && (<>
                      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8B949E', padding: '6px 10px 4px', fontFamily: "'Sora',sans-serif" }}>{ts('Unfiled')}</div>
                      {unfiledFiles.map(f => sidebarFileItem(f, true))}
                    </>)}
                  </>);
                })()}
              </>
            )}
          </div>

          {/* Generated content section */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '4px', fontFamily: "'Sora',sans-serif" }}>
              {ts('Content')}
            </div>

            <SidebarItem
              icon={<IconCards />}
              label={t('nav_flashcards')}
              sublabel={savedFlashcardSets.length > 0 ? ts('{n} saved', { n: savedFlashcardSets.length }) : ts('None yet')}
              active={view === 'flashcards' && !activeSetId}
              dot={savedFlashcardSets.length > 0}
              dotColor={subject.color}
              onClick={() => { setActiveSidebarFileId(null); setActiveSetId(null); setView('flashcards'); setFullFocus(false); }}
            />
            <SidebarItem
              icon={<IconNote />}
              label={t('nav_notes')}
              sublabel={savedNotes.length > 0 ? ts('{n} saved', { n: savedNotes.length }) : ts('None yet')}
              active={view === 'notes' && !activeNoteId}
              dot={savedNotes.length > 0}
              dotColor={subject.color}
              onClick={() => { setActiveSidebarFileId(null); setActiveNoteId(null); setView('notes'); setFullFocus(false); }}
            />
            <SidebarItem
              icon={<IconDict />}
              label={ts('Dictionary')}
              sublabel={dictEntries.length > 0 ? ts('{n} terms', { n: dictEntries.length }) : ts('None yet')}
              active={view === 'dictionary'}
              dot={dictEntries.length > 0}
              dotColor={subject.color}
              onClick={() => { setActiveSidebarFileId(null); setView('dictionary'); setFullFocus(false); }}
            />
            <SidebarItem
              icon={<IconQuiz />}
              label={ts('Quizzes')}
              sublabel={savedQuizzes.length > 0 ? ts('{n} saved', { n: savedQuizzes.length }) : ts('None yet')}
              active={view === 'quiz' && !activeQuizId}
              dot={savedQuizzes.length > 0}
              dotColor={subject.color}
              onClick={() => { setActiveSidebarFileId(null); setActiveQuizId(null); setView('quiz'); setFullFocus(false); }}
            />
          </div>

          </div>{/* end scrollable content */}
        </aside>

        {/* Main content area */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-8" style={{ background: 'var(--bg-page)' }}>

          {/* Dashboard view */}
          {view === 'dashboard' && (
            <div>
              <SubjectBanner
                subject={subject}
                levelFiles={levelFiles}
                savedNotes={savedNotes}
                savedFlashcardSets={savedFlashcardSets}
                savedQuizzes={savedQuizzes}
                dictEntries={dictEntries}
                examDate={examDate}
                daysLeft={examDate ? daysUntil(examDate.date) : 0}
                onExamDateChange={iso => setExamDate(id!, iso)}
                onExamDateClear={() => removeExamDate(id!)}
              />

              {/* Section cards */}
              {(() => {
                const totalMB = levelFiles.reduce((a, f) => a + f.size, 0) / 1024 / 1024;
                const pdfCount = levelFiles.filter(f => isPdfType(f.type)).length;
                const imgCount = levelFiles.length - pdfCount;
                const fileParts = [pdfCount > 0 ? ts('{n} PDFs', { n: pdfCount }) : '', imgCount > 0 ? ts('{n} images', { n: imgCount }) : ''].filter(Boolean).join(' · ');
                const totalCards = savedFlashcardSets.reduce((a, s) => a + s.cards.length, 0);
                const totalQs = savedQuizzes.reduce((a, q) => a + q.questions.length, 0);
                const totalSections = savedNotes.reduce((a, n) => a + n.note.sections.length, 0);
                const avgQuizPct = quizHistory.length > 0 ? Math.round(quizHistory.reduce((a, r) => a + r.scorePercent, 0) / quizHistory.length) : null;
                const allCardIds = savedFlashcardSets.flatMap(s => s.cards.map(c => c.id));
                const srsStats = subjectSrsStats(srsCards, allCardIds);
                const masteryPct = allCardIds.length > 0 ? Math.round((srsStats.graduated / allCardIds.length) * 100) : null;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(190px, 100%), 1fr))', gap: '14px' }}>
                    <SectionCard
                      index={0} icon={<IconFile />} label={ts('Files')} color="#4FA8E8"
                      stat={levelFiles.length}
                      subtext={levelFiles.length > 0 ? fileParts : undefined}
                      secondary={levelFiles.length > 0 ? `${totalMB.toFixed(1)} MB total` : ts('Upload PDFs or images to begin')}
                      inactive={levelFiles.length === 0}
                      onClick={() => setView('upload')}
                    />
                    <SectionCard
                      index={1} icon={<IconNote />} label={ts('Notes')} color="#3FBA74"
                      stat={savedNotes.length}
                      subtext={savedNotes.length > 0 ? ts('{n} sections', { n: totalSections }) : undefined}
                      secondary={savedNotes.length > 0 ? ts('updated {time}', { time: timeAgo(savedNotes[0].createdAt) }) : ts('Generate structured notes from files')}
                      inactive={savedNotes.length === 0}
                      onClick={() => { setActiveNoteId(null); setView('notes'); }}
                    />
                    <SectionCard
                      index={2} icon={<IconCards />} label={ts('Flashcards')} color="#5C8AFF"
                      stat={totalCards}
                      subtext={savedFlashcardSets.length > 0 ? ts('in {n} sets', { n: savedFlashcardSets.length }) : undefined}
                      secondary={masteryPct !== null ? `${masteryPct}% mastered` : savedFlashcardSets.length > 0 ? ts('updated {time}', { time: timeAgo(savedFlashcardSets[0].createdAt) }) : ts('Generate a deck from files')}
                      inactive={savedFlashcardSets.length === 0}
                      onClick={() => { setActiveSetId(null); setView('flashcards'); }}
                    />
                    <SectionCard
                      index={3} icon={<IconQuiz />} label={ts('Quizzes')} color="#FF8C42"
                      stat={savedQuizzes.length > 0 ? totalQs : 0}
                      subtext={savedQuizzes.length > 0 ? ts('{n} quizzes', { n: savedQuizzes.length }) : undefined}
                      secondary={avgQuizPct !== null ? `avg ${avgQuizPct}%` : savedQuizzes.length > 0 ? ts('updated {time}', { time: timeAgo(savedQuizzes[0].createdAt) }) : ts('Generate a quiz from files')}
                      inactive={savedQuizzes.length === 0}
                      onClick={() => { setActiveQuizId(null); setView('quiz'); }}
                    />
                    <SectionCard
                      index={4} icon={<IconDict />} label={ts('Dictionary')} color="#A78BFA"
                      stat={dictEntries.length}
                      subtext={dictEntries.length > 0 ? ts('{n} terms', { n: dictEntries.length }) : undefined}
                      secondary={dictEntries.length > 0 ? ts('updated {time}', { time: timeAgo(dictEntries[dictEntries.length - 1].createdAt) }) : ts('Select text in notes to define')}
                      inactive={dictEntries.length === 0}
                      onClick={() => setView('dictionary')}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Upload view */}
          {view === 'upload' && (
            <>
              <div
                role="button" tabIndex={0} aria-label={ts('Upload files')}
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

              {/* File list with folders */}
              {levelFiles.length > 0 && (
                <FolderBoard<UploadedFile>
                  kind="file" label={t('uploaded_files')} color={subject.color}
                  folders={folders} items={levelFiles} cols={5}
                  draggedId={draggedItem?.kind === 'file' ? draggedItem.id : null}
                  onDragStart={fid => setDraggedItem({ kind: 'file', id: fid })}
                  onDragEnd={() => setDraggedItem(null)}
                  onDropToFolder={fid => handleItemDrop('file', fid)}
                  onCreateFolder={name => createFolder('file', name)}
                  onDeleteFolder={removeFolder}
                  onReorder={reordered => setFiles(prev => {
                    const ids = new Set(reordered.map(f => f.id));
                    return [...prev.filter(f => !ids.has(f.id)), ...reordered];
                  })}
                  sortAccessors={{ name: f => f.name, date: f => parseInt(f.id.split('-')[0]) || 0 }}
                  headerExtra={
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedFileIds(levelFiles.map(f => f.id))}
                        style={{ fontSize: '10px', fontWeight: 600, color: subject.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {ts('Select all')}
                      </button>
                      <span style={{ color: '#30363D', fontSize: '10px' }}>·</span>
                      <button onClick={() => setSelectedFileIds([])}
                        style={{ fontSize: '10px', fontWeight: 600, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {ts('None')}
                      </button>
                    </div>
                  }
                  renderItem={(file) => {
                    const isPDF = isPdfType(file.type);
                    const iconColor = isPDF ? '#f87171' : '#60a5fa';
                    const isFileSelected = selectedFileIds.includes(file.id);
                    const isCompressing = file.compressing === true;
                    return (
                      <div
                        onClick={() => !isCompressing && toggleFileSelection(file.id)}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: '6px',
                          background: isFileSelected ? subject.color + '08' : '#161B22',
                          border: `1px solid ${isFileSelected ? subject.color + '40' : '#30363D'}`,
                          borderRadius: '12px', padding: '10px',
                          cursor: isCompressing ? 'default' : 'pointer', transition: 'all 0.2s ease', position: 'relative',
                          opacity: isCompressing ? 0.7 : 1,
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          position: 'absolute', top: '8px', left: '8px',
                          width: '14px', height: '14px', borderRadius: '4px',
                          background: isFileSelected ? subject.color : 'transparent',
                          border: `1.5px solid ${isFileSelected ? subject.color : '#484F58'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s ease', zIndex: 1,
                        }}>
                          {isFileSelected && (
                            <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
                              <path d="M1.5 5l2 2.5L8.5 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* Preview */}
                        {isPDF ? (
                          <div style={{ width: '100%', height: '40px', borderRadius: '7px', background: iconColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '3px' }}>
                            {isCompressing ? (
                              <>
                                <Spinner color={iconColor} />
                                <span style={{ fontSize: '8px', color: iconColor, fontWeight: 600 }}>Compressing</span>
                              </>
                            ) : (
                              <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
                                <path d="M5 2h8l4 4v12H5V2z" stroke={iconColor} strokeWidth="1.3" strokeLinejoin="round"/>
                                <path d="M13 2v4h4" stroke={iconColor} strokeWidth="1.3" strokeLinejoin="round"/>
                                <path d="M7 10h6M7 13h4" stroke={iconColor} strokeWidth="1.2" strokeLinecap="round"/>
                              </svg>
                            )}
                          </div>
                        ) : (
                          <img src={file.url} alt="" draggable={false} style={{ width: '100%', height: '40px', objectFit: 'cover', borderRadius: '7px' }} />
                        )}

                        {/* Name */}
                        <div onClick={e => renaming?.id === file.id && e.stopPropagation()}>
                          {renaming?.id === file.id ? (
                            <input
                              autoFocus
                              value={renaming.value}
                              onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                              onBlur={() => commitRename('file')}
                              onKeyDown={e => { if (e.key === 'Enter') commitRename('file'); if (e.key === 'Escape') setRenaming(null); }}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', background: '#0D1117', border: `1px solid ${subject.color}55`, borderRadius: '4px', color: '#E6EDF3', fontSize: '10px', padding: '1px 4px', outline: 'none' }}
                            />
                          ) : (
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.name}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const href = file.storageUrl || file.url;
                              if (!href) return;
                              if (file.rawFile) {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(file.rawFile);
                                a.download = file.name; a.click();
                              } else {
                                fetch(href).then(r => r.blob()).then(blob => {
                                  const a = document.createElement('a');
                                  a.href = URL.createObjectURL(blob);
                                  a.download = file.name; a.click();
                                  URL.revokeObjectURL(a.href);
                                }).catch(() => window.open(href, '_blank'));
                              }
                            }}
                            title={ts('Download file')}
                            style={{ flex: 1, height: '22px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
                          >↓</button>
                          <button
                            onClick={e => { e.stopPropagation(); startRename(file.id, file.name, 'file'); }}
                            title={ts('Rename file')}
                            style={{ width: '22px', height: '22px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', background: 'transparent', color: '#8B949E', border: '1px solid #30363D' }}
                          >✎</button>
                          <button
                            onClick={e => { e.stopPropagation(); removeFile(file.id); }}
                            title={ts('Remove file')}
                            style={{ width: '22px', height: '22px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
                          >✕</button>
                        </div>
                      </div>
                    );
                  }}
                />
              )}
            </>
          )}

          {/* Flashcards view — either an active set or the folder of saved sets */}
          {view === 'flashcards' && (() => {
            const activeSet = activeSetId ? savedFlashcardSets.find(s => s.id === activeSetId) : undefined;

            if (activeSet) {
              // Sort due cards first, then unseen — most-overdue reviews surface first.
              const { due: dueCards, unseen: newCards, queue } = getStudyQueue(activeSet.cards, srsCards);
              const sessionCards = queue.length > 0 ? queue : activeSet.cards;
              const toReview = dueCards.length + newCards.length;
              return (
                <div>
                  <div className="subject-content-breadcrumb flex items-center justify-between mb-5">
                    <button
                      onClick={() => { setActiveSetId(null); setSidebarOpen(true); }}
                      className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0 flex items-center gap-1.5"
                      style={{ color: '#8B949E' }}
                    >
                      ← {ts('All flashcards')}
                    </button>
                    <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
                      {activeSet.name} · {activeSet.cards.length} {t('cards')}
                      {toReview > 0 && (
                        <span style={{ marginLeft: '6px', color: subject.color, fontWeight: 700 }}>
                          · {toReview} {ts('to review')}
                        </span>
                      )}
                    </div>
                  </div>
                  <FlashcardViewer
                    key={activeSet.id}
                    cards={sessionCards}
                    color={subject.color}
                    subjectId={subject.id}
                    onSessionEnd={(n) => recordActivity({ type: 'flashcards', subjectId: subject.id, subjectName: subject.title, detail: `Reviewed ${n} card${n !== 1 ? 's' : ''} in ${subject.title}` })}
                    onBack={() => setActiveSetId(null)}
                    onGoToQuiz={savedQuizzes.length > 0 ? () => { setView('quiz'); setActiveQuizId(savedQuizzes[0].id); } : undefined}
                  />
                </div>
              );
            }

            if (savedFlashcardSets.length === 0) {
              return <EmptyState color={subject.color} onUpload={() => setView('upload')} />;
            }

            const allCardIds = savedFlashcardSets.flatMap(s => s.cards.map(c => c.id));
            const overallStats = subjectSrsStats(srsCards, allCardIds);

            return (
              <>
                <FlashcardProgressDashboard
                  stats={overallStats}
                  color={subject.color}
                />
                <FolderBoard<StoredFlashcardSet>
                kind="card" label={ts('Flashcard sets')} color={subject.color}
                folders={folders} items={savedFlashcardSets}
                draggedId={draggedItem?.kind === 'card' ? draggedItem.id : null}
                onDragStart={cid => setDraggedItem({ kind: 'card', id: cid })}
                onDragEnd={() => setDraggedItem(null)}
                onDropToFolder={fid => handleItemDrop('card', fid)}
                onCreateFolder={name => createFolder('card', name)}
                onDeleteFolder={removeFolder}
                onReorder={reordered => setSavedFlashcardSets(reordered)}
                sortAccessors={{ name: s => s.name, date: s => s.createdAt }}
                renderItem={(set) => {
                  const isRenaming = renaming?.id === set.id;
                  const setStats   = subjectSrsStats(srsCards, set.cards.map(c => c.id));
                  const toReview   = setStats.due + setStats.unseen;
                  return (
                    <div
                      onClick={() => { if (!isRenaming) { setActiveSetId(set.id); setSidebarOpen(false); } }}
                      className="card-panel card-panel-lift p-4 flex items-center gap-3"
                      style={{ cursor: isRenaming ? 'default' : 'pointer' }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                        background: subject.color + '18', color: subject.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconCards />
                      </div>
                      <div className="flex-1 min-w-0" onClick={e => isRenaming && e.stopPropagation()}>
                        {isRenaming ? (
                          <input
                            autoFocus
                            value={renaming.value}
                            onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                            onBlur={() => commitRename('set')}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename('set'); if (e.key === 'Escape') setRenaming(null); }}
                            style={{
                              width: '100%', background: '#0D1117',
                              border: `1px solid ${subject.color}55`, borderRadius: '6px',
                              color: '#E6EDF3', fontSize: '13px', fontWeight: 600,
                              padding: '2px 6px', outline: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {set.name}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{ts('{n} cards', { n: set.cards.length })}</span>
                          {toReview > 0 && (
                            <span style={{
                              padding: '1px 7px', borderRadius: '999px', fontWeight: 700,
                              background: subject.color + '18', color: subject.color,
                              border: `1px solid ${subject.color}33`, fontSize: '10px',
                            }}>
                              {toReview} {ts('to review')}
                            </span>
                          )}
                          {setStats.graduated > 0 && toReview === 0 && (
                            <span style={{
                              padding: '1px 7px', borderRadius: '999px', fontWeight: 700,
                              background: '#8B5CF614', color: '#8B5CF6',
                              border: '1px solid #8B5CF633', fontSize: '10px',
                            }}>
                              ✓ {setStats.graduated} graduated
                            </span>
                          )}
                          <span style={{ color: '#484F58' }}>{new Date(set.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startRename(set.id, set.name); }}
                        aria-label={ts('Rename flashcard set')}
                        style={{
                          width: '30px', height: '30px', borderRadius: '999px',
                          cursor: 'pointer', flexShrink: 0,
                          background: isRenaming ? subject.color + '20' : 'transparent',
                          color: isRenaming ? subject.color : '#484F58',
                          border: `1px solid ${isRenaming ? subject.color + '50' : '#30363D'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <IconPencil />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); removeSet(set.id); }}
                        aria-label={ts('Delete flashcard set')}
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
                  );
                }}
              />
              </>
            );
          })()}

          {/* Notes view — either an active note or the folder of saved notes */}
          {view === 'notes' && (() => {
            const activeNote = activeNoteId ? savedNotes.find(n => n.id === activeNoteId) : undefined;

            if (activeNote) {
              return (
                <div>
                  <div className="subject-content-breadcrumb flex items-center justify-between mb-5">
                    <button
                      onClick={() => { setActiveNoteId(null); setSidebarOpen(true); }}
                      className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0 flex items-center gap-1.5"
                      style={{ color: '#8B949E' }}
                    >
                      ← {ts('All notes')}
                    </button>
                    <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
                      {activeNote.name} · {ts('{n} sections', { n: activeNote.note.sections.length })}
                    </div>
                  </div>
                  <NotesViewer
                    notes={activeNote.note}
                    color={subject.color}
                    noteId={activeNote.id}
                    noteTitle={activeNote.name}
                    scrollElRef={mainRef}
                    onGoToFlashcards={savedFlashcardSets.length > 0 ? () => { setView('flashcards'); setActiveSetId(null); } : undefined}
                    onAddToDictionary={(term, srcTitle, srcId) => addToDictionary(term, srcTitle, srcId)}
                    onAddToJapaneseDictionary={(term, srcTitle, srcId) => addToJapaneseDictionary(term, srcTitle, srcId)}
                    fullFocus={fullFocus}
                    onToggleFullFocus={() => setFullFocus(v => !v)}
                  />
                </div>
              );
            }

            if (savedNotes.length === 0) {
              return <EmptyState color={subject.color} onUpload={() => setView('upload')} />;
            }

            return (
              <FolderBoard<StoredNote>
                kind="note" label={ts('Notes')} color={subject.color}
                folders={folders} items={savedNotes}
                draggedId={draggedItem?.kind === 'note' ? draggedItem.id : null}
                onDragStart={nid => setDraggedItem({ kind: 'note', id: nid })}
                onDragEnd={() => setDraggedItem(null)}
                onDropToFolder={fid => handleItemDrop('note', fid)}
                onCreateFolder={name => createFolder('note', name)}
                onDeleteFolder={removeFolder}
                onReorder={reordered => setSavedNotes(reordered)}
                sortAccessors={{ name: n => n.name, date: n => n.createdAt }}
                renderItem={(n) => {
                  const isRenaming = renaming?.id === n.id;
                  return (
                    <div
                      onClick={() => { if (!isRenaming) { setActiveNoteId(n.id); setSidebarOpen(false); } }}
                      className="card-panel card-panel-lift p-4 flex items-center gap-3"
                      style={{ cursor: isRenaming ? 'default' : 'pointer' }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                        background: subject.color + '18', color: subject.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconNote />
                      </div>
                      <div className="flex-1 min-w-0" onClick={e => isRenaming && e.stopPropagation()}>
                        {isRenaming ? (
                          <input
                            autoFocus
                            value={renaming.value}
                            onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                            onBlur={() => commitRename('note')}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename('note'); if (e.key === 'Escape') setRenaming(null); }}
                            style={{
                              width: '100%', background: '#0D1117',
                              border: `1px solid ${subject.color}55`, borderRadius: '6px',
                              color: '#E6EDF3', fontSize: '13px', fontWeight: 600,
                              padding: '2px 6px', outline: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.name}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '2px' }}>
                          {ts('{n} sections', { n: n.note.sections.length })} · {new Date(n.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startRename(n.id, n.name); }}
                        aria-label={ts('Rename note')}
                        style={{
                          width: '30px', height: '30px', borderRadius: '999px',
                          cursor: 'pointer', flexShrink: 0,
                          background: isRenaming ? subject.color + '20' : 'transparent',
                          color: isRenaming ? subject.color : '#484F58',
                          border: `1px solid ${isRenaming ? subject.color + '50' : '#30363D'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <IconPencil />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); removeNote(n.id); }}
                        aria-label={ts('Delete note')}
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
                  );
                }}
              />
            );
          })()}

          {/* Dictionary view */}
          {view === 'dictionary' && (
            <DictionaryView
              entries={dictEntries}
              pendingTerms={dictPending}
              color={subject.color}
              onDelete={async (entryId) => {
                await deleteDictionaryEntry(entryId).catch(() => {});
                setDictEntries(prev => prev.filter(e => e.id !== entryId));
              }}
            />
          )}

          {/* Quiz view — either the active quiz or the "previous quizzes" folder */}
          {view === 'quiz' && (() => {
            const activeQuiz = activeQuizId ? savedQuizzes.find(q => q.id === activeQuizId) : undefined;

            if (activeQuiz) {
              return (
                <div>
                  <div className="subject-content-breadcrumb flex items-center justify-between mb-5">
                    <button
                      onClick={() => { setActiveQuizId(null); setSidebarOpen(true); }}
                      className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0 flex items-center gap-1.5"
                      style={{ color: '#8B949E' }}
                    >
                      ← {ts('All quizzes')}
                    </button>
                    <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
                      {activeQuiz.name} · {activeQuiz.questions.length} {t('questions')}
                    </div>
                  </div>
                  <QuizViewer
                    key={`${activeQuiz.id}${redoingResult ? '-redo' : ''}`}
                    questions={activeQuiz.questions}
                    color={subject.color}
                    quizId={activeQuiz.id}
                    quizTitle={activeQuiz.name}
                    subjectId={subject.id}
                    initialRedoResult={redoingResult ?? undefined}
                    onExit={() => { setRedoingResult(null); setActiveQuizId(null); }}
                    onComplete={(result) => {
                      setRedoingResult(null);
                      setQuizHistory(prev => [result, ...prev.filter(r => r.id !== result.id)]);
                      useStore.getState().addQuizScore(subject.id, result.correctAnswers, result.totalQuestions);
                      recordActivity({ type: 'quiz', subjectId: subject.id, subjectName: subject.title, detail: `Scored ${result.scorePercent}% on ${subject.title} quiz` });
                    }}
                  />
                </div>
              );
            }

            if (savedQuizzes.length === 0) {
              return <EmptyState color={subject.color} onUpload={() => setView('upload')} />;
            }

            const totalCorrect = quizHistory.reduce((a, r) => a + r.correctAnswers, 0);
            const totalQs = quizHistory.reduce((a, r) => a + r.totalQuestions, 0);
            const avgPct = quizHistory.length > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
            const bestScore = quizHistory.length > 0 ? Math.max(...quizHistory.map(r => r.scorePercent)) : 0;

            return (
              <>
              <QuizProgressDashboard
                stats={{
                  totalAttempts: quizHistory.length,
                  totalQuestions: totalQs,
                  totalCorrect,
                  averagePercent: avgPct,
                  bestScore,
                  totalSavedQuizzes: savedQuizzes.length,
                  totalSavedQuestions: savedQuizzes.reduce((a, q) => a + q.questions.length, 0),
                }}
                color={subject.color}
              />
              <FolderBoard<StoredQuiz>
                kind="quiz" label={ts('Previous quizzes')} color={subject.color}
                folders={folders} items={savedQuizzes}
                draggedId={draggedItem?.kind === 'quiz' ? draggedItem.id : null}
                onDragStart={qid => setDraggedItem({ kind: 'quiz', id: qid })}
                onDragEnd={() => setDraggedItem(null)}
                onDropToFolder={fid => handleItemDrop('quiz', fid)}
                onCreateFolder={name => createFolder('quiz', name)}
                onDeleteFolder={removeFolder}
                onReorder={reordered => setSavedQuizzes(reordered)}
                sortAccessors={{ name: q => q.name, date: q => q.createdAt }}
                renderItem={(quiz) => {
                  const isRenaming = renaming?.id === quiz.id;
                  return (
                    <div
                      onClick={() => { if (!isRenaming) { setActiveQuizId(quiz.id); setSidebarOpen(false); } }}
                      className="card-panel card-panel-lift p-4 flex items-center gap-3"
                      style={{ cursor: isRenaming ? 'default' : 'pointer' }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                        background: subject.color + '18', color: subject.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconQuiz />
                      </div>
                      <div className="flex-1 min-w-0" onClick={e => isRenaming && e.stopPropagation()}>
                        {isRenaming ? (
                          <input
                            autoFocus
                            value={renaming.value}
                            onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                            onBlur={() => commitRename('quiz')}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename('quiz'); if (e.key === 'Escape') setRenaming(null); }}
                            style={{
                              width: '100%', background: '#0D1117',
                              border: `1px solid ${subject.color}55`, borderRadius: '6px',
                              color: '#E6EDF3', fontSize: '13px', fontWeight: 600,
                              padding: '2px 6px', outline: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {quiz.name}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '2px' }}>
                          {ts('{n} questions', { n: quiz.questions.length })} · {new Date(quiz.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startRename(quiz.id, quiz.name); }}
                        aria-label={ts('Rename quiz')}
                        style={{
                          width: '30px', height: '30px', borderRadius: '999px',
                          cursor: 'pointer', flexShrink: 0,
                          background: isRenaming ? subject.color + '20' : 'transparent',
                          color: isRenaming ? subject.color : '#484F58',
                          border: `1px solid ${isRenaming ? subject.color + '50' : '#30363D'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <IconPencil />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); removeQuiz(quiz.id); }}
                        aria-label={ts('Delete quiz')}
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
                  );
                }}
              />
              {quizHistory.length > 0 && (
                <QuizHistoryPanel
                  history={quizHistory}
                  onRedo={(result) => {
                    const quiz = savedQuizzes.find(q => q.id === result.quizId);
                    if (quiz) {
                      setActiveQuizId(quiz.id);
                      setRedoingResult(result);
                    }
                  }}
                />
              )}
              </>
            );
          })()}
        </main>
      </div>

      {/* ── Floating Generate button + popover ──────────────────────────────── */}
      {levelFiles.length > 0 && (
        <div className="hidden md:flex" style={{ position: 'fixed', right: '24px', bottom: '24px', zIndex: 200, flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          {showGenPanel && (
            <div
              style={{
                width: 'min(92vw, 340px)', maxHeight: '70vh', overflowY: 'auto',
                background: '#161B22', border: '1px solid #30363D', borderRadius: '20px',
                boxShadow: '0 18px 50px rgba(0,0,0,0.55)', padding: '16px',
              }}
              className="anim-rise"
            >
              <div className="flex items-center justify-between mb-3">
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '14px', color: '#E6EDF3' }}>{ts('Generate')}</div>
                <div style={{ fontSize: '10px', color: selectedLevelFileIds.length > 0 ? subject.color : '#484F58', fontWeight: 600 }}>
                  {ts('{n}/{total} selected', { n: selectedLevelFileIds.length, total: levelFiles.length })}
                </div>
              </div>

              {selectedLevelFileIds.length === 0 && (
                <div className="mb-3 text-[11px] leading-relaxed" style={{ color: '#D29922' }}>
                  Select one or more files in the Files tab first.
                </div>
              )}

              {/* Type selector */}
              <div className="flex gap-1.5 flex-wrap mb-3">
                {(['flashcards', 'notes', 'quiz'] as GenerationType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="h-8 px-3 text-[11px] border cursor-pointer transition-all duration-200 font-semibold"
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

              {/* Language selector */}
              <div className="mb-3">
                <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Language</div>
                <div className="flex gap-1.5">
                  {(['english', 'japanese', 'both'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setGenLanguage(lang)}
                      className="h-8 px-3 text-[11px] border cursor-pointer transition-all duration-200 font-semibold"
                      style={{
                        borderRadius: '999px',
                        background:  genLanguage === lang ? subject.color + '20' : 'transparent',
                        color:       genLanguage === lang ? subject.color         : '#8B949E',
                        borderColor: genLanguage === lang ? subject.color + '50'  : '#30363D',
                      }}
                    >
                      {lang === 'english' ? 'EN' : lang === 'japanese' ? 'JA' : 'EN + JA'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flashcard options */}
              {selectedType === 'flashcards' && (
                <div className="mb-3 flex flex-col gap-2.5">
                  {/* Mode: standard vs vocabulary */}
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Mode</div>
                    <div className="flex gap-1.5">
                      {([
                        { key: 'standard',   label: 'Study' },
                        { key: 'vocabulary', label: 'Vocabulary' },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setFlashcardMode(key)}
                          className="h-8 flex-1 text-[11px] border cursor-pointer transition-all duration-200 font-semibold"
                          style={{
                            borderRadius: '999px',
                            background:  flashcardMode === key ? subject.color + '20' : 'transparent',
                            color:       flashcardMode === key ? subject.color         : '#8B949E',
                            borderColor: flashcardMode === key ? subject.color + '50'  : '#30363D',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {flashcardMode === 'vocabulary' && (
                      <div style={{ fontSize: '10px', color: '#484F58', marginTop: '5px', lineHeight: 1.5 }}>
                        Front: word in source language. Back: reading, meaning, example sentence + translation.
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#8B949E', fontWeight: 600 }}>{flashcardMode === 'vocabulary' ? 'Words per file' : 'Cards per file'}</div>
                      <div style={{
                        fontSize: '14px', fontWeight: 700, fontFamily: "'Sora', sans-serif",
                        color: cardCount === 0 ? '#484F58' : subject.color,
                        transition: 'color 0.15s ease',
                      }}>
                        {cardCount === 0 ? 'Undecided' : cardCount}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0} max={10} step={1}
                      value={cardCount / 5}
                      onChange={e => setCardCount(Number(e.target.value) * 5)}
                      style={{ width: '100%', accentColor: subject.color, cursor: 'pointer', display: 'block' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: '#484F58', userSelect: 'none' }}>
                      <span>Any</span>
                      <span>25</span>
                      <span>50</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Topic focus</div>
                    <input type="text" value={focusTopic} onChange={e => setFocusTopic(e.target.value)} placeholder="e.g. Supply & demand"
                      style={{ width: '100%', background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', color: '#E6EDF3', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              {/* Notes options */}
              {selectedType === 'notes' && (
                <div className="mb-3 flex flex-col gap-2.5">
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Detail level</div>
                    <div className="flex gap-1.5">
                      {(['concise', 'standard', 'comprehensive'] as const).map(d => (
                        <button key={d} onClick={() => setNotesDetail(d)}
                          className="h-8 px-2.5 text-[10px] border cursor-pointer transition-all duration-200 font-semibold capitalize"
                          style={{ borderRadius: '999px', background: notesDetail === d ? subject.color + '20' : 'transparent', color: notesDetail === d ? subject.color : '#8B949E', borderColor: notesDetail === d ? subject.color + '50' : '#30363D' }}>
                          {d === 'comprehensive' ? 'Deep' : d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Include</div>
                    <div className="flex flex-col gap-1.5">
                      {(['formulas', 'diagrams', 'mindmap'] as const).map(item => (
                        <label key={item} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={notesIncludes.includes(item)} onChange={() => toggleInclude(item)}
                            style={{ accentColor: subject.color, width: '13px', height: '13px', cursor: 'pointer' }} />
                          <span style={{ fontSize: '11px', color: notesIncludes.includes(item) ? '#C9D1D9' : '#8B949E' }}>
                            {item === 'formulas' ? '∑ Formulas' : item === 'diagrams' ? '→ Diagrams' : '⊞ Mind-map style'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quiz options */}
              {selectedType === 'quiz' && (
                <div className="mb-3 flex flex-col gap-2.5">
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Questions per file</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[5, 10, 15, 20].map(n => (
                        <button key={n} onClick={() => setQuizCount(n)}
                          className="h-8 w-10 text-[12px] border cursor-pointer transition-all duration-200 font-semibold"
                          style={{ borderRadius: '999px', background: quizCount === n ? subject.color + '20' : 'transparent', color: quizCount === n ? subject.color : '#8B949E', borderColor: quizCount === n ? subject.color + '50' : '#30363D' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Difficulty</div>
                    <div className="flex gap-1.5">
                      {([
                        { key: 'easy', label: 'Easy', tint: '#48C78E' },
                        { key: 'medium', label: 'Medium', tint: '#F6AD55' },
                        { key: 'hard', label: 'Hard', tint: '#F87171' },
                      ] as const).map(d => {
                        const active = quizDifficulty === d.key;
                        return (
                          <button key={d.key} onClick={() => setQuizDifficulty(d.key)}
                            className="h-8 flex-1 text-[12px] border cursor-pointer transition-all duration-200 font-semibold"
                            style={{ borderRadius: '999px', background: active ? d.tint + '20' : 'transparent', color: active ? d.tint : '#8B949E', borderColor: active ? d.tint + '60' : '#30363D' }}>
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Topic focus</div>
                    <input type="text" value={focusTopic} onChange={e => setFocusTopic(e.target.value)} placeholder="e.g. Monetary policy"
                      style={{ width: '100%', background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', color: '#E6EDF3', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              {/* Custom prompt */}
              <div className="mb-3">
                <button onClick={() => setShowAdvanced(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', fontWeight: 600, color: showAdvanced ? subject.color : '#484F58', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.15s' }}>
                  <span style={{ fontSize: '11px' }}>✦</span> Custom instructions {showAdvanced ? '▴' : '▾'}
                </button>
                {showAdvanced && (
                  <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                    placeholder={`E.g. "Focus on exam definitions", "Use simple language"`}
                    rows={3}
                    style={{ marginTop: '7px', width: '100%', background: '#0D1117', border: `1px solid ${subject.color}30`, borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#E6EDF3', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedLevelFileIds.length === 0}
                className="w-full flex items-center justify-center gap-2 h-10 text-xs font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all duration-300"
                style={{
                  borderRadius: '999px',
                  background:   isGenerating ? '#1F2937' : subject.color + '18',
                  color:        isGenerating ? '#8B949E' : subject.color,
                  borderColor:  isGenerating ? '#30363D' : subject.color + '45',
                }}
              >
                {isGenerating
                  ? <><Spinner color={subject.color} /> Generating…</>
                  : <><IconSparkle /> Generate {selectedType === 'flashcards' ? (cardCount === 0 ? 'Cards' : `${cardCount} Cards`) : selectedType === 'quiz' ? `${quizCount} Q` : 'Notes'}</>
                }
              </button>

              {isGenerating && genProgress && genProgress.total > 1 && (
                <div className="mt-2 text-center text-[11px]" style={{ color: '#8B949E' }}>
                  File {genProgress.current} of {genProgress.total}…
                </div>
              )}

              {genState.status === 'error' && (
                <div className="mt-2 text-[11px] leading-relaxed" style={{ color: '#f87171' }}>
                  {friendlyError(genState.error)}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowGenPanel(v => !v)}
            aria-label="Generate study material"
            className="flex items-center gap-2 cursor-pointer transition-all duration-300"
            style={{
              height: '54px', padding: showGenPanel ? '0 18px' : '0 22px',
              borderRadius: '999px',
              background: subject.color,
              color: '#0D1117',
              border: 'none',
              fontWeight: 700, fontSize: '14px',
              boxShadow: `0 10px 30px ${subject.color}55, 0 2px 8px rgba(0,0,0,0.4)`,
              fontFamily: "'Sora',sans-serif",
            }}
          >
            {showGenPanel
              ? <><svg viewBox="0 0 14 14" width="14" height="14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> Close</>
              : <><IconSparkle /> Generate</>}
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useResolvedSubjects } from '../store/useSubjects';
import { useStore } from '../store/useStore';
import { useActivity } from '../store/useActivity';
import { useToast } from '../components/Toast';
import { generateFromFile } from '../lib/geminiGenerator';
import {
  saveFile, getFiles, deleteFile,
  saveQuiz, getQuizzes, deleteQuiz, type StoredQuiz,
  saveNote, getNotes, deleteNote, type StoredNote,
  saveFlashcardSet, getFlashcardSets, deleteFlashcardSet, type StoredFlashcardSet,
  saveFolder, getFolders, deleteFolder, type Folder, type FolderKind,
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
  folderId?: string | null;
}

type GenStatus = 'idle' | 'generating' | 'done' | 'error';
interface GenState { status: GenStatus; type?: GenerationType; error?: string; }
interface GenProgress { current: number; total: number; }

type View = 'dashboard' | 'upload' | 'flashcards' | 'notes' | 'quiz';

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

// ── Overview tile ──────────────────────────────────────────────────────────────

function OverviewTile({
  icon, label, color, active, primary, secondary, badges, onClick, index,
}: {
  icon: React.ReactNode; label: string; color: string; active: boolean;
  primary: string; secondary: string; badges?: string[];
  onClick: () => void; index: number;
}) {
  return (
    <button
      onClick={onClick}
      className="anim-rise"
      style={{
        ['--d' as string]: `${index * 60}ms`,
        background: '#161B22', border: '1px solid #21262D',
        borderRadius: '20px', padding: '24px',
        textAlign: 'left', cursor: 'pointer',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), border-color 0.25s ease, box-shadow 0.25s ease',
        display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '150px',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-3px)';
        el.style.borderColor = color + '40';
        el.style.boxShadow = `0 10px 28px rgba(0,0,0,0.4), 0 0 0 1px ${color}22`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.borderColor = '#21262D';
        el.style.boxShadow = '';
      }}
    >
      <div className="flex items-start justify-between">
        <div style={{
          width: '52px', height: '52px', borderRadius: '15px',
          background: active ? color + '1F' : '#1F2937',
          color: active ? color : '#484F58',
          border: `1px solid ${active ? color + '33' : '#30363D'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ transform: 'scale(1.25)' }}>{icon}</span>
        </div>
        {active && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, marginTop: '6px' }} />}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '15px', color: '#E6EDF3', marginBottom: '4px' }}>
          {label}
        </div>
        <div style={{ fontSize: '12px', color: active ? color : '#484F58', fontWeight: 600 }}>
          {primary}
        </div>
        <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '3px' }}>
          {secondary}
        </div>
        {badges && badges.length > 0 && (
          <div className="flex gap-1.5 flex-wrap" style={{ marginTop: '10px' }}>
            {badges.map((b, i) => (
              <span key={i} style={{ fontSize: '10px', fontWeight: 600, color: color, background: color + '14', border: `1px solid ${color}28`, borderRadius: '999px', padding: '2px 8px' }}>
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
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
  onDragStart, onDragEnd, onDropToFolder, onCreateFolder, onDeleteFolder, renderItem,
}: {
  kind: FolderKind;
  label: string;
  color: string;
  folders: Folder[];
  items: T[];
  draggedId: string | null;
  cols?: 1 | 2;
  headerExtra?: React.ReactNode;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropToFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [hoverFolder, setHoverFolder] = useState<string | null>(null);
  const isDragging = draggedId != null;
  const gridClass = cols === 1 ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-3';

  const submit = () => {
    const n = newName.trim();
    if (n) onCreateFolder(n);
    setNewName(''); setCreating(false);
  };

  const kindFolders = folders.filter(f => f.kind === kind);
  const unfiled = items.filter(it => !it.folderId || !kindFolders.some(f => f.id === it.folderId));

  // Plain render helper (not a component) so dropping into a folder never
  // remounts the subtree — keeps the rename input focused while typing.
  const zone = (folderId: string | null, children: React.ReactNode) => {
    const key = folderId ?? '__unfiled__';
    const isHover = hoverFolder === key && isDragging;
    return (
      <div
        onDragOver={e => { if (isDragging) { e.preventDefault(); setHoverFolder(key); } }}
        onDragLeave={() => setHoverFolder(prev => (prev === key ? null : prev))}
        onDrop={e => { e.preventDefault(); onDropToFolder(folderId); setHoverFolder(null); }}
        style={{
          borderRadius: '16px',
          border: `1px dashed ${isHover ? color : 'transparent'}`,
          background: isHover ? color + '0E' : 'transparent',
          padding: isDragging ? '4px' : 0,
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {children}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
          {label} ({items.length}){kindFolders.length > 0 && ` · ${kindFolders.length} folder${kindFolders.length > 1 ? 's' : ''}`}
        </div>
        <div className="flex items-center gap-3 ml-auto">
        {headerExtra}
        {creating ? (
          <input
            autoFocus value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={submit}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setNewName(''); setCreating(false); } }}
            placeholder="Folder name…"
            style={{ background: '#0D1117', border: `1px solid ${color}55`, borderRadius: '999px', color: '#E6EDF3', fontSize: '11px', padding: '5px 12px', outline: 'none', width: '160px' }}
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 cursor-pointer"
            style={{ background: color + '14', color, border: `1px solid ${color}33`, borderRadius: '999px', fontSize: '11px', fontWeight: 600, padding: '5px 12px' }}
          >
            <IconFolderPlus /> New folder
          </button>
        )}
        </div>
      </div>

      {isDragging && (
        <div className="mb-3 text-[11px]" style={{ color: color }}>
          Drop onto a folder to organise, or onto “Unfiled” to remove.
        </div>
      )}

      {/* Folder sections */}
      {kindFolders.map(folder => {
        const folderItems = items.filter(it => it.folderId === folder.id);
        return (
          <div key={folder.id} style={{ marginBottom: '18px' }}>
            {zone(folder.id, <>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span style={{ color }}><IconFolder /></span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3' }}>{folder.name}</span>
                <span style={{ fontSize: '11px', color: '#8B949E' }}>{folderItems.length}</span>
                <button
                  onClick={() => onDeleteFolder(folder.id)}
                  aria-label="Delete folder"
                  className="ml-auto cursor-pointer"
                  style={{ background: 'transparent', border: 'none', color: '#484F58', padding: '2px', lineHeight: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#484F58')}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              {folderItems.length === 0 ? (
                <div className="px-1 pb-1 text-[11px]" style={{ color: '#484F58' }}>Empty — drag items here.</div>
              ) : (
                <div className={gridClass}>
                  {folderItems.map(it => (
                    <div key={it.id} draggable onDragStart={() => onDragStart(it.id)} onDragEnd={onDragEnd}
                      style={{ opacity: draggedId === it.id ? 0.4 : 1, cursor: 'grab' }}>
                      {renderItem(it)}
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </div>
        );
      })}

      {/* Unfiled */}
      {zone(null, <>
        {kindFolders.length > 0 && (
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#8B949E' }}>Unfiled</span>
            <span style={{ fontSize: '11px', color: '#484F58' }}>{unfiled.length}</span>
          </div>
        )}
        <div className={gridClass}>
          {unfiled.map(it => (
            <div key={it.id} draggable onDragStart={() => onDragStart(it.id)} onDragEnd={onDragEnd}
              style={{ opacity: draggedId === it.id ? 0.4 : 1, cursor: 'grab' }}>
              {renderItem(it)}
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
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
  const [selectedType, setSelectedType] = useState<GenerationType>('flashcards');
  const [genState, setGenState] = useState<GenState>({ status: 'idle' });
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [quizCount, setQuizCount] = useState(10);
  const [cardCount, setCardCount] = useState(12);
  const [focusTopic, setFocusTopic] = useState('');
  const [notesDetail, setNotesDetail] = useState<'concise' | 'standard' | 'comprehensive'>('standard');
  const [notesIncludes, setNotesIncludes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedQuizzes, setSavedQuizzes] = useState<StoredQuiz[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<StoredNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [savedFlashcardSets, setSavedFlashcardSets] = useState<StoredFlashcardSet[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [draggedItem, setDraggedItem] = useState<{ kind: FolderKind; id: string } | null>(null);
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genLanguage, setGenLanguage] = useState<'english' | 'japanese' | 'both'>('english');

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
          const [cloudFiles, cloudQuizzes, cloudNotes, cloudSets, cloudFolders] = await Promise.all([
            getCloudFiles(id!),
            getCloudQuizzes(id!),
            getCloudNotes(id!),
            getCloudFlashcardSets(id!),
            getCloudFolders(id!),
          ]);
          if (cloudFolders.length > 0) setFolders(cloudFolders);
          if (cloudQuizzes.length > 0) setSavedQuizzes(cloudQuizzes);
          if (cloudNotes.length > 0) setSavedNotes(cloudNotes);
          if (cloudSets.length > 0) setSavedFlashcardSets(cloudSets);
          if (cloudFiles.length > 0) {
            const mapped: UploadedFile[] = cloudFiles.map(cf => ({
              id: cf.id, name: cf.name, type: cf.type, size: cf.size,
              url: cf.storageUrl, rawFile: null, level: cf.level, storageUrl: cf.storageUrl,
              folderId: cf.folderId ?? null,
            }));
            setFiles(mapped);
            setSelectedFileIds(mapped.map(f => f.id));
          }
        } else {
          const [storedFiles, storedQuizzes, storedNotes, storedSets, storedFolders] = await Promise.all([
            getFiles(id!),
            getQuizzes(id!),
            getNotes(id!),
            getFlashcardSets(id!),
            getFolders(id!),
          ]);
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
            setSelectedFileIds(mapped.map(f => f.id));
          }
        }
      } catch (err) {
        console.error('Failed to load persisted subject data:', err);
      }
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
      toast('error', `${rejected} file${rejected > 1 ? 's' : ''} skipped`, 'Only PDF and image files are supported.');
    }
    if (valid.length === 0) return;
    const mapped: UploadedFile[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name, type: f.type, size: f.size,
      url: URL.createObjectURL(f), rawFile: f, level: activeLevel,
    }));
    setFiles(prev => [...prev, ...mapped]);
    setSelectedFileIds(prev => [...prev, ...mapped.map(m => m.id)]);
    if (isFirebaseConfigured && isSupabaseConfigured) {
      let uploaded = 0;
      let failed = 0;
      let lastError = '';
      for (const file of mapped) {
        try {
          const storageUrl = await uploadFileToStorage(id!, file.id, file.rawFile!);
          await saveCloudFile({ id: file.id, subjectId: id!, name: file.name, type: file.type, size: file.size, level: file.level, storageUrl, createdAt: Date.now() });
          setFiles(prev => prev.map(f => f.id === file.id ? { ...f, storageUrl } : f));
          uploaded++;
        } catch (err) {
          console.error('Cloud upload failed:', err);
          lastError = err instanceof Error ? err.message : String(err);
          failed++;
        }
      }
      if (failed > 0) {
        toast('error', `${failed} file${failed > 1 ? 's' : ''} not shared`, lastError || 'Cloud upload failed. Saved locally only.');
      }
      if (uploaded > 0) {
        toast('success', `${uploaded} file${uploaded > 1 ? 's' : ''} added`, 'Uploaded to the shared library.');
      }
    } else {
      for (const file of mapped) {
        await saveFile({ id: file.id, subjectId: id!, name: file.name, type: file.type, size: file.size, level: file.level, blob: file.rawFile! }).catch(() => {});
      }
      toast('success', `${mapped.length} file${mapped.length > 1 ? 's' : ''} added`, undefined);
    }
  }, [activeLevel, id, toast]);

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
    if (isFirebaseConfigured) deleteCloudFile(id!, fileId).catch(() => {}); else deleteFile(fileId).catch(() => {});
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
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const startRename = (id: string, currentName: string) => {
    setRenaming({ id, value: currentName });
  };

  const commitRename = (type: 'quiz' | 'note' | 'set') => {
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
        let fileForGen = selectedFiles[i].rawFile;
        if (!fileForGen) {
          const url = selectedFiles[i].storageUrl;
          if (!url) throw new Error(`No file data for ${selectedFiles[i].name}`);
          const blob = await fetch(url).then(r => r.blob());
          fileForGen = new File([blob], selectedFiles[i].name, { type: selectedFiles[i].type });
        }
        const result = await generateFromFile(fileForGen, selectedType, subject!.title, {
          cardCount,
          questionCount: quizCount,
          focusTopic: focusTopic.trim() || undefined,
          notesDetail,
          notesIncludes,
          customPrompt: customPrompt.trim() || undefined,
          language: genLanguage,
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
      const typeLabel = selectedType === 'flashcards' ? 'Flashcards' : selectedType === 'quiz' ? 'Quiz' : 'Notes';
      toast('success', `${typeLabel} ready`, `Generated from ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}.`);
      recordActivity({ type: 'generate', subjectId: subject!.id, subjectName: subject!.title, detail: `Generated ${typeLabel.toLowerCase()} for ${subject!.title}` });
    } catch (err) {
      setGenState({ status: 'error', type: selectedType, error: String(err) });
      toast('error', 'Generation failed', friendlyError(String(err)));
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
                {view === 'upload' ? 'Files' : view}
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
      <div className="md:hidden flex items-center gap-1 px-3 py-2 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #21262D', background: '#0D1117' }}>
        {([
          { id: 'dashboard',  label: 'Overview', dot: false },
          { id: 'upload',     label: 'Files',    dot: false },
          { id: 'flashcards', label: 'Cards',    dot: savedFlashcardSets.length > 0 },
          { id: 'notes',      label: 'Notes',    dot: savedNotes.length > 0 },
          { id: 'quiz',       label: 'Quizzes',  dot: savedQuizzes.length > 0 },
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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left sidebar — hidden on mobile */}
        <aside className="hidden md:flex flex-col" style={{
          width: '320px',
          flexShrink: 0,
          borderRight: '1px solid #21262D',
          background: '#0D1117',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 16px',
          gap: '3px',
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
              sublabel={savedFlashcardSets.length > 0 ? `${savedFlashcardSets.length} saved` : 'None yet'}
              active={view === 'flashcards' && !activeSetId}
              dot={savedFlashcardSets.length > 0}
              dotColor={subject.color}
              onClick={() => { setActiveSetId(null); setView('flashcards'); }}
            />
            <SidebarItem
              icon={<IconNote />}
              label={t('nav_notes')}
              sublabel={savedNotes.length > 0 ? `${savedNotes.length} saved` : 'None yet'}
              active={view === 'notes' && !activeNoteId}
              dot={savedNotes.length > 0}
              dotColor={subject.color}
              onClick={() => { setActiveNoteId(null); setView('notes'); }}
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

          {/* Flashcard sets folder */}
          {savedFlashcardSets.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '4px' }}>
                Flashcard Sets
              </div>
              {savedFlashcardSets.map(set => (
                <SidebarItem
                  key={set.id}
                  icon={<IconCards />}
                  label={set.name}
                  sublabel={`${set.cards.length} cards`}
                  active={view === 'flashcards' && activeSetId === set.id}
                  dot={view === 'flashcards' && activeSetId === set.id}
                  dotColor={subject.color}
                  onClick={() => { setActiveSetId(set.id); setView('flashcards'); }}
                />
              ))}
            </div>
          )}

          {/* Notes folder */}
          {savedNotes.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '4px' }}>
                Notes
              </div>
              {savedNotes.map(n => (
                <SidebarItem
                  key={n.id}
                  icon={<IconNote />}
                  label={n.name}
                  sublabel={`${n.note.sections.length} sections`}
                  active={view === 'notes' && activeNoteId === n.id}
                  dot={view === 'notes' && activeNoteId === n.id}
                  dotColor={subject.color}
                  onClick={() => { setActiveNoteId(n.id); setView('notes'); }}
                />
              ))}
            </div>
          )}

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

        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8" style={{ background: '#0D1117' }}>


          {/* Dashboard view */}
          {view === 'dashboard' && (
            <div>
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '20px', color: '#E6EDF3', marginBottom: '4px' }}>
                  {subject.title}
                </div>
                <div style={{ fontSize: '13px', color: '#8B949E' }}>{subject.description}</div>
              </div>

              {(() => {
                const totalMB = levelFiles.reduce((a, f) => a + f.size, 0) / 1024 / 1024;
                const pdfCount = levelFiles.filter(f => f.type === 'application/pdf').length;
                const imgCount = levelFiles.length - pdfCount;
                const fileParts = [pdfCount > 0 ? `${pdfCount} PDF${pdfCount > 1 ? 's' : ''}` : '', imgCount > 0 ? `${imgCount} image${imgCount > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
                const totalCards = savedFlashcardSets.reduce((a, s) => a + s.cards.length, 0);
                const totalQs = savedQuizzes.reduce((a, q) => a + q.questions.length, 0);
                const totalSections = savedNotes.reduce((a, n) => a + n.note.sections.length, 0);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                    <OverviewTile
                      index={0} icon={<IconFile />} label="Files" color={subject.color}
                      active={levelFiles.length > 0}
                      primary={levelFiles.length > 0 ? `${levelFiles.length} uploaded` : 'No files yet'}
                      secondary={levelFiles.length > 0 ? `${fileParts} · ${totalMB.toFixed(1)} MB total` : 'Upload PDFs or images to begin'}
                      onClick={() => setView('upload')}
                    />
                    <OverviewTile
                      index={1} icon={<IconNote />} label="Notes" color="#2EA043"
                      active={savedNotes.length > 0}
                      primary={savedNotes.length > 0 ? `${savedNotes.length} note${savedNotes.length > 1 ? 's' : ''}` : 'None yet'}
                      secondary={savedNotes.length > 0 ? `${totalSections} sections · updated ${timeAgo(savedNotes[0].createdAt)}` : 'Generate structured notes from files'}
                      onClick={() => { setActiveNoteId(null); setView('notes'); }}
                    />
                    <OverviewTile
                      index={2} icon={<IconCards />} label="Flashcards" color="#3D7EFF"
                      active={savedFlashcardSets.length > 0}
                      primary={savedFlashcardSets.length > 0 ? `${totalCards} cards` : 'None yet'}
                      secondary={savedFlashcardSets.length > 0 ? `in ${savedFlashcardSets.length} set${savedFlashcardSets.length > 1 ? 's' : ''} · updated ${timeAgo(savedFlashcardSets[0].createdAt)}` : 'Generate a deck from files'}
                      onClick={() => { setActiveSetId(null); setView('flashcards'); }}
                    />
                    <OverviewTile
                      index={3} icon={<IconQuiz />} label="Quizzes" color="#D29922"
                      active={savedQuizzes.length > 0}
                      primary={savedQuizzes.length > 0 ? `${totalQs} questions` : 'None yet'}
                      secondary={savedQuizzes.length > 0 ? `in ${savedQuizzes.length} quiz${savedQuizzes.length > 1 ? 'zes' : ''} · updated ${timeAgo(savedQuizzes[0].createdAt)}` : 'Generate a quiz from files'}
                      onClick={() => { setActiveQuizId(null); setView('quiz'); }}
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

              {/* File list with folders */}
              {levelFiles.length > 0 && (
                <FolderBoard<UploadedFile>
                  kind="file" label={t('uploaded_files')} color={subject.color}
                  folders={folders} items={levelFiles} cols={1}
                  draggedId={draggedItem?.kind === 'file' ? draggedItem.id : null}
                  onDragStart={fid => setDraggedItem({ kind: 'file', id: fid })}
                  onDragEnd={() => setDraggedItem(null)}
                  onDropToFolder={fid => handleItemDrop('file', fid)}
                  onCreateFolder={name => createFolder('file', name)}
                  onDeleteFolder={removeFolder}
                  headerExtra={
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedFileIds(levelFiles.map(f => f.id))}
                        style={{ fontSize: '10px', fontWeight: 600, color: subject.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Select all
                      </button>
                      <span style={{ color: '#30363D', fontSize: '10px' }}>·</span>
                      <button onClick={() => setSelectedFileIds([])}
                        style={{ fontSize: '10px', fontWeight: 600, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        None
                      </button>
                    </div>
                  }
                  renderItem={(file) => {
                    const isPDF = file.type === 'application/pdf';
                    const iconColor = isPDF ? '#f87171' : '#60a5fa';
                    const isFileSelected = selectedFileIds.includes(file.id);
                    return (
                      <div
                        onClick={() => toggleFileSelection(file.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: isFileSelected ? subject.color + '08' : '#161B22',
                          border: `1px solid ${isFileSelected ? subject.color + '40' : '#30363D'}`,
                          borderRadius: '16px', padding: '12px 16px',
                          cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                      >
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
                  }}
                />
              )}
            </>
          )}

          {/* Flashcards view — either an active set or the folder of saved sets */}
          {view === 'flashcards' && (() => {
            const activeSet = activeSetId ? savedFlashcardSets.find(s => s.id === activeSetId) : undefined;

            if (activeSet) {
              return (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <button
                      onClick={() => setActiveSetId(null)}
                      className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0 flex items-center gap-1.5"
                      style={{ color: '#8B949E' }}
                    >
                      ← All flashcards
                    </button>
                    <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
                      {activeSet.name} · {activeSet.cards.length} {t('cards')}
                    </div>
                  </div>
                  <FlashcardViewer
                    key={activeSet.id}
                    cards={activeSet.cards}
                    color={subject.color}
                    subjectId={subject.id}
                    onSessionEnd={(n) => recordActivity({ type: 'flashcards', subjectId: subject.id, subjectName: subject.title, detail: `Reviewed ${n} card${n !== 1 ? 's' : ''} in ${subject.title}` })}
                  />
                </div>
              );
            }

            if (savedFlashcardSets.length === 0) {
              return <EmptyState color={subject.color} onUpload={() => setView('upload')} />;
            }

            return (
              <FolderBoard<StoredFlashcardSet>
                kind="card" label="Flashcard sets" color={subject.color}
                folders={folders} items={savedFlashcardSets}
                draggedId={draggedItem?.kind === 'card' ? draggedItem.id : null}
                onDragStart={cid => setDraggedItem({ kind: 'card', id: cid })}
                onDragEnd={() => setDraggedItem(null)}
                onDropToFolder={fid => handleItemDrop('card', fid)}
                onCreateFolder={name => createFolder('card', name)}
                onDeleteFolder={removeFolder}
                renderItem={(set) => {
                  const isRenaming = renaming?.id === set.id;
                  return (
                    <div
                      onClick={() => { if (!isRenaming) setActiveSetId(set.id); }}
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
                        <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '2px' }}>
                          {set.cards.length} cards · {new Date(set.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startRename(set.id, set.name); }}
                        aria-label="Rename flashcard set"
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
                        aria-label="Delete flashcard set"
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

          {/* Notes view — either an active note or the folder of saved notes */}
          {view === 'notes' && (() => {
            const activeNote = activeNoteId ? savedNotes.find(n => n.id === activeNoteId) : undefined;

            if (activeNote) {
              return (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <button
                      onClick={() => setActiveNoteId(null)}
                      className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0 flex items-center gap-1.5"
                      style={{ color: '#8B949E' }}
                    >
                      ← All notes
                    </button>
                    <div className="text-[10px] tracking-[0.12em] uppercase font-medium" style={{ color: '#8B949E' }}>
                      {activeNote.name} · {activeNote.note.sections.length} sections
                    </div>
                  </div>
                  <NotesViewer notes={activeNote.note} color={subject.color} noteId={activeNote.id} />
                </div>
              );
            }

            if (savedNotes.length === 0) {
              return <EmptyState color={subject.color} onUpload={() => setView('upload')} />;
            }

            return (
              <FolderBoard<StoredNote>
                kind="note" label="Notes" color={subject.color}
                folders={folders} items={savedNotes}
                draggedId={draggedItem?.kind === 'note' ? draggedItem.id : null}
                onDragStart={nid => setDraggedItem({ kind: 'note', id: nid })}
                onDragEnd={() => setDraggedItem(null)}
                onDropToFolder={fid => handleItemDrop('note', fid)}
                onCreateFolder={name => createFolder('note', name)}
                onDeleteFolder={removeFolder}
                renderItem={(n) => {
                  const isRenaming = renaming?.id === n.id;
                  return (
                    <div
                      onClick={() => { if (!isRenaming) setActiveNoteId(n.id); }}
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
                          {n.note.sections.length} sections · {new Date(n.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startRename(n.id, n.name); }}
                        aria-label="Rename note"
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
                        aria-label="Delete note"
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
                  <QuizViewer
                    key={activeQuiz.id}
                    questions={activeQuiz.questions}
                    color={subject.color}
                    onComplete={(pct, score, total) => {
                      useStore.getState().addQuizScore(subject.id, score, total);
                      recordActivity({ type: 'quiz', subjectId: subject.id, subjectName: subject.title, detail: `Scored ${pct}% on ${subject.title} quiz` });
                    }}
                  />
                </div>
              );
            }

            if (savedQuizzes.length === 0) {
              return <EmptyState color={subject.color} onUpload={() => setView('upload')} />;
            }

            return (
              <FolderBoard<StoredQuiz>
                kind="quiz" label="Previous quizzes" color={subject.color}
                folders={folders} items={savedQuizzes}
                draggedId={draggedItem?.kind === 'quiz' ? draggedItem.id : null}
                onDragStart={qid => setDraggedItem({ kind: 'quiz', id: qid })}
                onDragEnd={() => setDraggedItem(null)}
                onDropToFolder={fid => handleItemDrop('quiz', fid)}
                onCreateFolder={name => createFolder('quiz', name)}
                onDeleteFolder={removeFolder}
                renderItem={(quiz) => {
                  const isRenaming = renaming?.id === quiz.id;
                  return (
                    <div
                      onClick={() => { if (!isRenaming) setActiveQuizId(quiz.id); }}
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
                          {quiz.questions.length} questions · {new Date(quiz.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startRename(quiz.id, quiz.name); }}
                        aria-label="Rename quiz"
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
                  );
                }}
              />
            );
          })()}
        </main>
      </div>

      {/* ── Floating Generate button + popover ──────────────────────────────── */}
      {levelFiles.length > 0 && (
        <div style={{ position: 'fixed', right: '24px', bottom: '24px', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
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
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '14px', color: '#E6EDF3' }}>Generate</div>
                <div style={{ fontSize: '10px', color: selectedLevelFileIds.length > 0 ? subject.color : '#484F58', fontWeight: 600 }}>
                  {selectedLevelFileIds.length}/{levelFiles.length} selected
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
                  <div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '5px', fontWeight: 600 }}>Cards per file</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[6, 12, 20, 30].map(n => (
                        <button key={n} onClick={() => setCardCount(n)}
                          className="h-8 w-10 text-[12px] border cursor-pointer transition-all duration-200 font-semibold"
                          style={{ borderRadius: '999px', background: cardCount === n ? subject.color + '20' : 'transparent', color: cardCount === n ? subject.color : '#8B949E', borderColor: cardCount === n ? subject.color + '50' : '#30363D' }}>
                          {n}
                        </button>
                      ))}
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
                  : <><IconSparkle /> Generate {selectedType === 'flashcards' ? `${cardCount} Cards` : selectedType === 'quiz' ? `${quizCount} Q` : 'Notes'}</>
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

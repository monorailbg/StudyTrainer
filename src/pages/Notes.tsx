import { useState, useEffect, useRef } from 'react';
import { getAllNotes, getFolders, saveNote, type StoredNote, type DictionaryEntry, type Folder, saveDictionaryEntry } from '../lib/db';
import { isFirebaseConfigured, getAllCloudNotes, getCloudFolders, saveCloudNote } from '../lib/cloudDb';
import { withManualOrder } from '../lib/sortOrder';
import { useResolvedSubjects } from '../store/useSubjects';
import { useActivity } from '../store/useActivity';
import { useStore } from '../store/useStore';
import { NotesViewer } from '../components/NotesViewer';
import { SkeletonCardGrid } from '../components/Skeleton';
import { useLang } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import { generateDefinition, generateJapaneseDefinition } from '../lib/geminiProxy';
import type { SubjectDef } from '../data/subjects';

function friendlyError(raw?: string): string {
  if (!raw) return 'Definition failed.';
  if (raw.includes('401') || raw.includes('API_KEY_INVALID')) return 'Invalid or expired API key. Check the server configuration.';
  if (raw.includes('RESOURCE_EXHAUSTED')) return 'Quota exhausted — try again tomorrow.';
  // No hardcoded "429 → wait 60s" override on purpose — geminiProxy.ts now
  // throws the server's actual message, which already distinguishes a
  // brief per-minute limit from a fully exhausted daily quota and states
  // the real wait time; that falls through to the generic branch below.
  if (raw.includes('unsupported') || raw.includes('Unsupported') || raw.includes('INVALID_ARGUMENT')) return 'Failed to process. Try again.';
  return `Definition failed: ${raw.replace(/^Error:\s*/i, '').slice(0, 140)}`;
}

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

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({ note, color, onClick, index = 0 }: { note: StoredNote; color: string; onClick: () => void; index?: number }) {
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
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.3"/></svg>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.name}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{ts('{n} sections', { n: note.note.sections.length })} · {new Date(note.createdAt).toLocaleDateString()}</div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty() {
  const { ts } = useLang();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: 'var(--text-2)', textAlign: 'center', gap: '12px' }}>
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none"><rect x="6" y="6" width="36" height="36" rx="6" stroke="var(--border-base)" strokeWidth="2"/><line x1="14" y1="16" x2="34" y2="16" stroke="var(--text-3)" strokeWidth="2"/><line x1="14" y1="24" x2="28" y2="24" stroke="var(--text-3)" strokeWidth="2"/><line x1="14" y1="32" x2="22" y2="32" stroke="var(--text-3)" strokeWidth="2"/></svg>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>{ts('No notes yet')}</div>
        <div style={{ fontSize: '13px' }}>{ts('Upload files to a subject and generate notes from the subject page.')}</div>
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

export default function Notes() {
  const { ts } = useLang();
  const { toast } = useToast();
  const { allSubjects } = useResolvedSubjects();
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | 'unfiled' | null>(null);
  const [activeNote, setActiveNote] = useState<StoredNote | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const mainRef = useRef<HTMLElement>(null);
  const record = useActivity(s => s.record);
  const markNoteRead = useStore(s => s.markNoteRead);

  const toggleFolder = (id: string) => setCollapsedFolders(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    const loadData = isFirebaseConfigured
      ? getAllCloudNotes().then(data => data as StoredNote[])
      : getAllNotes().then(data => data.sort(withManualOrder((a, b) => b.createdAt - a.createdAt)));

    loadData.then(data => {
      setNotes(data);
      const subjectIds = [...new Set(data.map(n => n.subjectId))];
      return Promise.all(subjectIds.map(id => isFirebaseConfigured
        ? getCloudFolders(id).then(f => f as Folder[])
        : getFolders(id)
      ));
    }).then(results => setFolders(results.flat())).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setFolderFilter(null); }, [filterId]);

  const addToEnglishDictionary = async (term: string, noteTitle?: string, noteId?: string) => {
    if (!activeNote) return;
    const trimmed = term.trim();
    if (!trimmed) return;
    toast('info', `Adding "${trimmed}" to dictionary…`);
    try {
      const subject = allSubjects.find(s => s.id === activeNote.subjectId);
      const definition = await generateDefinition(trimmed, subject?.title ?? '');
      const entry: DictionaryEntry = {
        id: `dict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subjectId: activeNote.subjectId, term: trimmed, definition,
        sourceNoteTitle: noteTitle, sourceNoteId: noteId, createdAt: Date.now(),
      };
      await saveDictionaryEntry(entry);
      toast('success', `"${trimmed}" added to dictionary`, definition.replace(/^[•\-*]\s*/gm, '').trim());
    } catch (err) { toast('error', `Failed to define "${trimmed}"`, friendlyError(String(err))); }
  };

  const addToJapaneseDictionary = async (term: string, noteTitle?: string, noteId?: string) => {
    if (!activeNote) return;
    const trimmed = term.trim();
    if (!trimmed) return;
    toast('info', `翻訳中 "${trimmed}"…`);
    try {
      const subject = allSubjects.find(s => s.id === activeNote.subjectId);
      const definition = await generateJapaneseDefinition(trimmed, subject?.title ?? '');
      const entry: DictionaryEntry = {
        id: `dict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subjectId: activeNote.subjectId, term: trimmed, definition, folder: '翻訳',
        sourceNoteTitle: noteTitle, sourceNoteId: noteId, createdAt: Date.now(),
      };
      await saveDictionaryEntry(entry);
      toast('success', `"${trimmed}" を翻訳しました`, definition.replace(/^[•\-*]\s*/gm, '').trim());
    } catch (err) { toast('error', `翻訳に失敗しました "${trimmed}"`, friendlyError(String(err))); }
  };

  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
  const subjectsWithNotes = allSubjects.filter(s => notes.some(n => n.subjectId === s.id));
  const noteFolders = folders.filter(f => f.kind === 'note');
  const subjectNoteFolders = filterId ? noteFolders.filter(f => f.subjectId === filterId) : [];

  const visibleNotes = (() => {
    if (!filterId) return notes;
    const sn = notes.filter(n => n.subjectId === filterId);
    if (folderFilter === 'unfiled') return sn.filter(n => !n.folderId || !subjectNoteFolders.some(f => f.id === n.folderId));
    if (folderFilter) return sn.filter(n => n.folderId === folderFilter);
    return sn;
  })();

  const activeSubject = activeNote ? subjectMap.get(activeNote.subjectId) : undefined;
  const activeColor = activeSubject?.color ?? '#3D7EFF';
  const selectedSubject = filterId ? subjectMap.get(filterId) : undefined;
  const selectedColor = selectedSubject?.color ?? '#3D7EFF';

  const countForFolder = (subjectId: string, folderId: string) =>
    notes.filter(n => n.subjectId === subjectId && n.folderId === folderId).length;
  const countUnfiledFor = (subjectId: string) => {
    const sf = noteFolders.filter(f => f.subjectId === subjectId);
    return notes.filter(n => n.subjectId === subjectId && (!n.folderId || !sf.some(f => f.id === n.folderId))).length;
  };

  useEffect(() => {
    document.body.classList.toggle('notes-reading', !!activeNote);
    return () => { document.body.classList.remove('notes-reading'); };
  }, [activeNote]);

  const renderNoteGrid = (groupNotes: StoredNote[], subjectId: string, color: string, onOpen: (n: StoredNote) => void) => {
    const sf = noteFolders.filter(f => f.subjectId === subjectId);
    if (sf.length === 0) {
      return (
        <div className="notes-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {groupNotes.map((note, i) => <NoteCard key={note.id} note={note} color={color} index={i} onClick={() => onOpen(note)} />)}
        </div>
      );
    }
    const unfiledNotes = groupNotes.filter(n => !n.folderId || !sf.some(f => f.id === n.folderId));
    return (
      <>
        {sf.map(folder => {
          const folderNotes = groupNotes.filter(n => n.folderId === folder.id);
          if (folderNotes.length === 0) return null;
          const isCollapsed = collapsedFolders.has(folder.id);
          return (
            <FolderSection key={folder.id} name={folder.name} count={folderNotes.length} color={color} collapsed={isCollapsed} onToggle={() => toggleFolder(folder.id)}>
              <div className="notes-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {folderNotes.map((note, i) => <NoteCard key={note.id} note={note} color={color} index={i} onClick={() => onOpen(note)} />)}
              </div>
            </FolderSection>
          );
        })}
        {unfiledNotes.length > 0 && (
          <FolderSection name={ts('Unfiled')} count={unfiledNotes.length} color="#94a3b8" collapsed={collapsedFolders.has(`${subjectId}:unfiled`)} onToggle={() => toggleFolder(`${subjectId}:unfiled`)}>
            <div className="notes-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {unfiledNotes.map((note, i) => <NoteCard key={note.id} note={note} color={color} index={i} onClick={() => onOpen(note)} />)}
            </div>
          </FolderSection>
        )}
      </>
    );
  };

  const openNote = (note: StoredNote) => { setActiveNote(note); setSidebarOpen(false); };

  const renderMain = () => {
    if (loading) return <SkeletonCardGrid />;
    if (notes.length === 0) return <Empty />;
    if (visibleNotes.length === 0) return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>{ts('No notes here')}</div>
        <div style={{ fontSize: '13px' }}>{ts('This folder is empty.')}</div>
      </div>
    );

    if (!filterId) {
      return (
        <div>
          {subjectsWithNotes.map(s => {
            const groupNotes = notes.filter(n => n.subjectId === s.id);
            if (groupNotes.length === 0) return null;
            const color = s.color ?? '#3D7EFF';
            return (
              <div key={s.id} style={{ marginBottom: '36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.06em' }}>{s.title}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{ts('{n} notes', { n: groupNotes.length })}</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                </div>
                {renderNoteGrid(groupNotes, s.id, color, openNote)}
              </div>
            );
          })}
        </div>
      );
    }

    if (folderFilter) {
      return (
        <div className="notes-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {visibleNotes.map((note, i) => <NoteCard key={note.id} note={note} color={selectedColor} index={i} onClick={() => openNote(note)} />)}
        </div>
      );
    }

    return renderNoteGrid(visibleNotes, filterId, selectedColor, openNote);
  };

  return (
    <div className={activeNote ? 'page-notes-reading' : ''} style={{ display: 'flex', height: 'calc(100vh - 76px)', background: 'var(--bg-page)' }}>
      <aside className="notes-sidebar hidden md:flex flex-col" style={{
        width: sidebarOpen ? '220px' : '0', flexShrink: 0,
        borderRight: sidebarOpen ? '1px solid var(--border-light)' : 'none',
        padding: sidebarOpen ? '16px 10px' : '0',
        gap: '2px', overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.25s ease, padding 0.25s ease',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '0 10px', marginBottom: '8px' }}>
          {ts('Notes')}
        </div>
        <SubjectBtn subject={null} count={notes.length} active={filterId === null}
          onClick={() => { setFilterId(null); setActiveNote(null); setSidebarOpen(true); }} />
        {subjectsWithNotes.map(s => {
          const isSelected = filterId === s.id;
          const color = s.color ?? '#3D7EFF';
          const sf = noteFolders.filter(f => f.subjectId === s.id);
          return (
            <div key={s.id}>
              <SubjectBtn subject={s} count={notes.filter(n => n.subjectId === s.id).length}
                active={isSelected && folderFilter === null}
                onClick={() => { setFilterId(s.id); setFolderFilter(null); setActiveNote(null); setSidebarOpen(true); }} />
              {isSelected && sf.length > 0 && (
                <div style={{ marginTop: '2px', marginBottom: '2px' }}>
                  {sf.map(folder => (
                    <FolderBtn key={folder.id} name={folder.name} count={countForFolder(s.id, folder.id)}
                      active={folderFilter === folder.id} color={color}
                      onClick={() => { setFolderFilter(folder.id); setActiveNote(null); setSidebarOpen(true); }} />
                  ))}
                  {countUnfiledFor(s.id) > 0 && (
                    <FolderBtn name={ts('Unfiled')} count={countUnfiledFor(s.id)}
                      active={folderFilter === 'unfiled'} color={color}
                      onClick={() => { setFolderFilter('unfiled'); setActiveNote(null); setSidebarOpen(true); }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', padding: activeNote ? 0 : 'clamp(14px, 4vw, 28px)' }}>
        {activeNote ? (
          <div>
            <div className="notes-breadcrumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button onClick={() => { setActiveNote(null); setSidebarOpen(true); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                ← {ts('All notes')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeSubject && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeColor, boxShadow: `0 0 6px ${activeColor}` }} />}
                <span style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 600 }}>{activeSubject?.title ?? ''} · {activeNote.name}</span>
              </div>
            </div>
            <NotesViewer key={activeNote.id} notes={activeNote.note} color={activeColor}
              noteId={activeNote.id} noteTitle={activeNote.name} scrollElRef={mainRef}
              onRead={() => {
                const already = useStore.getState().notesRead.includes(activeNote.id);
                markNoteRead(activeNote.id);
                if (!already) {
                  const name = activeSubject?.title ?? ts('a subject');
                  record({ type: 'note', subjectId: activeNote.subjectId, subjectName: name, detail: ts('Read "{note}" in {subject}', { note: activeNote.name, subject: name }) });
                }
              }}
              onAddToDictionary={addToEnglishDictionary}
              onAddToJapaneseDictionary={addToJapaneseDictionary}
              onNotesChange={updatedNote => {
                const updated = { ...activeNote, note: updatedNote };
                setActiveNote(updated);
                setNotes(prev => prev.map(n => n.id !== activeNote.id ? n : updated));
                if (isFirebaseConfigured) saveCloudNote(updated).catch(() => {});
                else saveNote(updated).catch(() => {});
              }} />
          </div>
        ) : renderMain()}
      </main>
    </div>
  );
}

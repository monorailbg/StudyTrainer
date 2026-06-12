import { useState, useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllFlashcardSets, saveFlashcardSet, getFolders, type StoredFlashcardSet, type Folder } from '../lib/db';
import { isFirebaseConfigured, getAllCloudFlashcardSets, renameCloudFlashcardSet, getCloudFolders } from '../lib/cloudDb';
import { useResolvedSubjects } from '../store/useSubjects';
import { useActivity } from '../store/useActivity';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { SkeletonCardGrid } from '../components/Skeleton';
import { useLang } from '../context/LanguageContext';
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

// ── Set card ──────────────────────────────────────────────────────────────────

function SetCard({ set, color, onClick, index = 0 }: { set: StoredFlashcardSet; color: string; onClick: () => void; index?: number }) {
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
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="1" y="4" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/><rect x="4" y="2" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{set.name}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{ts('{n} cards', { n: set.cards.length })} · {new Date(set.createdAt).toLocaleDateString()}</div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty() {
  const { ts } = useLang();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: 'var(--text-2)', textAlign: 'center', gap: '12px' }}>
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none"><rect x="4" y="14" width="30" height="22" rx="5" stroke="var(--border-base)" strokeWidth="2"/><rect x="14" y="8" width="30" height="22" rx="5" stroke="var(--text-3)" strokeWidth="2" fill="none"/></svg>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>{ts('No flashcard sets yet')}</div>
        <div style={{ fontSize: '13px' }}>{ts('Upload files to a subject and generate flashcards from the subject page.')}</div>
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
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: collapsed ? 0 : '12px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
      >
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

export default function Flashcards() {
  const { ts } = useLang();
  const { allSubjects } = useResolvedSubjects();
  const [sets, setSets] = useState<StoredFlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | 'unfiled' | null>(null);
  const [activeSet, setActiveSet] = useState<StoredFlashcardSet | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const record = useActivity(s => s.record);

  const toggleFolder = (id: string) => setCollapsedFolders(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const commitRename = () => {
    if (!renaming) return;
    const name = renaming.value.trim();
    if (!name) { setRenaming(null); return; }
    setSets(prev => prev.map(s => s.id === renaming.id ? { ...s, name } : s));
    if (activeSet?.id === renaming.id) setActiveSet(prev => prev ? { ...prev, name } : prev);
    if (isFirebaseConfigured) {
      renameCloudFlashcardSet(renaming.id, name).catch(() => {});
    } else {
      const set = sets.find(s => s.id === renaming.id);
      if (set) saveFlashcardSet({ ...set, name }).catch(() => {});
    }
    setRenaming(null);
  };

  // Load all sets, then eagerly load folders for every subject that has sets
  useEffect(() => {
    const loadData = isFirebaseConfigured
      ? getAllCloudFlashcardSets().then(data => data as StoredFlashcardSet[])
      : getAllFlashcardSets().then(data => data.sort((a, b) => b.createdAt - a.createdAt));

    loadData.then(data => {
      setSets(data);
      const subjectIds = [...new Set(data.map(s => s.subjectId))];
      return Promise.all(
        subjectIds.map(id => isFirebaseConfigured
          ? getCloudFolders(id).then(f => f as Folder[])
          : getFolders(id)
        )
      );
    }).then(results => {
      setFolders(results.flat());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Reset folder filter when subject selection changes
  useEffect(() => { setFolderFilter(null); }, [filterId]);

  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
  const subjectsWithSets = allSubjects.filter(s => sets.some(x => x.subjectId === s.id));
  const cardFolders = folders.filter(f => f.kind === 'card');

  // Card-kind folders for the selected subject (sidebar navigation)
  const subjectCardFolders = filterId ? cardFolders.filter(f => f.subjectId === filterId) : [];

  const visibleSets = (() => {
    if (!filterId) return sets;
    const subjectSets = sets.filter(s => s.subjectId === filterId);
    if (folderFilter === 'unfiled') return subjectSets.filter(s => !s.folderId || !subjectCardFolders.some(f => f.id === s.folderId));
    if (folderFilter) return subjectSets.filter(s => s.folderId === folderFilter);
    return subjectSets;
  })();

  const activeSubject = activeSet ? subjectMap.get(activeSet.subjectId) : undefined;
  const activeColor = activeSubject?.color ?? '#3D7EFF';
  const selectedSubject = filterId ? subjectMap.get(filterId) : undefined;
  const selectedColor = selectedSubject?.color ?? '#3D7EFF';

  const countForFolder = (subjectId: string, folderId: string) =>
    sets.filter(s => s.subjectId === subjectId && s.folderId === folderId).length;
  const countUnfiledFor = (subjectId: string) => {
    const sf = cardFolders.filter(f => f.subjectId === subjectId);
    return sets.filter(s => s.subjectId === subjectId && (!s.folderId || !sf.some(f => f.id === s.folderId))).length;
  };

  const location = useLocation();
  useEffect(() => { setActiveSet(null); }, [location.key]);
  useLayoutEffect(() => {
    document.body.classList.toggle('flashcards-session', !!activeSet);
    return () => { document.body.classList.remove('flashcards-session'); };
  }, [activeSet]);

  // Render a grid of sets, optionally grouped by folders
  const renderSetGrid = (groupSets: StoredFlashcardSet[], subjectId: string, color: string) => {
    const sf = cardFolders.filter(f => f.subjectId === subjectId);
    if (sf.length === 0) {
      return (
        <div className="flashcard-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {groupSets.map((set, i) => <SetCard key={set.id} set={set} color={color} index={i} onClick={() => setActiveSet(set)} />)}
        </div>
      );
    }

    const unfiledSets = groupSets.filter(s => !s.folderId || !sf.some(f => f.id === s.folderId));
    return (
      <>
        {sf.map(folder => {
          const folderSets = groupSets.filter(s => s.folderId === folder.id);
          if (folderSets.length === 0) return null;
          const isCollapsed = collapsedFolders.has(folder.id);
          return (
            <FolderSection key={folder.id} name={folder.name} count={folderSets.length} color={color} collapsed={isCollapsed} onToggle={() => toggleFolder(folder.id)}>
              <div className="flashcard-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {folderSets.map((set, i) => <SetCard key={set.id} set={set} color={color} index={i} onClick={() => setActiveSet(set)} />)}
              </div>
            </FolderSection>
          );
        })}
        {unfiledSets.length > 0 && (
          <FolderSection name={ts('Unfiled')} count={unfiledSets.length} color="#94a3b8" collapsed={collapsedFolders.has(`${subjectId}:unfiled`)} onToggle={() => toggleFolder(`${subjectId}:unfiled`)}>
            <div className="flashcard-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {unfiledSets.map((set, i) => <SetCard key={set.id} set={set} color={color} index={i} onClick={() => setActiveSet(set)} />)}
            </div>
          </FolderSection>
        )}
      </>
    );
  };

  const renderMain = () => {
    if (loading) return <SkeletonCardGrid />;
    if (sets.length === 0) return <Empty />;
    if (visibleSets.length === 0) return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>{ts('No flashcard sets here')}</div>
        <div style={{ fontSize: '13px' }}>{ts('This folder is empty.')}</div>
      </div>
    );

    // All-subjects view: each subject has its own folder groups
    if (!filterId) {
      return (
        <div>
          {subjectsWithSets.map(s => {
            const groupSets = sets.filter(x => x.subjectId === s.id);
            if (groupSets.length === 0) return null;
            const color = s.color ?? '#3D7EFF';
            return (
              <div key={s.id} style={{ marginBottom: '36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.06em' }}>{s.title}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{ts('{n} set{s}', { n: groupSets.length, s: groupSets.length !== 1 ? 's' : '' })}</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                </div>
                {renderSetGrid(groupSets, s.id, color)}
              </div>
            );
          })}
        </div>
      );
    }

    // Specific folder selected: flat list
    if (folderFilter) {
      return (
        <div className="flashcard-set-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {visibleSets.map((set, i) => <SetCard key={set.id} set={set} color={selectedColor} index={i} onClick={() => setActiveSet(set)} />)}
        </div>
      );
    }

    // Subject selected, no folder filter: grouped by folder
    return renderSetGrid(visibleSets, filterId, selectedColor);
  };

  return (
    <div className={activeSet ? 'page-flashcards-session' : ''} style={{ display: 'flex', height: 'calc(100vh - 76px)', background: 'var(--bg-page)' }}>

      {/* Sidebar */}
      <aside className="flashcards-sidebar hidden md:flex flex-col" style={{
        width: activeSet ? '0' : '220px', flexShrink: 0,
        borderRight: activeSet ? 'none' : '1px solid var(--border-light)',
        padding: activeSet ? '0' : '16px 10px',
        gap: '2px', overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.25s ease, padding 0.25s ease',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '0 10px', marginBottom: '8px' }}>
          {ts('Flashcards')}
        </div>
        <SubjectBtn subject={null} count={sets.length} active={filterId === null}
          onClick={() => { setFilterId(null); setActiveSet(null); }} />
        {subjectsWithSets.map(s => {
          const isSelected = filterId === s.id;
          const color = s.color ?? '#3D7EFF';
          const sf = cardFolders.filter(f => f.subjectId === s.id);
          return (
            <div key={s.id}>
              <SubjectBtn subject={s} count={sets.filter(x => x.subjectId === s.id).length}
                active={isSelected && folderFilter === null}
                onClick={() => { setFilterId(s.id); setFolderFilter(null); setActiveSet(null); }} />
              {isSelected && sf.length > 0 && (
                <div style={{ marginTop: '2px', marginBottom: '2px' }}>
                  {sf.map(folder => (
                    <FolderBtn key={folder.id} name={folder.name} count={countForFolder(s.id, folder.id)}
                      active={folderFilter === folder.id} color={color}
                      onClick={() => { setFolderFilter(folder.id); setActiveSet(null); }} />
                  ))}
                  {countUnfiledFor(s.id) > 0 && (
                    <FolderBtn name={ts('Unfiled')} count={countUnfiledFor(s.id)}
                      active={folderFilter === 'unfiled'} color={color}
                      onClick={() => { setFolderFilter('unfiled'); setActiveSet(null); }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(14px, 4vw, 28px)' }}>
        {activeSet ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button onClick={() => setActiveSet(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                ← {ts('All flashcards')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeSubject && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeColor, boxShadow: `0 0 6px ${activeColor}` }} />}
                {renaming?.id === activeSet.id ? (
                  <input autoFocus value={renaming.value}
                    onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                    style={{ background: 'var(--bg-page)', border: `1px solid ${activeColor}55`, borderRadius: '6px', color: 'var(--text-1)', fontSize: '11px', fontWeight: 600, padding: '3px 8px', outline: 'none' }} />
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 600 }}>
                    {activeSubject?.title ?? ''} · {activeSet.name} · {ts('{n} cards', { n: activeSet.cards.length })}
                  </span>
                )}
                <button onClick={() => setRenaming({ id: activeSet.id, value: activeSet.name })} title={ts('Rename set')}
                  style={{ background: 'transparent', border: '1px solid var(--border-base)', borderRadius: '6px', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', padding: '3px 8px' }}>
                  ✎
                </button>
              </div>
            </div>
            <FlashcardViewer key={activeSet.id} cards={activeSet.cards} color={activeColor} subjectId={activeSet.subjectId}
              onSessionEnd={(n) => {
                const name = activeSubject?.title ?? 'a subject';
                record({ type: 'flashcards', subjectId: activeSet.subjectId, subjectName: name, detail: `Reviewed ${n} card${n !== 1 ? 's' : ''} in ${name}` });
              }} />
          </div>
        ) : renderMain()}
      </main>
    </div>
  );
}

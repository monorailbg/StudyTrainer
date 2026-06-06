import { useState, useEffect } from 'react';
import { getAllFlashcardSets, saveFlashcardSet, type StoredFlashcardSet } from '../lib/db';
import { isFirebaseConfigured, getAllCloudFlashcardSets, renameCloudFlashcardSet } from '../lib/cloudDb';
import { useResolvedSubjects } from '../store/useSubjects';
import { useDimMode } from '../store/useDimMode';
import { useActivity } from '../store/useActivity';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { SkeletonCardGrid } from '../components/Skeleton';
import { useLang } from '../context/LanguageContext';
import type { SubjectDef } from '../data/subjects';

// ── Subject sidebar item ──────────────────────────────────────────────────────

function SubjectBtn({ subject, count, active, onClick }: {
  subject: SubjectDef | null; count: number; active: boolean; onClick: () => void;
}) {
  const { ts } = useLang();
  const color = subject?.color ?? '#3D7EFF';
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
        background: active ? color + '18' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: color,
        boxShadow: active ? `0 0 6px ${color}` : 'none',
      }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? '#E6EDF3' : '#8B949E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {subject?.title ?? ts('All subjects')}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: active ? color : '#484F58' }}>
        {count}
      </span>
    </button>
  );
}

// ── Set card ─────────────────────────────────────────────────────────────────

function SetCard({ set, color, onClick, index = 0 }: { set: StoredFlashcardSet; color: string; onClick: () => void; index?: number }) {
  const { ts } = useLang();
  return (
    <button
      onClick={onClick}
      className="anim-rise"
      style={{
        ['--d' as string]: `${index * 45}ms`,
        background: '#161B22', border: '1px solid #21262D', borderRadius: '16px',
        padding: '16px', textAlign: 'left', cursor: 'pointer', width: '100%',
        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = color + '40'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', marginBottom: '12px',
        background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="1" y="4" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/><rect x="4" y="2" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {set.name}
      </div>
      <div style={{ fontSize: '11px', color: '#8B949E' }}>
        {ts('{n} cards', { n: set.cards.length })} · {new Date(set.createdAt).toLocaleDateString()}
      </div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty() {
  const { ts } = useLang();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: '#8B949E', textAlign: 'center', gap: '12px' }}>
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none"><rect x="4" y="14" width="30" height="22" rx="5" stroke="#30363D" strokeWidth="2"/><rect x="14" y="8" width="30" height="22" rx="5" stroke="#484F58" strokeWidth="2" fill="none"/></svg>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#E6EDF3', marginBottom: '4px' }}>{ts('No flashcard sets yet')}</div>
        <div style={{ fontSize: '13px' }}>{ts('Upload files to a subject and generate flashcards from the subject page.')}</div>
      </div>
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
  const [activeSet, setActiveSet] = useState<StoredFlashcardSet | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const dim = useDimMode(s => s.dim);
  const record = useActivity(s => s.record);

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

  useEffect(() => {
    const p = isFirebaseConfigured
      ? getAllCloudFlashcardSets().then(data => setSets(data as StoredFlashcardSet[]))
      : getAllFlashcardSets().then(data => setSets(data.sort((a, b) => b.createdAt - a.createdAt)));
    p.finally(() => setLoading(false));
  }, []);

  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
  const subjectsWithSets = allSubjects.filter(s => sets.some(x => x.subjectId === s.id));
  const visibleSets = filterId ? sets.filter(s => s.subjectId === filterId) : sets;

  // When in All view, group by subject for readability
  type Group = { subject: SubjectDef | undefined; sets: StoredFlashcardSet[] };
  const groups: Group[] = filterId
    ? [{ subject: subjectMap.get(filterId), sets: visibleSets }]
    : subjectsWithSets.map(s => ({ subject: s, sets: sets.filter(x => x.subjectId === s.id) }));

  const activeSubject = activeSet ? subjectMap.get(activeSet.subjectId) : undefined;
  const activeColor = activeSubject?.color ?? '#3D7EFF';

  return (
    <div className={`study-dim-root${dim ? ' dim-mode' : ''}`} style={{ display: 'flex', height: 'calc(100vh - 72px)', background: '#0D1117' }}>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col" style={{ width: '220px', flexShrink: 0, borderRight: '1px solid #21262D', padding: '16px 10px', gap: '2px', overflowY: 'auto' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '8px' }}>
          {ts('Flashcards')}
        </div>
        <SubjectBtn subject={null} count={sets.length} active={filterId === null} onClick={() => { setFilterId(null); setActiveSet(null); }} />
        {subjectsWithSets.map(s => (
          <SubjectBtn key={s.id} subject={s} count={sets.filter(x => x.subjectId === s.id).length} active={filterId === s.id} onClick={() => { setFilterId(s.id); setActiveSet(null); }} />
        ))}
      </aside>

      {/* Mobile subject strip */}
      <div className="md:hidden" style={{ display: 'none' }} />

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {activeSet ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button
                onClick={() => setActiveSet(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#8B949E', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {ts('← All flashcards')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeSubject && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeColor, boxShadow: `0 0 6px ${activeColor}` }} />}
                {renaming?.id === activeSet.id ? (
                  <input
                    autoFocus
                    value={renaming.value}
                    onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                    style={{
                      background: '#0D1117', border: `1px solid ${activeColor}55`, borderRadius: '6px',
                      color: '#E6EDF3', fontSize: '11px', fontWeight: 600, padding: '3px 8px', outline: 'none',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '11px', color: '#8B949E', fontWeight: 600 }}>
                    {activeSubject?.title ?? ''} · {activeSet.name} · {ts('{n} cards', { n: activeSet.cards.length })}
                  </span>
                )}
                <button
                  onClick={() => setRenaming({ id: activeSet.id, value: activeSet.name })}
                  title={ts('Rename set')}
                  style={{ background: 'transparent', border: '1px solid #30363D', borderRadius: '6px', color: '#484F58', cursor: 'pointer', fontSize: '12px', padding: '3px 8px' }}
                >
                  ✎
                </button>
              </div>
            </div>
            <FlashcardViewer
              key={activeSet.id}
              cards={activeSet.cards}
              color={activeColor}
              subjectId={activeSet.subjectId}
              onSessionEnd={(n) => {
                const name = activeSubject?.title ?? 'a subject';
                record({ type: 'flashcards', subjectId: activeSet.subjectId, subjectName: name, detail: `Reviewed ${n} card${n !== 1 ? 's' : ''} in ${name}` });
              }}
            />
          </div>
        ) : loading ? (
          <SkeletonCardGrid />
        ) : sets.length === 0 ? (
          <Empty />
        ) : (
          <div>
            {groups.map(({ subject, sets: groupSets }) => {
              if (groupSets.length === 0) return null;
              const color = subject?.color ?? '#3D7EFF';
              return (
                <div key={subject?.id ?? 'all'} style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#E6EDF3', letterSpacing: '0.06em' }}>{subject?.title ?? ts('Unknown subject')}</span>
                    <span style={{ fontSize: '10px', color: '#484F58' }}>{ts('{n} set{s}', { n: groupSets.length, s: groupSets.length !== 1 ? 's' : '' })}</span>
                    <div style={{ flex: 1, height: '1px', background: '#21262D' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {groupSets.map((set, i) => (
                      <SetCard key={set.id} set={set} color={color} index={i} onClick={() => setActiveSet(set)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { getAllNotes, type StoredNote } from '../lib/db';
import { useResolvedSubjects } from '../store/useSubjects';
import { NotesViewer } from '../components/NotesViewer';
import type { SubjectDef } from '../data/subjects';

// ── Subject sidebar item ──────────────────────────────────────────────────────

function SubjectBtn({ subject, count, active, onClick }: {
  subject: SubjectDef | null; count: number; active: boolean; onClick: () => void;
}) {
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
        {subject?.title ?? 'All subjects'}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: active ? color : '#484F58' }}>
        {count}
      </span>
    </button>
  );
}

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({ note, color, onClick }: { note: StoredNote; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#161B22', border: '1px solid #21262D', borderRadius: '16px',
        padding: '16px', textAlign: 'left', cursor: 'pointer', width: '100%',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = color + '40'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = '#21262D'; }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', marginBottom: '12px',
        background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.3"/></svg>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {note.name}
      </div>
      <div style={{ fontSize: '11px', color: '#8B949E' }}>
        {note.note.sections.length} sections · {new Date(note.createdAt).toLocaleDateString()}
      </div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: '#8B949E', textAlign: 'center', gap: '12px' }}>
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none"><rect x="6" y="6" width="36" height="36" rx="6" stroke="#30363D" strokeWidth="2"/><line x1="14" y1="16" x2="34" y2="16" stroke="#484F58" strokeWidth="2"/><line x1="14" y1="24" x2="28" y2="24" stroke="#484F58" strokeWidth="2"/><line x1="14" y1="32" x2="22" y2="32" stroke="#484F58" strokeWidth="2"/></svg>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#E6EDF3', marginBottom: '4px' }}>No notes yet</div>
        <div style={{ fontSize: '13px' }}>Upload files to a subject and generate notes from the subject page.</div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Notes() {
  const { allSubjects } = useResolvedSubjects();
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<StoredNote | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    getAllNotes().then(data =>
      setNotes(data.sort((a, b) => b.createdAt - a.createdAt))
    );
  }, []);

  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
  const subjectsWithNotes = allSubjects.filter(s => notes.some(n => n.subjectId === s.id));
  const visibleNotes = filterId ? notes.filter(n => n.subjectId === filterId) : notes;

  type Group = { subject: SubjectDef | undefined; notes: StoredNote[] };
  const groups: Group[] = filterId
    ? [{ subject: subjectMap.get(filterId), notes: visibleNotes }]
    : subjectsWithNotes.map(s => ({ subject: s, notes: notes.filter(n => n.subjectId === s.id) }));

  const activeSubject = activeNote ? subjectMap.get(activeNote.subjectId) : undefined;
  const activeColor = activeSubject?.color ?? '#3D7EFF';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 76px)', background: '#0D1117' }}>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col" style={{ width: '220px', flexShrink: 0, borderRight: '1px solid #21262D', padding: '16px 10px', gap: '2px', overflowY: 'auto' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', padding: '0 10px', marginBottom: '8px' }}>
          Notes
        </div>
        <SubjectBtn subject={null} count={notes.length} active={filterId === null} onClick={() => { setFilterId(null); setActiveNote(null); }} />
        {subjectsWithNotes.map(s => (
          <SubjectBtn key={s.id} subject={s} count={notes.filter(n => n.subjectId === s.id).length} active={filterId === s.id} onClick={() => { setFilterId(s.id); setActiveNote(null); }} />
        ))}
      </aside>

      {/* Main */}
      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', padding: activeNote ? 0 : '24px 28px' }}>

        {activeNote ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button
                onClick={() => setActiveNote(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#8B949E', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ← All notes
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeSubject && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeColor, boxShadow: `0 0 6px ${activeColor}` }} />}
                <span style={{ fontSize: '11px', color: '#8B949E', fontWeight: 600 }}>
                  {activeSubject?.title ?? ''} · {activeNote.name}
                </span>
              </div>
            </div>
            <NotesViewer
              key={activeNote.id}
              notes={activeNote.note}
              color={activeColor}
              noteId={activeNote.id}
              scrollElRef={mainRef}
            />
          </div>
        ) : notes.length === 0 ? (
          <Empty />
        ) : (
          <div>
            {groups.map(({ subject, notes: groupNotes }) => {
              if (groupNotes.length === 0) return null;
              const color = subject?.color ?? '#3D7EFF';
              return (
                <div key={subject?.id ?? 'all'} style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#E6EDF3', letterSpacing: '0.06em' }}>{subject?.title ?? 'Unknown subject'}</span>
                    <span style={{ fontSize: '10px', color: '#484F58' }}>{groupNotes.length} note{groupNotes.length !== 1 ? 's' : ''}</span>
                    <div style={{ flex: 1, height: '1px', background: '#21262D' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {groupNotes.map(note => (
                      <NoteCard key={note.id} note={note} color={color} onClick={() => setActiveNote(note)} />
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

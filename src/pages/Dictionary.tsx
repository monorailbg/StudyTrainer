import { useState, useEffect } from 'react';
import { getAllDictionaryEntries, deleteDictionaryEntry, type DictionaryEntry } from '../lib/db';
import { useResolvedSubjects } from '../store/useSubjects';
import { DictionaryView } from '../components/DictionaryView';
import { useLang } from '../context/LanguageContext';

// ── Subject sidebar button ────────────────────────────────────────────────────

function SubjectBtn({ color, label, count, active, onClick }: {
  color: string; label: string; count: number; active: boolean; onClick: () => void;
}) {
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
        background: color, boxShadow: active ? `0 0 6px ${color}` : 'none',
      }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? '#E6EDF3' : '#8B949E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: active ? color : '#484F58' }}>
        {count}
      </span>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dictionary() {
  const { ts } = useLang();
  const { allSubjects: subjects } = useResolvedSubjects();
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  useEffect(() => {
    getAllDictionaryEntries().then(all =>
      setEntries(all.sort((a, b) => a.term.localeCompare(b.term)))
    ).catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    await deleteDictionaryEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const subjectsWithEntries = subjects.filter(s => entries.some(e => e.subjectId === s.id));

  const visibleEntries = activeSubjectId
    ? entries.filter(e => e.subjectId === activeSubjectId)
    : entries;

  const activeSubject = activeSubjectId ? subjects.find(s => s.id === activeSubjectId) : null;
  const accentColor = activeSubject?.color ?? '#3D7EFF';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 72px)', background: 'var(--bg-page)', overflow: 'hidden' }}>

      {/* Left sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'var(--bg-page)', display: 'flex', flexDirection: 'column',
        overflowY: 'auto', padding: '20px 12px',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#484F58', padding: '0 4px', marginBottom: '8px', fontFamily: "'Sora',sans-serif" }}>
          {ts('Dictionary')}
        </div>

        <SubjectBtn
          color="#3D7EFF"
          label={ts('All subjects')}
          count={entries.length}
          active={activeSubjectId === null}
          onClick={() => setActiveSubjectId(null)}
        />

        {subjectsWithEntries.length > 0 && (
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />
        )}

        {subjectsWithEntries.map(s => (
          <SubjectBtn
            key={s.id}
            color={s.color}
            label={s.title}
            count={entries.filter(e => e.subjectId === s.id).length}
            active={activeSubjectId === s.id}
            onClick={() => setActiveSubjectId(s.id)}
          />
        ))}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        <DictionaryView
          entries={visibleEntries}
          pendingTerms={[]}
          color={accentColor}
          onDelete={handleDelete}
        />
      </main>
    </div>
  );
}

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
      <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? 'var(--text-1)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: active ? color : 'var(--text-3)' }}>
        {count}
      </span>
    </button>
  );
}

const IconMenu = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dictionary() {
  const { ts } = useLang();
  const { allSubjects: subjects } = useResolvedSubjects();
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

  const closeSidebarOnMobile = (fn: () => void) => () => {
    fn();
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--nav-height))', background: 'var(--bg-page)', overflow: 'hidden', position: 'relative' }}>

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
      )}

      {/* Left sidebar */}
      <aside style={{
        width: sidebarOpen ? '220px' : '0',
        flexShrink: 0,
        borderRight: sidebarOpen ? '1px solid var(--border-light)' : 'none',
        background: 'var(--bg-page)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
        padding: sidebarOpen ? '20px 12px' : '0',
        transition: 'width 0.2s ease, padding 0.2s ease',
        ...(isMobile && sidebarOpen ? {
          position: 'fixed', left: 0, top: 0, bottom: 0,
          zIndex: 11, paddingTop: 'var(--nav-height)',
        } : {}),
      }}>
        <div style={{ minWidth: '196px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '0 4px', marginBottom: '8px', fontFamily: "'Sora',sans-serif" }}>
            {ts('Dictionary')}
          </div>

          <SubjectBtn
            color="#3D7EFF"
            label={ts('All subjects')}
            count={entries.length}
            active={activeSubjectId === null}
            onClick={closeSidebarOnMobile(() => setActiveSubjectId(null))}
          />

          {subjectsWithEntries.length > 0 && (
            <div style={{ width: '100%', height: '1px', background: 'var(--border-light)', margin: '8px 0' }} />
          )}

          {subjectsWithEntries.map(s => (
            <SubjectBtn
              key={s.id}
              color={s.color}
              label={s.title}
              count={entries.filter(e => e.subjectId === s.id).length}
              active={activeSubjectId === s.id}
              onClick={closeSidebarOnMobile(() => setActiveSubjectId(s.id))}
            />
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 16px' : '32px 40px' }}>
        {/* Mobile toggle button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '16px', padding: '8px 12px',
              background: 'var(--bg-card, #161B22)',
              border: '1px solid var(--border-light)',
              borderRadius: '10px', cursor: 'pointer',
              color: 'var(--text-2)', fontSize: '12px', fontWeight: 600,
            }}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            {activeSubject ? activeSubject.title : ts('All subjects')}
          </button>
        )}
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

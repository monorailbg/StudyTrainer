import { useState, useMemo } from 'react';
import type { DictionaryEntry } from '../lib/db';
import { useLang } from '../context/LanguageContext';

type SortMode = 'az' | 'topic';

const IconBook = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" fill="none">
    <path d="M2 2.5A1.5 1.5 0 013.5 1h11A1.5 1.5 0 0116 2.5v11a1.5 1.5 0 01-1.5 1.5H3.5A1.5 1.5 0 012 13.5v-11z" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 5h8M5 7.5h8M5 10h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6" stroke="rgba(61,126,255,0.25)" strokeWidth="2"/>
    <path d="M8 2a6 6 0 016 6" stroke="#3D7EFF" strokeWidth="2" strokeLinecap="round"/>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

interface PendingEntry {
  id: string;
  term: string;
}

export function DictionaryView({
  entries,
  pendingTerms,
  color,
  onDelete,
}: {
  entries: DictionaryEntry[];
  pendingTerms: PendingEntry[];
  color: string;
  onDelete: (id: string) => void;
}) {
  const { ts } = useLang();
  const [sort, setSort] = useState<SortMode>('az');
  const [search, setSearch] = useState('');

  const englishEntries = useMemo(() => entries.filter(e => !e.folder), [entries]);
  const japaneseEntries = useMemo(() => entries.filter(e => e.folder === '翻訳'), [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return englishEntries.filter(e =>
      !q || e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)
    );
  }, [englishEntries, search]);

  const filteredJapanese = useMemo(() => {
    const q = search.trim().toLowerCase();
    return japaneseEntries.filter(e =>
      !q || e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)
    );
  }, [japaneseEntries, search]);

  const grouped = useMemo<{ label: string; items: DictionaryEntry[] }[]>(() => {
    if (sort === 'az') {
      const sorted = [...filtered].sort((a, b) => a.term.localeCompare(b.term));
      const map = new Map<string, DictionaryEntry[]>();
      for (const e of sorted) {
        const letter = e.term[0]?.toUpperCase() ?? '#';
        if (!map.has(letter)) map.set(letter, []);
        map.get(letter)!.push(e);
      }
      return [...map.entries()].map(([label, items]) => ({ label, items }));
    }
    // By topic (source note)
    const map = new Map<string, DictionaryEntry[]>();
    for (const e of filtered) {
      const label = e.sourceNoteTitle ?? ts('No source');
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([label, items]) => ({
      label,
      items: items.sort((a, b) => a.term.localeCompare(b.term)),
    }));
  }, [filtered, sort, ts]);

  const isEmpty = entries.length === 0 && pendingTerms.length === 0;

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '48px' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <span style={{ color }}><IconBook /></span>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-1)' }}>
            {ts('Dictionary')}
          </h2>
          {entries.length > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 600, color,
              background: color + '18', border: `1px solid ${color}30`,
              borderRadius: '999px', padding: '2px 8px',
            }}>
              {entries.length}
            </span>
          )}
        </div>

        {/* Sort toggle */}
        {englishEntries.length > 0 && (
          <div style={{
            display: 'flex', gap: '2px', padding: '3px',
            background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-light)',
          }}>
            {(['az', 'topic'] as SortMode[]).map(m => (
              <button
                key={m}
                onClick={() => setSort(m)}
                style={{
                  padding: '5px 12px', borderRadius: '6px', border: 'none',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  background: sort === m ? color + '22' : 'transparent',
                  color: sort === m ? color : 'var(--text-2)',
                  transition: 'all 0.15s ease',
                }}
              >
                {m === 'az' ? 'A → Z' : ts('By source')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      {entries.length > 3 && (
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={ts('Search terms…')}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
              borderRadius: '10px', color: 'var(--text-1)', fontSize: '13px',
              padding: '9px 14px 9px 36px', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Pending (generating) entries */}
      {pendingTerms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {pendingTerms.map(p => (
            <div key={p.id} style={{
              background: 'var(--bg-surface)', border: '1px solid rgba(61,126,255,0.2)',
              borderRadius: '12px', padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <Spinner />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '3px' }}>{p.term}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{ts('Generating definition…')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: 'var(--bg-surface)', borderRadius: '16px',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>📖</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '6px' }}>
            {ts('No dictionary entries yet')}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-3)', maxWidth: '320px', margin: '0 auto' }}>
            {ts('Select a word or phrase in any note, then tap the dictionary button to add it here with an AI-generated definition.')}
          </div>
        </div>
      )}

      {/* No search results */}
      {!isEmpty && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontSize: '13px' }}>
          {ts('No entries match "{q}"', { q: search })}
        </div>
      )}

      {/* Grouped English entries */}
      {grouped.map(({ label, items }) => (
        <div key={label} style={{ marginBottom: '28px' }}>
          <div style={{
            fontSize: sort === 'az' ? '22px' : '11px',
            fontWeight: sort === 'az' ? 700 : 600,
            color: sort === 'az' ? color : 'var(--text-2)',
            letterSpacing: sort === 'az' ? '-0.02em' : '0.1em',
            textTransform: sort === 'topic' ? 'uppercase' : 'none',
            marginBottom: '10px',
            paddingBottom: '6px',
            borderBottom: `1px solid var(--border-light)`,
          }}>
            {label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(entry => (
              <EntryCard key={entry.id} entry={entry} color={color} onDelete={onDelete} sort={sort} />
            ))}
          </div>
        </div>
      ))}

      {/* 翻訳 section */}
      {filteredJapanese.length > 0 && (
        <div style={{ marginTop: grouped.length > 0 ? '40px' : 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '16px', paddingBottom: '10px',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <span style={{ fontSize: '20px', lineHeight: 1, opacity: 0.7 }}>あ</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
              翻訳
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--text-2)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
              borderRadius: '999px', padding: '2px 8px',
            }}>
              {filteredJapanese.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredJapanese
              .slice()
              .sort((a, b) => a.term.localeCompare(b.term))
              .map(entry => (
                <EntryCard key={entry.id} entry={entry} color="rgba(230,237,243,0.6)" onDelete={onDelete} sort={sort} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderDefinition(definition: string) {
  const lines = definition.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'));
  if (bullets.length > 0) {
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: '2px', fontSize: '11px', opacity: 0.5 }}>•</span>
            <span>{b.replace(/^[•\-*]\s*/, '')}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <span>{definition}</span>;
}

function EntryCard({
  entry, color, onDelete, sort,
}: {
  entry: DictionaryEntry;
  color: string;
  onDelete: (id: string) => void;
  sort: SortMode;
}) {
  const { ts } = useLang();

  return (
    <div
      style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
        borderRadius: '12px', padding: '16px 18px',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color + '40')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
    >
      <div className="flex items-start justify-between gap-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Term */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '7px' }}>
            <span style={{
              fontSize: '15px', fontWeight: 700, color: 'var(--text-1)',
              fontFamily: 'Sora, sans-serif',
            }}>
              {entry.term}
            </span>
            {entry.sourceNoteTitle && sort === 'az' && (
              <span style={{
                fontSize: '10px', fontWeight: 600, color: color,
                background: color + '14', border: `1px solid ${color}28`,
                borderRadius: '999px', padding: '2px 7px', flexShrink: 0,
              }}>
                {entry.sourceNoteTitle}
              </span>
            )}
          </div>

          {/* Definition */}
          <div style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--text-2)' }}>
            {renderDefinition(entry.definition)}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(entry.id)}
          title={ts('Delete')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', padding: '2px', lineHeight: 0, flexShrink: 0,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F85149')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

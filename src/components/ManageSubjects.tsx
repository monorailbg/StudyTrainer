import { useState } from 'react';
import {
  useSubjects,
  useResolvedSubjects,
  SUBJECT_COLORS,
} from '../store/useSubjects';

// ── Icons ────────────────────────────────────────────────────────────────────

const IconStar = ({ filled, color }: { filled: boolean; color: string }) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill={filled ? color : 'none'}>
    <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3 4.2 13.3l.7-4.3-3.1-3 4.3-.6L8 1.5z"
      stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Modal ────────────────────────────────────────────────────────────────────

export function ManageSubjects({ onClose }: { onClose: () => void }) {
  const { allSubjects, isCore } = useResolvedSubjects();
  const { addSubject, deleteSubject, setCore, restoreDefaults } = useSubjects();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [asCore, setAsCore] = useState(false);

  const canAdd = title.trim().length > 0;

  function handleAdd() {
    if (!canAdd) return;
    addSubject({ title, description, color, isCore: asCore });
    setTitle('');
    setDescription('');
    setColor(SUBJECT_COLORS[0]);
    setAsCore(false);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(1,4,9,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '5vh 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="anim-fadein"
        style={{
          width: '100%', maxWidth: '540px',
          background: '#0D1117', border: '1px solid #21262D',
          borderRadius: '24px', overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #21262D' }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '16px', color: '#E6EDF3' }}>
              Manage subjects
            </div>
            <div style={{ fontSize: '12px', color: '#8B949E', marginTop: '2px' }}>
              Star to mark as core, create new, or remove what you don't need.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px', height: '32px', borderRadius: '999px', flexShrink: 0,
              background: '#161B22', border: '1px solid #30363D', color: '#8B949E',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 14 14" width="12" height="12" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Subject list */}
        <div style={{ maxHeight: '38vh', overflowY: 'auto', padding: '14px 16px' }}>
          <div className="flex flex-col gap-1.5">
            {allSubjects.map(s => {
              const core = isCore(s);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ background: '#161B22', border: '1px solid #21262D', borderRadius: '14px' }}
                >
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}`, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: '10px', color: core ? s.color : '#484F58', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1px' }}>
                      {core ? 'Core' : 'Extended'}
                    </div>
                  </div>

                  {/* Core toggle */}
                  <button
                    onClick={() => setCore(s.id, !core)}
                    aria-label={core ? 'Make extended' : 'Make core'}
                    style={{
                      width: '30px', height: '30px', borderRadius: '999px', flexShrink: 0,
                      background: core ? s.color + '20' : 'transparent',
                      border: `1px solid ${core ? s.color + '50' : '#30363D'}`,
                      color: s.color, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <IconStar filled={core} color={s.color} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteSubject(s.id)}
                    aria-label="Delete subject"
                    style={{
                      width: '30px', height: '30px', borderRadius: '999px', flexShrink: 0,
                      background: 'transparent', color: '#f87171',
                      border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              );
            })}
            {allSubjects.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', fontSize: '13px', color: '#8B949E' }}>
                No subjects. Create one below.
              </div>
            )}
          </div>
        </div>

        {/* Create new */}
        <div style={{ padding: '16px', borderTop: '1px solid #21262D', background: '#0B0E13' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '10px' }}>
            New subject
          </div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Subject title"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            style={{
              width: '100%', height: '40px', padding: '0 14px', marginBottom: '8px',
              background: '#161B22', border: '1px solid #30363D', borderRadius: '12px',
              color: '#E6EDF3', fontSize: '13px', outline: 'none',
            }}
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            style={{
              width: '100%', height: '40px', padding: '0 14px', marginBottom: '12px',
              background: '#161B22', border: '1px solid #30363D', borderRadius: '12px',
              color: '#E6EDF3', fontSize: '13px', outline: 'none',
            }}
          />

          {/* Color picker */}
          <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: '14px' }}>
            {SUBJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                style={{
                  width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
                  background: c, flexShrink: 0,
                  border: color === c ? '2px solid #E6EDF3' : '2px solid transparent',
                  boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                  transition: 'all 0.15s ease',
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            {/* Core toggle for new subject */}
            <button
              onClick={() => setAsCore(v => !v)}
              className="flex items-center gap-2"
              style={{
                height: '40px', padding: '0 14px', borderRadius: '12px', cursor: 'pointer',
                background: asCore ? color + '18' : '#161B22',
                border: `1px solid ${asCore ? color + '50' : '#30363D'}`,
                color: asCore ? color : '#8B949E', fontSize: '12px', fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <IconStar filled={asCore} color={asCore ? color : '#8B949E'} />
              Core subject
            </button>

            <button
              onClick={handleAdd}
              disabled={!canAdd}
              style={{
                flex: 1, height: '40px', borderRadius: '12px',
                background: canAdd ? color : '#1F2937',
                color: canAdd ? '#0D1117' : '#8B949E',
                border: 'none', fontSize: '13px', fontWeight: 700,
                cursor: canAdd ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
            >
              Add subject
            </button>
          </div>

          <button
            onClick={restoreDefaults}
            style={{
              marginTop: '14px', background: 'none', border: 'none', padding: 0,
              fontSize: '11px', color: '#8B949E', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Restore default subjects
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import {
  useSubjects,
  useResolvedSubjects,
  SUBJECT_COLORS,
  type SubjectEdit,
} from '../store/useSubjects';
import type { SubjectDef } from '../data/subjects';
import { ICON_OPTIONS, NamedIcon, SubjectIcon } from '../data/subjectIcons';

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

const IconPencil = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
    <path d="M10.5 2.5l3 3-8 8H2.5v-3l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M9 4l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// ── Inline editor ────────────────────────────────────────────────────────────

function EditRow({ subject, onSave, onCancel }: {
  subject: SubjectDef;
  onSave: (patch: SubjectEdit) => void;
  onCancel: () => void;
}) {
  const { ts } = useLang();
  const [title, setTitle] = useState(subject.title);
  const [description, setDescription] = useState(subject.description);
  const [color, setColor] = useState(subject.color);
  const [icon, setIcon] = useState(subject.icon ?? '');

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '38px', padding: '0 12px',
    background: '#0D1117', border: '1px solid #30363D', borderRadius: '10px',
    color: '#E6EDF3', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: '#161B22', border: `1px solid ${color}55`, borderRadius: '14px', padding: '14px' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <span style={{
          width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
          background: color + '1F', border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SubjectIcon id={subject.id} icon={icon || undefined} color={color} />
        </span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={ts('Subject name')} style={inputStyle} autoFocus />
      </div>

      <input value={description} onChange={e => setDescription(e.target.value)} placeholder={ts('Short description')}
        style={{ ...inputStyle, marginBottom: '12px' }} />

      {/* Colour */}
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#484F58', marginBottom: '7px' }}>{ts('Colour')}</div>
      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: '12px' }}>
        {SUBJECT_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} aria-label={ts('Colour {name}', { name: c })}
            style={{
              width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', background: c, flexShrink: 0,
              border: color === c ? '2px solid #E6EDF3' : '2px solid transparent',
              boxShadow: color === c ? `0 0 8px ${c}` : 'none', transition: 'all 0.15s ease',
            }} />
        ))}
      </div>

      {/* Icon */}
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#484F58', marginBottom: '7px' }}>{ts('Icon')}</div>
      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: '14px' }}>
        {ICON_OPTIONS.map(opt => {
          const selected = icon === opt.key;
          return (
            <button key={opt.key} onClick={() => setIcon(opt.key)} title={ts(opt.label)}
              style={{
                width: '32px', height: '32px', borderRadius: '9px', cursor: 'pointer', flexShrink: 0,
                background: selected ? color + '22' : '#0D1117',
                border: `1px solid ${selected ? color : '#30363D'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease',
              }}>
              <NamedIcon iconKey={opt.key} color={selected ? color : '#8B949E'} />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onCancel}
          style={{ height: '38px', padding: '0 16px', borderRadius: '10px', cursor: 'pointer', background: '#161B22', border: '1px solid #30363D', color: '#8B949E', fontSize: '12px', fontWeight: 600 }}>
          {ts('Cancel')}
        </button>
        <button onClick={() => onSave({ title, description, color, icon: icon || undefined })}
          disabled={!title.trim()}
          style={{
            flex: 1, height: '38px', borderRadius: '10px', border: 'none',
            background: title.trim() ? color : '#1F2937', color: title.trim() ? '#0D1117' : '#8B949E',
            fontSize: '13px', fontWeight: 700, cursor: title.trim() ? 'pointer' : 'default',
          }}>
          {ts('Save changes')}
        </button>
      </div>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function ManageSubjects({ onClose }: { onClose: () => void }) {
  const { ts } = useLang();
  const { allSubjects, isCore } = useResolvedSubjects();
  const { addSubject, deleteSubject, setCore, editSubject, restoreDefaults } = useSubjects();

  const [editingId, setEditingId] = useState<string | null>(null);
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
              {ts('Manage subjects')}
            </div>
            <div style={{ fontSize: '12px', color: '#8B949E', marginTop: '2px' }}>
              {ts('Edit names and icons, star to mark as core, create new, or remove.')}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={ts('Close')}
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
              if (editingId === s.id) {
                return (
                  <EditRow
                    key={s.id}
                    subject={s}
                    onSave={(patch) => { editSubject(s.id, patch); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ background: '#161B22', border: '1px solid #21262D', borderRadius: '14px' }}
                >
                  <span style={{
                    width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                    background: s.color + '1A', border: `1px solid ${s.color}3A`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SubjectIcon id={s.id} icon={s.icon} color={s.color} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: '10px', color: core ? s.color : '#484F58', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1px' }}>
                      {core ? ts('Core') : ts('Extended')}
                    </div>
                  </div>

                  {/* Edit */}
                  <button
                    onClick={() => setEditingId(s.id)}
                    aria-label={ts('Edit subject')}
                    style={{
                      width: '30px', height: '30px', borderRadius: '999px', flexShrink: 0,
                      background: 'transparent', color: '#8B949E',
                      border: '1px solid #30363D', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IconPencil />
                  </button>

                  {/* Core toggle */}
                  <button
                    onClick={() => setCore(s.id, !core)}
                    aria-label={core ? ts('Make extended') : ts('Make core')}
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
                    aria-label={ts('Delete subject')}
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
                {ts('No subjects. Create one below.')}
              </div>
            )}
          </div>
        </div>

        {/* Create new */}
        <div style={{ padding: '16px', borderTop: '1px solid #21262D', background: '#0B0E13' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#484F58', marginBottom: '10px' }}>
            {ts('New subject')}
          </div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={ts('Subject title')}
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
            placeholder={ts('Short description (optional)')}
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
                aria-label={ts('Color {name}', { name: c })}
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
              {ts('Core subject')}
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
              {ts('Add subject')}
            </button>
          </div>

          <button
            onClick={restoreDefaults}
            style={{
              marginTop: '14px', background: 'none', border: 'none', padding: 0,
              fontSize: '11px', color: '#8B949E', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {ts('Restore default subjects')}
          </button>
        </div>
      </div>
    </div>
  );
}

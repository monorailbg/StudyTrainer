import type { GeneratedNote } from '../lib/generator';

export function NotesViewer({ notes }: { notes: GeneratedNote }) {
  const total = notes.sections.length;

  return (
    <div>
      {/* Summary header */}
      <div style={{
        backgroundColor: '#0d1a2e',
        border: '1px solid #1e2d45',
        borderRadius: '14px 14px 0 0',
        padding: '28px 32px',
        borderBottom: 'none',
      }}>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: '#f0f4f8', margin: '0 0 12px', lineHeight: 1.3 }}>
          {notes.title}
        </h2>
        <p style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px', color: '#94a3b8', lineHeight: 1.65, margin: 0, maxWidth: '65ch' }}>
          {notes.summary}
        </p>
      </div>

      {/* Sections */}
      {notes.sections.map((section, i) => (
        <div
          key={i}
          style={{
            backgroundColor: i % 2 === 0 ? '#0d1a2e' : '#0b1829',
            border: '1px solid #1e2d45',
            borderTop: 'none',
            borderRadius: i === total - 1 ? '0 0 14px 14px' : '0',
            padding: '22px 32px',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{
              flexShrink: 0,
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              backgroundColor: '#162236',
              border: '1px solid #1e2d45',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '1px',
            }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#4a5a6e', fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.05rem', color: '#f0f4f8', margin: '0 0 8px', lineHeight: 1.35 }}>
                {section.heading}
              </h3>
              <p style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px', color: '#94a3b8', lineHeight: 1.65, margin: '0 0 12px', maxWidth: '65ch' }}>
                {section.content}
              </p>
              {section.keyPoints && section.keyPoints.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {section.keyPoints.map((pt, j) => (
                    <li key={j} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#d4a843', fontSize: '11px', lineHeight: '20px', flexShrink: 0, fontWeight: 600 }}>▸</span>
                      <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                        {pt}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

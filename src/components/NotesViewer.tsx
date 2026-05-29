import type { GeneratedNote } from '../lib/generator';

export function NotesViewer({ notes }: { notes: GeneratedNote }) {
  const total = notes.sections.length;

  return (
    <div style={{ maxWidth: '680px' }}>
      {/* Header */}
      <div
        className="px-8 py-7 mb-1"
        style={{
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: '12px 12px 0 0',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
        }}
      >
        <h2 className="m-0 mb-3 leading-snug" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '1.4rem', color: '#E6EDF3' }}>
          {notes.title}
        </h2>
        <p className="m-0 text-sm leading-relaxed" style={{ color: '#8B949E', lineHeight: 1.7 }}>
          {notes.summary}
        </p>
      </div>

      {/* Sections */}
      {notes.sections.map((section, i) => (
        <div
          key={i}
          className="px-8 py-6"
          style={{
            background: i % 2 === 0 ? '#161B22' : '#0D1117',
            borderLeft: '1px solid #30363D',
            borderRight: '1px solid #30363D',
            borderBottom: i === total - 1 ? '1px solid #30363D' : 'none',
            borderRadius: i === total - 1 ? '0 0 12px 12px' : '0',
          }}
        >
          <div className="flex gap-5 items-start">
            <div
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center mt-0.5"
              style={{ background: '#1D3461', borderRadius: '6px', border: '1px solid rgba(61,126,255,0.25)' }}
            >
              <span className="mono text-[10px] font-medium" style={{ color: '#93B8FF' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="m-0 mb-2 text-base leading-snug" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, color: '#E6EDF3' }}>
                {section.heading}
              </h3>
              <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: '#8B949E', lineHeight: 1.7 }}>
                {section.content}
              </p>
              {section.keyPoints && section.keyPoints.length > 0 && (
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {section.keyPoints.map((pt, j) => (
                    <li key={j} className="flex gap-3 items-start">
                      <span
                        className="flex-shrink-0 w-1 h-1 rounded-full mt-2"
                        style={{ background: '#3D7EFF' }}
                      />
                      <span className="text-sm leading-relaxed" style={{ color: '#8B949E', lineHeight: 1.65 }}>
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

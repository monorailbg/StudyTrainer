import type { GeneratedNote } from '../lib/generator';

export function NotesViewer({ notes }: { notes: GeneratedNote }) {
  const total = notes.sections.length;

  return (
    <div>
      {/* Summary header */}
      <div className="bg-md-surface-container rounded-t-3xl px-8 py-7 border border-md-outline-variant border-b-0">
        <h2 className="font-display text-md-on-surface text-2xl m-0 mb-3 leading-snug">
          {notes.title}
        </h2>
        <p className="text-md-on-surface-variant text-sm leading-relaxed m-0 max-w-prose">
          {notes.summary}
        </p>
      </div>

      {/* Sections */}
      {notes.sections.map((section, i) => (
        <div
          key={i}
          className={`border border-md-outline-variant border-t-0 px-8 py-6 ${
            i === total - 1 ? 'rounded-b-3xl' : ''
          } ${i % 2 === 0 ? 'bg-md-surface-container' : 'bg-md-surface-container-low'}`}
        >
          <div className="flex gap-4 items-start">
            {/* Section number badge */}
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-md-primary-container flex items-center justify-center mt-0.5">
              <span className="tabular-nums text-[10px] font-semibold text-md-on-primary-container">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-display text-md-on-surface text-base m-0 mb-2 leading-snug">
                {section.heading}
              </h3>
              <p className="text-md-on-surface-variant text-sm leading-relaxed m-0 mb-3 max-w-prose">
                {section.content}
              </p>
              {section.keyPoints && section.keyPoints.length > 0 && (
                <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                  {section.keyPoints.map((pt, j) => (
                    <li key={j} className="flex gap-2.5 items-start">
                      <span className="text-md-primary text-xs leading-5 flex-shrink-0 font-semibold">▸</span>
                      <span className="text-md-on-surface-variant text-sm leading-relaxed">
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

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef } from 'react';

// ── Mermaid diagram block ─────────────────────────────────────────────────────

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import('mermaid').then(({ default: mermaid }) => {
      if (cancelled || !ref.current) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: { fontSize: '13px', fontFamily: 'Sora, sans-serif' },
      });
      const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
      mermaid.render(id, code).then(({ svg }) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
      }).catch(() => {
        if (!ref.current || cancelled) return;
        ref.current.textContent = code;
        ref.current.style.fontFamily = 'JetBrains Mono, monospace';
        ref.current.style.fontSize = '12px';
        ref.current.style.whiteSpace = 'pre';
        ref.current.style.color = 'var(--text-2)';
      });
    });
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div
      ref={ref}
      style={{
        margin: '16px 0',
        padding: '20px',
        borderRadius: '10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-base)',
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '60px',
      }}
    />
  );
}

// ── GitHub-style callout config ────────────────────────────────────────────────

const CALLOUT_CFG: Record<string, { border: string; bg: string; icon: string; label: string }> = {
  NOTE:      { border: '#3D7EFF', bg: 'rgba(61,126,255,0.08)',  icon: 'ℹ', label: 'Note' },
  TIP:       { border: '#48C78E', bg: 'rgba(72,199,142,0.08)',  icon: '✦', label: 'Tip' },
  WARNING:   { border: '#F5A623', bg: 'rgba(245,166,35,0.08)',  icon: '⚠', label: 'Warning' },
  DANGER:    { border: '#FF5B5B', bg: 'rgba(255,91,91,0.08)',   icon: '⛔', label: 'Danger' },
  IMPORTANT: { border: '#9D6EFF', bg: 'rgba(157,110,255,0.08)', icon: '★', label: 'Important' },
};

// ── MarkdownContent ───────────────────────────────────────────────────────────

interface MarkdownContentProps {
  content: string;
  accent: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HastNode = { type: string; tagName?: string; value?: string; children?: HastNode[] };

function getFirstTextValue(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  for (const child of node.children ?? []) {
    const v = getFirstTextValue(child);
    if (v) return v;
  }
  return '';
}

function getFullText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(getFullText).join('');
}

// Detects ASCII/Unicode tree-drawing characters (├──, └──, │) so they can be
// rendered as a preformatted monospace block instead of a collapsed paragraph.
const TREE_CHARS_RE = /[├└│]/;

const TLDR_RE = /^TL;?DR\s*:?/i;
const KEY_PRINCIPLE_RE = /^Key Principle\s*:/i;

export function MarkdownContent({ content, accent }: MarkdownContentProps) {
  return (
    <div className="prose-notes">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // ── Code blocks ──────────────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        code({ className, children, ref: _ref, ...props }) {
          const lang = /language-(\w+)/.exec(className ?? '')?.[1];
          const raw = String(children).replace(/\n$/, '');
          if (lang === 'mermaid') return <MermaidBlock code={raw} />;
          return (
            <code
              {...props}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-base)',
                borderRadius: '4px',
                padding: '2px 6px',
                color: accent,
              }}
            >
              {children}
            </code>
          );
        },

        // Unwrap pre so mermaid renders directly
        pre({ children }) {
          return <>{children}</>;
        },

        // ── Blockquote / GitHub-style callouts ────────────────────────────
        blockquote({ children, node }) {
          const firstText = node ? getFirstTextValue(node as HastNode) : '';
          const match = /^\[!(NOTE|TIP|WARNING|DANGER|IMPORTANT)\]/i.exec(firstText);
          if (match) {
            const type = match[1].toUpperCase();
            const cfg = CALLOUT_CFG[type] ?? CALLOUT_CFG.NOTE;
            return (
              <div style={{
                margin: '14px 0',
                padding: '12px 16px',
                borderRadius: '8px',
                background: cfg.bg,
                borderLeft: `3px solid ${cfg.border}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px',
                }}>
                  <span style={{ color: cfg.border, fontSize: '13px', lineHeight: 1 }}>{cfg.icon}</span>
                  <span style={{
                    color: cfg.border, fontSize: '10px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ color: 'var(--text-2)', fontSize: '13.5px', lineHeight: 1.65 }}>
                  {children}
                </div>
              </div>
            );
          }
          return (
            <blockquote style={{
              margin: '14px 0', padding: '12px 16px',
              borderLeft: '3px solid var(--border-base)',
              color: 'var(--text-2)', fontStyle: 'italic', background: 'var(--bg-elevated)',
              borderRadius: '0 8px 8px 0',
            }}>
              {children}
            </blockquote>
          );
        },

        // ── Tables ────────────────────────────────────────────────────────
        table({ children }) {
          return (
            <div className="notes-table-wrapper" style={{ borderRadius: '8px', border: '1px solid var(--border-base)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'var(--text-1)' }}>
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead style={{ background: 'var(--bg-elevated)' }}>{children}</thead>;
        },
        th({ children }) {
          return (
            <th style={{
              padding: '12px 16px', textAlign: 'left', fontWeight: 700,
              fontSize: '11px', letterSpacing: '0.06em', color: accent,
              borderBottom: `2px solid ${accent}40`, whiteSpace: 'nowrap',
            }}>
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-light)',
              color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.5,
            }}>
              {children}
            </td>
          );
        },
        tr({ children }) {
          return <tr style={{ transition: 'background 0.1s' }}>{children}</tr>;
        },

        // ── Headings ──────────────────────────────────────────────────────
        h1({ children }) {
          return <h1 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-1)', margin: '22px 0 10px', fontFamily: 'Sora, sans-serif', letterSpacing: '-0.01em' }}>{children}</h1>;
        },
        h2({ children }) {
          return <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', margin: '18px 0 8px', fontFamily: 'Sora, sans-serif' }}>{children}</h2>;
        },
        h3({ children }) {
          return <h3 style={{ fontSize: '14px', fontWeight: 600, color: accent, margin: '14px 0 6px' }}>{children}</h3>;
        },

        // ── Paragraphs ────────────────────────────────────────────────────
        p({ children, node }) {
          const text = node ? getFullText(node as HastNode) : '';

          if (TREE_CHARS_RE.test(text)) {
            return <pre className="notes-tree-block">{text}</pre>;
          }

          if (TLDR_RE.test(text.trim())) {
            return (
              <p className="notes-tldr-block">
                <span className="notes-tldr-badge">TL;DR</span>
                <span style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--text-1)' }}>
                  {text.replace(TLDR_RE, '').trim()}
                </span>
              </p>
            );
          }

          if (KEY_PRINCIPLE_RE.test(text.trim())) {
            return (
              <p className="notes-keyprinciple-block">
                <strong style={{ color: 'var(--accent-orange)' }}>Key Principle:</strong>{' '}
                <span style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--text-1)' }}>
                  {text.replace(KEY_PRINCIPLE_RE, '').trim()}
                </span>
              </p>
            );
          }

          return (
            <p style={{
              margin: '0 0 12px', fontSize: '15px', lineHeight: 1.80,
              color: 'var(--text-1)', letterSpacing: '0.01em',
            }}>
              {children}
            </p>
          );
        },

        // ── Lists ─────────────────────────────────────────────────────────
        ul({ children }) {
          return (
            <ul style={{
              margin: '8px 0 14px', padding: 0, listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: '7px',
            }}>
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol style={{
              margin: '8px 0 14px', padding: '0 0 0 20px',
              display: 'flex', flexDirection: 'column', gap: '7px',
              color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.65,
            }}>
              {children}
            </ol>
          );
        },
        li({ children }) {
          return (
            <li style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              fontSize: '14px', lineHeight: 1.65, color: 'var(--text-2)',
            }}>
              <span style={{
                color: accent, fontSize: '10px', marginTop: '5px', flexShrink: 0,
              }}>▸</span>
              <span style={{ flex: 1 }}>{children}</span>
            </li>
          );
        },

        // ── Inline ───────────────────────────────────────────────────────
        strong({ children }) {
          return (
            <strong style={{
              background: accent + '22', color: accent,
              borderRadius: '3px', padding: '1px 4px', fontWeight: 600,
            }}>
              {children}
            </strong>
          );
        },
        em({ children }) {
          return <em style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>{children}</em>;
        },

        // ── Divider ───────────────────────────────────────────────────────
        hr() {
          return <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border-light)' }} />;
        },
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ── Helper: strip markdown to plain text (for previews) ─────────────────────

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')        // fenced code
    .replace(/`[^`]+`/g, m => m.slice(1, -1))
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*(\[![\w]+\])?\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

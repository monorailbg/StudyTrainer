import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPANIES, type CompanyDef } from '../data/companies';

// ── Industry sidebar ──────────────────────────────────────────────────────────

const INDUSTRIES = ['All', ...Array.from(new Set(COMPANIES.map(c => c.industry))).sort()];

function IndustryBtn({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
        background: active ? 'rgba(61,126,255,0.1)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <span style={{ flex: 1, fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? 'var(--text-1)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: active ? '#3D7EFF' : 'var(--text-3)' }}>{count}</span>
    </button>
  );
}

// ── Company card ──────────────────────────────────────────────────────────────

function CompanyCard({ company, index = 0, onClick }: { company: CompanyDef; index?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="anim-rise"
      style={{
        ['--d' as string]: `${index * 40}ms`,
        background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '16px',
        padding: '16px', textAlign: 'left', cursor: 'pointer', width: '100%',
        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-2px)';
        el.style.borderColor = company.color + '50';
        el.style.boxShadow = `0 4px 16px ${company.color}14`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.borderColor = 'var(--border-light)';
        el.style.boxShadow = '';
      }}
    >
      {/* Color bar */}
      <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: company.color, marginBottom: '12px', opacity: 0.7 }} />

      {/* Name + ticker */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>{company.name}</span>
        {company.ticker && <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600 }}>{company.ticker}</span>}
      </div>

      {/* Industry + HQ */}
      <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '10px' }}>
        {company.industry} · {company.hq.split(',').slice(-1)[0].trim()}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
        {company.tags.slice(0, 3).map(tag => (
          <span key={tag} style={{
            fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px',
            background: company.color + '15', color: company.color, border: `1px solid ${company.color}30`,
          }}>{tag}</span>
        ))}
      </div>

      {/* Concept count */}
      <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
        {company.conceptIds.length} linked concepts
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Companies() {
  const navigate = useNavigate();
  const [activeIndustry, setActiveIndustry] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = COMPANIES.filter(c => {
    const matchIndustry = activeIndustry === 'All' || c.industry === activeIndustry;
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q));
    return matchIndustry && matchSearch;
  });

  const industryCounts = (ind: string) => ind === 'All' ? COMPANIES.length : COMPANIES.filter(c => c.industry === ind).length;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 76px)', background: 'var(--bg-page)' }}>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col" style={{
        width: '200px', flexShrink: 0,
        borderRight: '1px solid var(--border-light)',
        padding: '16px 10px', gap: '2px', overflowY: 'auto',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '0 10px', marginBottom: '8px' }}>
          Industries
        </div>
        {INDUSTRIES.map(ind => (
          <IndustryBtn
            key={ind}
            label={ind}
            count={industryCounts(ind)}
            active={activeIndustry === ind}
            onClick={() => setActiveIndustry(ind)}
          />
        ))}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(14px, 4vw, 28px)' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-1)', margin: 0, lineHeight: 1.2 }}>Company Intelligence</h1>
              <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '4px 0 0' }}>
                Explore {COMPANIES.length} global companies — linked to concepts, supply chains, and current events.
              </p>
            </div>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies, industries, or tags..."
            style={{
              width: '100%', maxWidth: '420px',
              background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
              borderRadius: '10px', padding: '8px 12px',
              fontSize: '13px', color: 'var(--text-1)', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: '60px 20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>No companies found</div>
            <div style={{ fontSize: '13px' }}>Try a different search or industry filter.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {filtered.map((company, i) => (
              <CompanyCard
                key={company.id}
                company={company}
                index={i}
                onClick={() => navigate(`/company/${company.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { COMPANY_MAP } from '../data/companies';
import { CONCEPTS, CONCEPT_MAP, CATEGORY_COLORS } from '../data/conceptGraph';
import {
  getCompanyIntelligence,
  saveCompanyIntelligence,
  deleteCompanyIntelligence,
  type StoredCompanyIntelligence,
  type CompanyEvent,
} from '../lib/db';
import { generateCompanyIntelligence } from '../lib/companyIntelligence';

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPACT_COLORS: Record<CompanyEvent['impact'], string> = {
  positive: '#48C78E',
  negative: '#F87171',
  neutral:  '#F6AD55',
};

const IMPACT_LABELS: Record<CompanyEvent['impact'], string> = {
  positive: '↑ Positive',
  negative: '↓ Negative',
  neutral:  '→ Neutral',
};

const DIFF_COLORS = { beginner: '#48C78E', intermediate: '#F6AD55', advanced: '#F87171' };

type Tab = 'overview' | 'concepts' | 'supply-chain' | 'events';

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '12px 16px', minWidth: '110px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Concept card ──────────────────────────────────────────────────────────────

function ConceptChip({ conceptId, color }: { conceptId: string; color: string }) {
  const concept = CONCEPT_MAP.get(conceptId);
  if (!concept) return null;
  const catColor = CATEGORY_COLORS[concept.category] ?? color;
  return (
    <Link
      to={`/knowledge-graph`}
      title={`View in Knowledge Graph: ${concept.name}`}
      style={{ textDecoration: 'none' }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '11px', fontWeight: 600, padding: '4px 9px', borderRadius: '999px',
        background: catColor + '15', color: catColor, border: `1px solid ${catColor}30`,
        cursor: 'pointer', transition: 'background 0.15s',
      }}>{concept.name}</span>
    </Link>
  );
}

function ConceptCard({ conceptId }: { conceptId: string }) {
  const concept = CONCEPT_MAP.get(conceptId);
  if (!concept) return null;
  const catColor = CATEGORY_COLORS[concept.category] ?? '#3D7EFF';
  return (
    <Link to="/knowledge-graph" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '12px',
        padding: '12px 14px', cursor: 'pointer',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = catColor + '50'; (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 10px ${catColor}14`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)' }}>{concept.name}</span>
          <span style={{
            fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', flexShrink: 0, marginLeft: '8px',
            background: DIFF_COLORS[concept.difficulty] + '20', color: DIFF_COLORS[concept.difficulty],
          }}>{concept.difficulty}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '6px' }}>{concept.category}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {concept.description}
        </div>
      </div>
    </Link>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event, companyColor }: { event: CompanyEvent; companyColor: string }) {
  const impactColor = IMPACT_COLORS[event.impact];
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.4 }}>{event.headline}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: impactColor + '20', color: impactColor }}>
            {IMPACT_LABELS[event.impact]}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{event.date}</span>
        </div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 10px' }}>{event.summary}</p>
      {event.linkedConceptIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {event.linkedConceptIds.map(id => <ConceptChip key={id} conceptId={id} color={companyColor} />)}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const company = id ? COMPANY_MAP.get(id) : undefined;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [intel, setIntel] = useState<StoredCompanyIntelligence | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    getCompanyIntelligence(company.id).then(stored => {
      if (stored) setIntel(stored);
    });
  }, [company]);

  if (!company) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 76px)', gap: '12px', color: 'var(--text-2)' }}>
        <div style={{ fontSize: '32px' }}>🏢</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-1)' }}>Company not found</div>
        <button onClick={() => navigate('/companies')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3D7EFF', fontSize: '13px' }}>
          ← Back to Companies
        </button>
      </div>
    );
  }

  const allConceptIds = CONCEPTS.map(c => c.id);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const result = await generateCompanyIntelligence(company, allConceptIds);
      await saveCompanyIntelligence(result);
      setIntel(result);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    await deleteCompanyIntelligence(company.id);
    setIntel(null);
    handleGenerate();
  };

  // Merge static + AI-surfaced concepts
  const allLinkedConceptIds = intel
    ? [...new Set([...company.conceptIds, ...intel.learningLinks])]
    : company.conceptIds;

  // Group by category
  const byCategory = new Map<string, string[]>();
  for (const id of allLinkedConceptIds) {
    const concept = CONCEPT_MAP.get(id);
    if (!concept) continue;
    const cat = concept.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(id);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',     label: 'Overview' },
    { id: 'concepts',     label: `Concepts (${allLinkedConceptIds.length})` },
    { id: 'supply-chain', label: 'Supply Chain' },
    { id: 'events',       label: 'Current Events' },
  ];

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: 'calc(100vh - 76px)' }}>

      {/* ── Hero header ── */}
      <div style={{
        borderBottom: '1px solid var(--border-light)',
        padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 48px)',
        background: 'var(--bg-surface)',
      }}>
        {/* Back link */}
        <button
          onClick={() => navigate('/companies')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', padding: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← All Companies
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          {/* Color accent block */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
            background: company.color + '20', border: `2px solid ${company.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: company.color, opacity: 0.85 }} />
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>{company.name}</h1>
              {company.ticker && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: company.color, background: company.color + '15', padding: '2px 8px', borderRadius: '6px', border: `1px solid ${company.color}30` }}>
                  {company.ticker}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>
              {company.industry} · {company.sector} · Est. {company.founded}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>🏢 {company.hq}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <Stat label="Revenue" value={company.financials.revenue} color={company.color} />
          <Stat label="Net Income" value={company.financials.netIncome} color="var(--text-1)" />
          <Stat label="Market Cap" value={company.financials.marketCap} color="var(--text-1)" />
          <Stat label="Employees" value={company.financials.employees} color="var(--text-1)" />
          <Stat label="FY" value={String(company.financials.fiscalYear)} color="var(--text-1)" />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-surface)', padding: '0 clamp(16px, 4vw, 48px)', display: 'flex', gap: '2px', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px',
              fontSize: '13px', fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? company.color : 'var(--text-2)',
              borderBottom: `2px solid ${activeTab === tab.id ? company.color : 'transparent'}`,
              whiteSpace: 'nowrap', transition: 'color 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: 'clamp(16px, 4vw, 36px) clamp(16px, 4vw, 48px)' }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '900px' }}>

            {/* Description */}
            <div style={{ gridColumn: '1 / -1', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>About</div>
              <p style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.7, margin: 0 }}>{company.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                {company.tags.map(tag => (
                  <span key={tag} style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', background: company.color + '15', color: company.color, border: `1px solid ${company.color}30` }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Markets */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Markets</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {company.markets.map(m => (
                  <li key={m} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-1)' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: company.color, flexShrink: 0 }} />
                    {m}
                  </li>
                ))}
              </ul>
            </div>

            {/* Competitors */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Competitors</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {company.competitors.map(c => (
                  <span key={c} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-1)' }}>{c}</span>
                ))}
              </div>
            </div>

            {/* Brands */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Brands & Subsidiaries</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {company.brands.map(b => (
                  <span key={b} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', background: company.color + '10', border: `1px solid ${company.color}25`, color: 'var(--text-1)' }}>{b}</span>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* CONCEPTS */}
        {activeTab === 'concepts' && (
          <div style={{ maxWidth: '900px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: 0, marginBottom: '20px', lineHeight: 1.6 }}>
              Click any concept to explore it in the Knowledge Graph. {intel?.learningLinks.length ? `${intel.learningLinks.length} additional concepts were surfaced by AI analysis.` : ''}
            </p>

            {Array.from(byCategory.entries()).map(([category, ids]) => {
              const catColor = CATEGORY_COLORS[category] ?? company.color;
              return (
                <div key={category} style={{ marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: catColor, boxShadow: `0 0 6px ${catColor}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.06em' }}>{category}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{ids.length} concept{ids.length !== 1 ? 's' : ''}</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {ids.map(id => <ConceptCard key={id} conceptId={id} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUPPLY CHAIN */}
        {activeTab === 'supply-chain' && (
          <div style={{ maxWidth: '900px' }}>

            {/* Globe link for companies with existing GlobeView data */}
            {company.globeCompanyId && (
              <div style={{ background: company.color + '10', border: `1px solid ${company.color}30`, borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: company.color, marginBottom: '2px' }}>Interactive 3D Supply Chain Globe Available</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{company.name}'s full supply chain network is visualised on the Dashboard globe.</div>
                </div>
                <Link
                  to="/"
                  style={{ fontSize: '12px', fontWeight: 700, color: company.color, background: company.color + '20', border: `1px solid ${company.color}40`, borderRadius: '8px', padding: '6px 14px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Open Globe →
                </Link>
              </div>
            )}

            {/* Logistics flow */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Logistics Flow</div>
              <div style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.6 }}>{company.supplyChain.logisticsFlow}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>

              {/* Suppliers */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Suppliers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {company.supplyChain.suppliers.map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: company.color, marginBottom: '3px' }}>{s.role}</div>
                      {s.locations.map(loc => (
                        <div key={loc} style={{ fontSize: '11px', color: 'var(--text-2)', paddingLeft: '8px' }}>· {loc}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Manufacturing */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Manufacturing</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {company.supplyChain.manufacturing.map(m => (
                    <li key={m} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--text-1)' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: company.color, flexShrink: 0, marginTop: '4px' }} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Distribution */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Distribution</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {company.supplyChain.distribution.map(d => (
                    <li key={d} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--text-1)' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F6AD55', flexShrink: 0, marginTop: '4px' }} />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Countries */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Key Countries</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {company.supplyChain.keyCountries.map(c => (
                    <span key={c} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-1)' }}>{c}</span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* CURRENT EVENTS */}
        {activeTab === 'events' && (
          <div style={{ maxWidth: '760px' }}>

            {!intel && !generating && (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📰</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '6px' }}>No current events generated yet</div>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto 20px' }}>
                  Generate AI-powered current events for {company.name}, automatically linked to business concepts in your Knowledge Graph.
                </p>
                <button
                  onClick={handleGenerate}
                  style={{
                    background: company.color, color: '#fff', border: 'none', borderRadius: '10px',
                    padding: '10px 22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ✦ Generate Intelligence
                </button>
              </div>
            )}

            {generating && (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: `2px solid ${company.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Generating intelligence for {company.name}…
                </div>
              </div>
            )}

            {genError && (
              <div style={{ background: '#F8717120', border: '1px solid #F8717150', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#F87171' }}>
                {genError}
              </div>
            )}

            {intel && !generating && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    Generated {new Date(intel.generatedAt).toLocaleDateString()} · {intel.events.length} events
                  </div>
                  <button
                    onClick={handleRegenerate}
                    style={{ background: 'none', border: '1px solid var(--border-base)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', padding: '5px 12px' }}
                  >
                    ↺ Regenerate
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {intel.events.map((event, i) => (
                    <EventCard key={i} event={event} companyColor={company.color} />
                  ))}
                </div>

                {intel.learningLinks.length > 0 && (
                  <div style={{ marginTop: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '16px 20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>AI-Surfaced Learning Links</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '0 0 10px' }}>Additional concepts identified as highly relevant to {company.name}:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {intel.learningLinks.map(id => <ConceptChip key={id} conceptId={id} color={company.color} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

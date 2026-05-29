import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import notesConfig from '../data/notes-config.json';
import type { NoteConfig } from '../types';

const notes = notesConfig as NoteConfig[];
const subjects = ['All', ...Array.from(new Set(notes.map((n) => n.subject)))];

const SAMPLE_NOTE_CONTENT: Record<string, { heading: string; body: string; bullets: string[] }[]> = {
  'note-001': [
    {
      heading: 'What is International Trade?',
      body: 'International trade is the exchange of goods and services between countries. It allows nations to specialise in producing what they do best and acquire goods they cannot efficiently produce themselves.',
      bullets: ['Nations specialise based on comparative advantage', 'Trade expands market size beyond domestic limits', 'Facilitates technology and knowledge transfer'],
    },
    {
      heading: 'Adam Smith & Absolute Advantage',
      body: "Adam Smith's 1776 'Wealth of Nations' established that countries benefit by specialising in goods where they have an absolute advantage — i.e., where they can produce more output with the same input.",
      bullets: ['Absolute advantage: produce more with same resources', 'Each country exports its absolutely advantaged goods', 'Limitation: ignores countries that are universally less efficient'],
    },
    {
      heading: 'Ricardo & Comparative Advantage',
      body: 'David Ricardo showed that even if one country is less efficient at producing all goods, mutual gains from trade remain possible through comparative advantage — specialising where opportunity cost is lowest.',
      bullets: ['Comparative advantage based on opportunity cost', 'Mutually beneficial trade even without absolute advantage', 'Foundation of modern trade theory'],
    },
  ],
  'note-002': [
    {
      heading: 'Rationale for Protectionism',
      body: 'Despite free trade benefits, governments often restrict imports to protect domestic industries, preserve jobs, or achieve strategic objectives.',
      bullets: ['Infant industry argument: protect new industries until competitive', 'National security: maintain strategic production capacity', 'Retaliation against unfair trading practices'],
    },
    {
      heading: 'Tariffs',
      body: 'A tariff is a tax imposed on imported goods. It raises the price of imports, making domestic alternatives more competitive. Revenue accrues to the government but consumers pay higher prices.',
      bullets: ['Specific tariff: fixed amount per unit', 'Ad valorem tariff: percentage of import value', 'Welfare loss: consumer surplus reduced, deadweight loss created'],
    },
    {
      heading: 'Non-Tariff Barriers (NTBs)',
      body: 'NTBs include quotas, subsidies, technical regulations, and licensing requirements that restrict trade without explicit taxes.',
      bullets: ['Import quotas set maximum import quantities', 'Subsidies make domestic producers artificially competitive', 'Regulatory standards can function as hidden trade barriers'],
    },
  ],
  'note-003': [
    {
      heading: 'Global vs Local Marketing',
      body: 'Global marketing involves standardising the marketing mix across international markets to achieve scale economies. Local adaptation tailors offerings to cultural and market differences.',
      bullets: ['Standardisation: cost efficiency, consistent brand image', 'Adaptation: cultural relevance, local regulatory compliance', 'Glocal strategy: standard core, localised execution'],
    },
    {
      heading: 'Market Entry Strategies',
      body: 'Firms can enter foreign markets through exporting, licensing, franchising, joint ventures, or wholly owned subsidiaries. Each involves different levels of risk, control, and investment.',
      bullets: ['Exporting: low risk, low control, easy exit', 'Joint ventures: shared risk, local knowledge, coordination challenges', 'FDI (subsidiaries): highest control, highest commitment'],
    },
    {
      heading: 'Cultural Dimensions (Hofstede)',
      body: "Geert Hofstede's framework identifies key cultural dimensions that affect marketing strategy: power distance, individualism/collectivism, uncertainty avoidance, and long-term orientation.",
      bullets: ['High power distance: hierarchical messaging works better', 'Collectivist cultures respond to community/family appeals', 'Uncertainty avoidance affects risk-based marketing claims'],
    },
  ],
  'note-004': [
    {
      heading: 'Consumer Decision-Making Process',
      body: "Consumers follow a multi-stage process: Need Recognition → Information Search → Evaluation of Alternatives → Purchase Decision → Post-Purchase Evaluation. Marketers target each stage.",
      bullets: ['Problem recognition triggered by internal/external stimuli', 'Evaluation uses evoked set of alternatives', 'Post-purchase dissonance managed through reassurance and support'],
    },
    {
      heading: 'Psychological Influences',
      body: 'Buying behaviour is shaped by motivation, perception, learning, beliefs, and attitudes. Maslow\'s hierarchy explains motivation levels from physiological to self-actualisation.',
      bullets: ["Maslow: physiological → safety → social → esteem → self-actualisation", 'Perception shaped by selective exposure and retention', 'Attitudes: cognitive, affective, conative components'],
    },
    {
      heading: 'Social & Cultural Factors',
      body: 'Reference groups, family, social roles, and cultural values all influence consumer choices. Opinion leaders and social proof are powerful motivators.',
      bullets: ['Reference groups: aspirational and dissociative', 'Family life cycle affects purchasing priorities', 'Subcultures create distinct segment opportunities'],
    },
  ],
  'note-005': [
    {
      heading: 'Time Value of Money',
      body: 'A core principle of finance: a sum of money today is worth more than the same sum in the future due to its earning potential. Present Value (PV) and Future Value (FV) calculations underpin all investment analysis.',
      bullets: ['FV = PV × (1+r)^n', 'PV = FV / (1+r)^n', 'Discount rate reflects opportunity cost and risk'],
    },
    {
      heading: 'Capital Budgeting',
      body: "Firms evaluate long-term investments using NPV, IRR, payback period, and profitability index. NPV is the theoretically superior method as it accounts for time value and absolute value creation.",
      bullets: ['NPV > 0: accept project; NPV < 0: reject', 'IRR: accept if IRR > WACC', 'Payback period: simple but ignores TVM and post-payback cash flows'],
    },
    {
      heading: 'Capital Structure',
      body: 'The mix of debt and equity financing affects both risk and return. Modigliani-Miller theorem shows that in perfect markets, capital structure is irrelevant — but with taxes, debt has a tax shield advantage.',
      bullets: ['Debt: cheaper due to tax deductibility of interest', 'Trade-off theory: balance tax shield against financial distress costs', 'Pecking order theory: prefer internal finance, then debt, then equity'],
    },
  ],
  'note-006': [
    {
      heading: 'Equity Valuation Methods',
      body: 'Key approaches: Discounted Cash Flow (DCF), Dividend Discount Model (DDM), Price/Earnings (P/E) ratio, and Comparable Company Analysis (comps). DCF is most fundamentally rigorous.',
      bullets: ['DCF: value = PV of future free cash flows', 'DDM: appropriate for dividend-paying mature companies', 'P/E multiples: quick but sensitive to earnings quality'],
    },
    {
      heading: 'Bond Pricing',
      body: 'A bond\'s price is the present value of its coupon payments plus the face value, discounted at the yield to maturity (YTM). Bond price and yield move inversely.',
      bullets: ['Price rises when market interest rates fall', 'Duration measures price sensitivity to rate changes', 'Credit spreads reflect default risk premium'],
    },
    {
      heading: 'Portfolio Theory (Markowitz)',
      body: "Diversification reduces portfolio risk without sacrificing expected return. The efficient frontier shows optimal portfolios that maximise return for a given level of risk.",
      bullets: ['Correlation < 1: diversification reduces risk', 'Systematic risk (beta) cannot be diversified away', 'CAPM prices assets based on systematic risk only'],
    },
  ],
  'note-007': [
    {
      heading: 'Supply and Demand',
      body: 'Market equilibrium is reached where quantity demanded equals quantity supplied. Price acts as a signal: above equilibrium creates surplus; below creates shortage.',
      bullets: ['Demand: inverse relationship with price (ceteris paribus)', 'Supply: positive relationship with price', 'Shifts vs movements along curves: distinguish carefully'],
    },
    {
      heading: 'Elasticity',
      body: "Elasticity measures responsiveness. PED = % change in Qd / % change in P. Inelastic goods (necessities) see less quantity change; elastic goods (luxuries) see more.",
      bullets: ['|PED| > 1: elastic (price rise reduces total revenue)', '|PED| < 1: inelastic (price rise increases total revenue)', 'Cross-price elasticity identifies substitutes and complements'],
    },
    {
      heading: 'Market Structures',
      body: 'Four structures: Perfect Competition, Monopolistic Competition, Oligopoly, Monopoly. Each has different implications for pricing power, efficiency, and welfare.',
      bullets: ['Perfect competition: P = MC = minimum ATC in long run', 'Monopoly: P > MC, deadweight loss, barrier to entry', 'Oligopoly: strategic interdependence, game theory applies'],
    },
  ],
  'note-008': [
    {
      heading: 'GDP and Economic Growth',
      body: 'GDP measures total output. Real GDP adjusts for inflation and is used to compare living standards over time. Long-run growth driven by productivity, capital accumulation, and technology.',
      bullets: ['Expenditure method: C + I + G + (X-M)', 'Human capital and technology are key to Solow growth model', 'Business cycles: expansion → peak → contraction → trough'],
    },
    {
      heading: 'Inflation and Unemployment',
      body: "The Phillips Curve suggests a short-run trade-off between inflation and unemployment. In the long run, the curve is vertical at the natural rate of unemployment (NAIRU).",
      bullets: ['Demand-pull inflation: excess aggregate demand', 'Cost-push inflation: supply shocks (e.g. oil price)', 'NAIRU: structural + frictional unemployment; policy cannot reduce below this'],
    },
    {
      heading: 'Fiscal and Monetary Policy',
      body: 'Governments use fiscal policy (spending and taxation) and central banks use monetary policy (interest rates and money supply) to stabilise the economy.',
      bullets: ['Expansionary fiscal: increase G or cut T; multiplier effect', 'Contractionary monetary: raise rates to curb inflation', 'Crowding out: public borrowing may displace private investment'],
    },
  ],
};

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="highlight-keyword">{part}</mark> : part
  );
}

export default function Notes() {
  const { markNoteRead, notesRead } = useStore();
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedNote, setSelectedNote] = useState<NoteConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = selectedSubject === 'All'
    ? notes
    : notes.filter((n) => n.subject === selectedSubject);

  const noteContent = selectedNote ? (SAMPLE_NOTE_CONTENT[selectedNote.id] ?? []) : [];

  const handleSelectNote = useCallback((note: NoteConfig) => {
    setSelectedNote(note);
    markNoteRead(note.id);
  }, [markNoteRead]);

  const filteredContent = searchQuery.trim()
    ? noteContent.filter((section) =>
        section.heading.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.bullets.some((b) => b.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : noteContent;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 flex gap-5" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 bg-md-surface-container rounded-3xl p-5 border border-md-outline-variant self-start sticky top-20">
        <div className="text-md-on-surface-variant text-[10px] tracking-[0.2em] uppercase mb-4 font-medium">
          Notes Library
        </div>

        {/* Subject filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSubject(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 cursor-pointer ${
                selectedSubject === s
                  ? 'bg-md-primary-container text-md-on-primary-container border-md-primary/30'
                  : 'bg-transparent text-md-on-surface-variant border-md-outline-variant hover:bg-md-surface-container-high'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Note list */}
        <div className="flex flex-col gap-1">
          {filteredNotes.map((note) => {
            const isRead = notesRead.includes(note.id);
            const isSelected = selectedNote?.id === note.id;
            return (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`text-left rounded-2xl px-3 py-2.5 w-full cursor-pointer border transition-all duration-200 ${
                  isSelected
                    ? 'bg-md-secondary-container border-md-secondary-container text-md-on-secondary-container'
                    : 'bg-transparent border-transparent text-md-on-surface hover:bg-md-surface-container-high'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isRead && <span className="text-green-400 text-[10px]">✓</span>}
                  <span className={`text-sm ${isSelected ? 'font-semibold' : 'font-normal'}`}>
                    {note.title}
                  </span>
                </div>
                <div className="text-md-on-surface-variant text-[11px] mt-0.5">
                  {note.chapter} · {note.subject}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {selectedNote ? (
          <>
            {/* Note header */}
            <div className="mb-6">
              <div className="text-md-on-surface-variant text-[10px] tracking-[0.2em] uppercase mb-1.5 font-medium">
                {selectedNote.subject} · {selectedNote.chapter}
              </div>
              <h1 className="font-display text-md-on-surface m-0 mb-4" style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)' }}>
                {selectedNote.title}
              </h1>

              {/* Search + download */}
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Search within notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="md-input !w-72 !py-2.5 !text-sm"
                />
                {selectedNote.rawUrl && (
                  <a
                    href={selectedNote.rawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-5 rounded-full text-sm font-medium border no-underline flex items-center border-md-outline-variant text-md-on-surface hover:bg-md-surface-container transition-all duration-200"
                  >
                    ↓ PDF
                  </a>
                )}
              </div>
            </div>

            {/* Table of contents */}
            {noteContent.length > 0 && (
              <div className="bg-md-surface-container rounded-3xl px-6 py-4 border border-md-outline-variant mb-7">
                <div className="text-md-on-surface-variant text-[10px] tracking-[0.2em] uppercase mb-3 font-medium">
                  Contents
                </div>
                <ol className="m-0 pl-4">
                  {noteContent.map((section, i) => (
                    <li
                      key={i}
                      className="text-md-primary text-sm mb-1 cursor-pointer hover:underline"
                      onClick={() => document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      {section.heading}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Sections */}
            {filteredContent.length > 0 ? (
              <div className="flex flex-col gap-5">
                {filteredContent.map((section, i) => (
                  <div
                    key={i}
                    id={`section-${i}`}
                    className="bg-md-surface-container rounded-3xl px-8 py-7 border border-md-outline-variant"
                  >
                    <h2 className="font-display text-md-primary text-xl m-0 mb-3 tracking-tight">
                      {highlightText(section.heading, searchQuery)}
                    </h2>
                    <p className="text-md-on-surface text-sm leading-relaxed mb-4">
                      {highlightText(section.body, searchQuery)}
                    </p>
                    <div className="border-l-2 border-md-primary pl-4">
                      <div className="text-md-on-surface-variant text-[10px] tracking-[0.15em] uppercase mb-2 font-medium">
                        Key Points
                      </div>
                      <ul className="m-0 p-0 list-none">
                        {section.bullets.map((bullet, j) => (
                          <li key={j} className="flex items-start gap-2 mb-1.5">
                            <span className="text-md-primary text-xs mt-0.5 flex-shrink-0">▸</span>
                            <span className="text-md-on-surface-variant text-sm leading-relaxed">
                              {highlightText(bullet, searchQuery)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-md-surface-container rounded-3xl p-12 border border-md-outline-variant text-center">
                <div className="font-display text-md-on-surface text-xl mb-2">
                  No sections match "{searchQuery}"
                </div>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-md-primary text-sm bg-transparent border-none cursor-pointer hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-md-surface-container rounded-3xl p-20 border border-md-outline-variant text-center">
            <div className="text-5xl mb-5">📄</div>
            <h2 className="font-display text-md-on-surface text-2xl mb-2">Select a Note to Study</h2>
            <p className="text-md-on-surface-variant text-sm max-w-md mx-auto">
              Choose from the library on the left. Each note includes a structured summary with key bullet points and a searchable full-text view.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

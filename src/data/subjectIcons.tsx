/* eslint-disable react-refresh/only-export-components */
// Shared subject glyphs. Each subject id maps to a small line icon used on the
// dashboard cards, the globe legend and the mind map nodes. A subject can also
// pin a specific glyph via its `icon` key, which the editor lets users change.

export const IconGlobe  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="1.5"/><path d="M3 12h18M3 8h18M3 16h18" stroke={color} strokeWidth="1.2" opacity=".5"/></svg>);
export const IconChart  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="3" y="12" width="4" height="9" rx="1" fill={color} opacity=".7"/><rect x="10" y="7" width="4" height="14" rx="1" fill={color}/><rect x="17" y="4" width="4" height="17" rx="1" fill={color} opacity=".7"/></svg>);
export const IconTrend  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><polyline points="3,17 8,12 13,15 21,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17,7 21,7 21,11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
export const IconScale  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 4v16M5 20h14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M5 8L2 14h6L5 8z" stroke={color} strokeWidth="1.3" fill={color} opacity=".25" strokeLinejoin="round"/><path d="M19 8l-3 6h6l-3-6z" stroke={color} strokeWidth="1.3" fill={color} opacity=".25" strokeLinejoin="round"/></svg>);
export const IconKana   = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">日</text></svg>);
export const IconHanzi  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><text x="3" y="18" fontFamily="serif" fontSize="16" fill={color} fontWeight="400">中</text></svg>);
export const IconSearch = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="10" cy="10" r="6" stroke={color} strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><path d="M7 10h6M10 7v6" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>);
export const IconBrain  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 4C10 4 8 5.5 8 7.5c0 1-.5 2-1.5 2.5C5.5 10.5 5 11.5 5 12.5c0 2 1.5 3.5 3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/><path d="M12 4c2 0 4 1.5 4 3.5 0 1 .5 2 1.5 2.5 1 .5 1.5 1.5 1.5 2.5 0 2-1.5 3.5-3.5 3.5H12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/><path d="M12 16v4M9 20h6" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>);
export const IconBuild  = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="3" y="8" width="18" height="13" rx="1" stroke={color} strokeWidth="1.5"/><path d="M7 8V5a1 1 0 011-1h8a1 1 0 011 1v3" stroke={color} strokeWidth="1.5"/><rect x="7" y="13" width="3" height="3" rx=".5" stroke={color} strokeWidth="1.2"/><rect x="14" y="13" width="3" height="3" rx=".5" stroke={color} strokeWidth="1.2"/></svg>);
export const IconPencil = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 20l2-6L17 4l4 4L9 20H3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/><path d="M14.5 6.5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>);
export const IconCalc   = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.5"/><rect x="7" y="5" width="10" height="4" rx="1" fill={color} opacity=".25"/><circle cx="8" cy="14" r="1.2" fill={color}/><circle cx="12" cy="14" r="1.2" fill={color}/><circle cx="16" cy="14" r="1.2" fill={color}/><circle cx="8" cy="18" r="1.2" fill={color}/><circle cx="12" cy="18" r="1.2" fill={color}/></svg>);
export const IconOrg    = ({ color }: { color: string }) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="9" y="2" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><rect x="2" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><rect x="9" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><rect x="16" y="17" width="6" height="4" rx="1" stroke={color} strokeWidth="1.4"/><path d="M12 6v4M12 10H5v7M12 10h7v7M12 10v7" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>);

const SubjectIconMap: Record<string, React.FC<{ color: string }>> = {
  'international-trade': IconGlobe,
  marketing:             IconChart,
  finance:               IconTrend,
  economics:             IconScale,
  japanese:              IconKana,
  chinese:               IconHanzi,
  'research-business':   IconSearch,
  'eq-pc':               IconBrain,
  'business-economics':  IconBuild,
  'pre-seminar':         IconPencil,
  'accounting-advanced': IconCalc,
  management:            IconOrg,
};

// Named glyph registry — the set a user can pick from in the subject editor.
const ICON_BY_KEY: Record<string, React.FC<{ color: string }>> = {
  globe: IconGlobe, chart: IconChart, trend: IconTrend, scale: IconScale,
  kana: IconKana, hanzi: IconHanzi, search: IconSearch, brain: IconBrain,
  build: IconBuild, pencil: IconPencil, calc: IconCalc, org: IconOrg,
};

export const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'globe', label: 'Globe' },
  { key: 'chart', label: 'Bars' },
  { key: 'trend', label: 'Trend' },
  { key: 'scale', label: 'Scale' },
  { key: 'kana',  label: 'Kana' },
  { key: 'hanzi', label: 'Hanzi' },
  { key: 'search', label: 'Research' },
  { key: 'brain', label: 'Brain' },
  { key: 'build', label: 'Building' },
  { key: 'pencil', label: 'Pencil' },
  { key: 'calc', label: 'Calculator' },
  { key: 'org', label: 'Org chart' },
];

// Render a glyph by its named key (used by the editor's icon picker).
export function NamedIcon({ iconKey, color }: { iconKey: string; color: string }) {
  const Comp = ICON_BY_KEY[iconKey] ?? IconGlobe;
  return <Comp color={color} />;
}

// Resolve a subject's icon: an explicit `icon` key wins, then the id default,
// then the globe glyph.
export function SubjectIcon({ id, icon, color }: { id: string; icon?: string; color: string }) {
  const Comp = (icon ? ICON_BY_KEY[icon] : undefined) ?? SubjectIconMap[id] ?? IconGlobe;
  return <Comp color={color} />;
}

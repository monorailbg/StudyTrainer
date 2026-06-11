import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const GLOBE_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg';
const GLOBE_DAY   = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg';
const GLOBE_BUMP  = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';

// ── Shared network interface ──────────────────────────────────────────────────
interface SupplyChainNetwork {
  companyId: string;
  companyName: string;
  subtitle: string;
  nodes: Array<{
    id: string; name: string; lat: number; lng: number;
    type: string; color: string; desc: string;
  }>;
  arcs: Array<{
    startLat: number; startLng: number; endLat: number; endLng: number;
    color: string; arcType?: 'rawmaterial' | 'upstream' | 'downstream';
  }>;
}

// ── Internal arc definition (resolved to coordinates at build time) ───────────
interface InternalArcDef {
  from: string; to: string;
  arcType: 'rawmaterial' | 'upstream' | 'downstream';
}

// ── Apple supply chain — full node dataset ────────────────────────────────────
const APPLE_NODES: SupplyChainNetwork['nodes'] = [
  { id: 'tsmc-hsinchu',  name: 'Advanced Silicon (TSMC)',     lat: 24.81, lng: 120.97, type: 'silicon',  color: '#60A5FA', desc: "World's most advanced chip fabrication for Apple Silicon processors." },
  { id: 'tsmc-tainan',   name: 'Leading-Edge Fabs (TSMC)',    lat: 22.99, lng: 120.21, type: 'silicon',  color: '#3B82F6', desc: 'Cutting-edge leading-edge process fabs for A-series chips.' },
  { id: 'samsung-seoul', name: 'OLED & Memory Hub',           lat: 37.57, lng: 126.98, type: 'display',  color: '#A78BFA', desc: 'OLED display panels and DRAM/LPDDR memory for iPhone and iPad.' },
  { id: 'lg-gumi',       name: 'OLED Display (LG)',           lat: 36.12, lng: 128.34, type: 'display',  color: '#8B5CF6', desc: 'ProMotion OLED panels for iPhone Pro and MacBook Pro displays.' },
  { id: 'kioxia-jp',     name: 'NAND Flash (Kioxia)',         lat: 34.97, lng: 136.62, type: 'memory',   color: '#F472B6', desc: 'NAND flash storage for iPhone, iPad, and MacBook.' },
  { id: 'sony-sensors',  name: 'Camera Sensor Labs (Sony)',   lat: 35.44, lng: 139.38, type: 'sensor',   color: '#EC4899', desc: 'Custom camera image sensors for all iPhone camera systems.' },
  { id: 'baotou',        name: 'Rare Earth Mining',           lat: 40.66, lng: 109.82, type: 'rawmat',   color: '#D4A574', desc: 'Primary source of rare earth elements for magnets and electronics.' },
  { id: 'ganzhou',       name: 'Battery Materials',           lat: 25.83, lng: 114.93, type: 'rawmat',   color: '#C9A876', desc: 'Lithium and battery-grade minerals for Apple device batteries.' },
  { id: 'zhengzhou',     name: 'iPhone Assembly (Foxconn)',   lat: 34.75, lng: 113.63, type: 'assembly', color: '#4FB3D9', desc: 'Primary iPhone assembly facility, capacity 300M+ units per year.' },
  { id: 'shenzhen',      name: 'PCB & Electronics Hub',       lat: 22.54, lng: 114.06, type: 'assembly', color: '#6FC4E5', desc: 'PCB fabrication, component integration, and testing hub.' },
  { id: 'chengdu',       name: 'iPad Assembly (Foxconn)',     lat: 30.57, lng: 104.07, type: 'assembly', color: '#8FD5F0', desc: 'iPad and Mac assembly operations.' },
  { id: 'chennai',       name: 'India iPhone Assembly',       lat: 13.08, lng:  80.27, type: 'assembly', color: '#4DCCBD', desc: 'iPhone assembly for Indian market and export, Foxconn and Pegatron.' },
  { id: 'bengaluru',     name: 'India Assembly Hub',          lat: 12.97, lng:  77.59, type: 'assembly', color: '#6DD9CA', desc: 'Secondary India assembly hub and component logistics.' },
  { id: 'bacninh',       name: 'AirPods Assembly (Luxshare)', lat: 21.12, lng: 106.06, type: 'assembly', color: '#8BE6D7', desc: 'AirPods and accessories assembly, Luxshare operations.' },
  { id: 'danang',        name: 'Watch & AirPods (Goertek)',   lat: 16.05, lng: 108.21, type: 'assembly', color: '#A5F0E0', desc: 'Apple Watch and AirPods production, Goertek facility.' },
  { id: 'cupertino',     name: 'Apple HQ',                    lat: 37.33, lng: -122.03, type: 'hq',     color: '#A78BFA', desc: 'Apple world headquarters and global distribution coordination.' },
  { id: 'cork',          name: 'European Operations',         lat: 51.90, lng:   -8.47, type: 'dist',   color: '#C4B5FD', desc: 'European operations center and distribution hub.' },
  { id: 'munich',        name: 'Silicon Design Center',       lat: 48.14, lng:   11.58, type: 'design', color: '#DDD6FE', desc: 'Apple Silicon design center, modem and chip architecture.' },
];

const APPLE_ARC_DEFS: InternalArcDef[] = [
  { from: 'baotou',        to: 'samsung-seoul',  arcType: 'rawmaterial' },
  { from: 'baotou',        to: 'tsmc-hsinchu',   arcType: 'rawmaterial' },
  { from: 'ganzhou',       to: 'shenzhen',       arcType: 'rawmaterial' },
  { from: 'ganzhou',       to: 'zhengzhou',      arcType: 'rawmaterial' },
  { from: 'tsmc-hsinchu',  to: 'zhengzhou',      arcType: 'upstream' },
  { from: 'tsmc-hsinchu',  to: 'shenzhen',       arcType: 'upstream' },
  { from: 'tsmc-tainan',   to: 'zhengzhou',      arcType: 'upstream' },
  { from: 'tsmc-tainan',   to: 'chengdu',        arcType: 'upstream' },
  { from: 'samsung-seoul', to: 'zhengzhou',      arcType: 'upstream' },
  { from: 'samsung-seoul', to: 'shenzhen',       arcType: 'upstream' },
  { from: 'lg-gumi',       to: 'shenzhen',       arcType: 'upstream' },
  { from: 'kioxia-jp',     to: 'zhengzhou',      arcType: 'upstream' },
  { from: 'sony-sensors',  to: 'zhengzhou',      arcType: 'upstream' },
  { from: 'tsmc-hsinchu',  to: 'chennai',        arcType: 'upstream' },
  { from: 'samsung-seoul', to: 'chennai',        arcType: 'upstream' },
  { from: 'shenzhen',      to: 'bacninh',        arcType: 'upstream' },
  { from: 'shenzhen',      to: 'danang',         arcType: 'upstream' },
  { from: 'munich',        to: 'tsmc-hsinchu',   arcType: 'upstream' },
  { from: 'zhengzhou',     to: 'cupertino',      arcType: 'downstream' },
  { from: 'shenzhen',      to: 'cupertino',      arcType: 'downstream' },
  { from: 'chennai',       to: 'cupertino',      arcType: 'downstream' },
  { from: 'zhengzhou',     to: 'cork',           arcType: 'downstream' },
  { from: 'shenzhen',      to: 'cork',           arcType: 'downstream' },
  { from: 'bacninh',       to: 'cupertino',      arcType: 'downstream' },
  { from: 'danang',        to: 'cupertino',      arcType: 'downstream' },
  { from: 'cupertino',     to: 'munich',         arcType: 'downstream' },
];

// ── Nestlé supply chain — complete 16-node dataset ────────────────────────────
const NESTLE_NODES: SupplyChainNetwork['nodes'] = [
  { id: 'nestle-vevey-hq',             name: 'Nestlé Headquarters',        lat:  46.4628, lng:   6.8426, type: 'hq',            color: '#7a5230', desc: 'Global management, procurement strategy, product development.' },
  { id: 'nestle-lausanne-research',     name: 'Nestlé Research',            lat:  46.5197, lng:   6.6323, type: 'research',       color: '#6b4826', desc: 'Largest research center; nutrition, food science, product innovation.' },
  { id: 'nestle-brazil-coffee',         name: 'Coffee Sourcing Network',    lat: -18.5122, lng: -44.5550, type: 'sourcing',       color: '#c8943e', desc: 'Major source of coffee for Nescafé products.' },
  { id: 'nestle-vietnam-coffee',        name: 'Coffee Sourcing Network',    lat:  12.6667, lng: 108.0500, type: 'sourcing',       color: '#c49a3a', desc: "One of Nestlé's largest coffee sourcing regions." },
  { id: 'nestle-cotedivoire-cocoa',     name: 'Cocoa Sourcing Network',     lat:   7.5400, lng:  -5.5471, type: 'sourcing',       color: '#b5844e', desc: 'Largest cocoa source for chocolate products.' },
  { id: 'nestle-ghana-cocoa',           name: 'Cocoa Sourcing Network',     lat:   7.9465, lng:  -1.0232, type: 'sourcing',       color: '#b07840', desc: 'Major cocoa supplier.' },
  { id: 'nestle-indonesia-agri',        name: 'Coffee & Dairy Sourcing',    lat:  -7.5360, lng: 112.2384, type: 'sourcing',       color: '#c08c40', desc: 'Coffee beans and agricultural ingredients.' },
  { id: 'nestle-nz-dairy',              name: 'Dairy Suppliers',            lat: -37.6878, lng: 175.4430, type: 'dairy',          color: '#a07040', desc: 'Milk powder and dairy ingredients.' },
  { id: 'nestle-usa-solon',             name: 'Coffee Production Facilities', lat: 41.3898, lng: -81.4412, type: 'manufacturing', color: '#8c6239', desc: 'Production of coffee brands and products.' },
  { id: 'nestle-usa-glendale',          name: 'Beverage Manufacturing',     lat:  33.5387, lng: -112.1860, type: 'manufacturing', color: '#8c6239', desc: 'Creamers and beverage products.' },
  { id: 'nestle-mexico-toluca',         name: 'Food Manufacturing Hub',     lat:  19.2826, lng:  -99.6557, type: 'manufacturing', color: '#9a7040', desc: 'Food and beverage production for North America.' },
  { id: 'nestle-china-tianjin',         name: 'Manufacturing Hub',          lat:  39.3434, lng:  117.3616, type: 'manufacturing', color: '#9a7040', desc: 'Food and beverage production for China.' },
  { id: 'nestle-india-moga',            name: 'Dairy Collection Network',   lat:  30.8175, lng:   75.1730, type: 'dairy',          color: '#b07840', desc: "One of Nestlé's largest milk procurement centers." },
  { id: 'nestle-india-nanjangud',       name: 'Manufacturing Plant',        lat:  12.1200, lng:   76.6800, type: 'manufacturing', color: '#8c6239', desc: 'Foods, beverages, and confectionery.' },
  { id: 'nestle-germany-biessenhofen',  name: 'Dairy Production',           lat:  47.7667, lng:   10.6333, type: 'manufacturing', color: '#9a7040', desc: 'Milk-based products and ingredients.' },
  { id: 'nestle-france-dieppe',         name: 'Coffee Manufacturing',       lat:  49.9230, lng:    1.0747, type: 'manufacturing', color: '#8c6239', desc: 'Coffee processing and production.' },
];

const NESTLE_ARC_DEFS: InternalArcDef[] = [
  // Raw agricultural sourcing → regional manufacturing
  { from: 'nestle-brazil-coffee',         to: 'nestle-usa-solon',            arcType: 'rawmaterial' },
  { from: 'nestle-brazil-coffee',         to: 'nestle-france-dieppe',        arcType: 'rawmaterial' },
  { from: 'nestle-vietnam-coffee',        to: 'nestle-usa-solon',            arcType: 'rawmaterial' },
  { from: 'nestle-vietnam-coffee',        to: 'nestle-china-tianjin',        arcType: 'rawmaterial' },
  { from: 'nestle-cotedivoire-cocoa',     to: 'nestle-france-dieppe',        arcType: 'rawmaterial' },
  { from: 'nestle-ghana-cocoa',           to: 'nestle-germany-biessenhofen', arcType: 'rawmaterial' },
  { from: 'nestle-indonesia-agri',        to: 'nestle-china-tianjin',        arcType: 'rawmaterial' },
  { from: 'nestle-nz-dairy',             to: 'nestle-china-tianjin',        arcType: 'rawmaterial' },
  { from: 'nestle-nz-dairy',             to: 'nestle-india-moga',           arcType: 'rawmaterial' },
  // Upstream internal logistics
  { from: 'nestle-india-moga',            to: 'nestle-india-nanjangud',      arcType: 'upstream' },
  { from: 'nestle-mexico-toluca',         to: 'nestle-usa-solon',            arcType: 'upstream' },
  { from: 'nestle-germany-biessenhofen',  to: 'nestle-france-dieppe',        arcType: 'upstream' },
  // Strategic: HQ/research → regional plants
  { from: 'nestle-vevey-hq',             to: 'nestle-usa-solon',            arcType: 'downstream' },
  { from: 'nestle-vevey-hq',             to: 'nestle-china-tianjin',        arcType: 'downstream' },
  { from: 'nestle-vevey-hq',             to: 'nestle-germany-biessenhofen', arcType: 'downstream' },
  { from: 'nestle-lausanne-research',     to: 'nestle-mexico-toluca',        arcType: 'downstream' },
  { from: 'nestle-lausanne-research',     to: 'nestle-usa-glendale',         arcType: 'downstream' },
];

// ── Arc color palettes (per company × theme) ──────────────────────────────────
const ARC_COLORS = {
  apple: {
    light: { rawmaterial: '#8B9DC355', upstream: '#5B8DBF77', downstream: '#7BA5D088' },
    dark:  { rawmaterial: '#7DD3C0AA', upstream: '#00E5FFCC', downstream: '#A5F0E0BB' },
  },
  nestle: {
    light: { rawmaterial: '#c8943e66', upstream: '#8c623977', downstream: '#7a523055' },
    dark:  { rawmaterial: '#e6a83388', upstream: '#b5844eAA', downstream: '#8c6239AA' },
  },
} as const;

// ── Arc animation timing (ms) ─────────────────────────────────────────────────
const ARC_TIMING = {
  apple:  { rawmaterial: 12000, upstream: 8000, downstream: 6000 },
  nestle: { rawmaterial: 15000, upstream: 10000, downstream: 7000 },
} as const;

// ── Build a fully-resolved SupplyChainNetwork ─────────────────────────────────
function buildNetwork(
  companyId: 'apple' | 'nestle',
  isLight: boolean,
): SupplyChainNetwork {
  const nodes    = companyId === 'apple' ? APPLE_NODES  : NESTLE_NODES;
  const arcDefs  = companyId === 'apple' ? APPLE_ARC_DEFS : NESTLE_ARC_DEFS;
  const palette  = ARC_COLORS[companyId][isLight ? 'light' : 'dark'];
  const nodeMap  = new Map(nodes.map(n => [n.id, n]));

  const arcs: SupplyChainNetwork['arcs'] = arcDefs.flatMap(def => {
    const src = nodeMap.get(def.from);
    const dst = nodeMap.get(def.to);
    if (!src || !dst) return [];
    return [{
      startLat: src.lat, startLng: src.lng,
      endLat:   dst.lat, endLng:   dst.lng,
      color:    palette[def.arcType] ?? '#64748B55',
      arcType:  def.arcType,
    }];
  });

  const meta = companyId === 'apple'
    ? { companyName: 'Apple Inc.', subtitle: 'Global Hardware Supply Chain' }
    : { companyName: 'Nestlé',     subtitle: 'Global Food & Beverage Supply Matrix' };

  return { companyId, ...meta, nodes, arcs };
}

// ── Camera-distance label opacity ─────────────────────────────────────────────
function updateLabelOpacities(
  globe: { pointOfView: () => { lat: number; lng: number; altitude: number } },
  labelEls: Map<string, HTMLElement>,
  nodes: SupplyChainNetwork['nodes'],
) {
  const pov = globe.pointOfView();
  const camLatR = pov.lat * Math.PI / 180;
  const camLngR = pov.lng * Math.PI / 180;
  const cx = Math.cos(camLatR) * Math.cos(camLngR);
  const cy = Math.cos(camLatR) * Math.sin(camLngR);
  const cz = Math.sin(camLatR);
  for (const node of nodes) {
    const el = labelEls.get(node.id);
    if (!el) continue;
    const latR = node.lat * Math.PI / 180;
    const lngR = node.lng * Math.PI / 180;
    const dot  = cx * Math.cos(latR) * Math.cos(lngR)
               + cy * Math.cos(latR) * Math.sin(lngR)
               + cz * Math.sin(latR);
    // Full opacity near camera center, fade to 0.20 at horizon
    const opacity = dot >= 0.35 ? 0.88
                  : dot <= 0.0  ? 0.20
                  : 0.20 + (dot / 0.35) * 0.68;
    el.style.opacity = opacity.toFixed(2);
  }
}

// ── Pin CSS: glassmorphism labels, calming pulse ──────────────────────────────
const PIN_STYLES = `
  @keyframes gpin-pulse {
    0%   { transform: scale(1);   opacity: 0.4; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @keyframes gpin-glow-pulse {
    0%   { opacity: 0.5;  filter: drop-shadow(0 0 4px currentColor); }
    50%  { opacity: 0.8;  filter: drop-shadow(0 0 8px currentColor); }
    100% { opacity: 0.5;  filter: drop-shadow(0 0 4px currentColor); }
  }

  .gpin-ring {
    position:absolute; inset:0; border-radius:50%;
    animation: gpin-pulse 3.2s ease-out infinite;
  }
  .gpin-ring2 { animation-delay: 1.6s; }
  .gpin-dot {
    position:relative; z-index:2;
    transition: transform 0.2s ease;
  }
  .gpin-wrapper:hover .gpin-dot { transform: scale(1.3); }

  .gpin-label {
    position:absolute; top:-30px; left:50%;
    transform:translateX(-50%);
    white-space:nowrap;
    font-family:'Sora',sans-serif;
    font-size:0.7rem; font-weight:700;
    letter-spacing:0.04em; pointer-events:none;
    padding:1px 6px; border-radius:4px;
    display:flex; align-items:center; gap:3px;
    background:rgba(13,17,23,0.75);
    color:var(--gpin-color);
    border:0.5px solid var(--gpin-border);
    text-shadow:0 0.5px 2px rgba(0,0,0,0.8);
    transition: opacity 0.25s ease;
  }
  .gpin-label-dot {
    width:3px; height:3px; border-radius:50%; flex-shrink:0;
    background:var(--gpin-color);
    box-shadow:0 0 3px var(--gpin-color);
  }

  body.theme-light .gpin-label {
    background:rgba(255,252,247,0.95);
    color:#2C2A25;
    border:0.5px solid rgba(0,0,0,0.08);
    text-shadow:none;
    box-shadow:0 1px 3px rgba(0,0,0,0.10);
  }
  body.theme-light .gpin-label .gpin-label-dot {
    box-shadow:0 0 2px var(--gpin-color);
  }

  body.theme-dark .gpin-label {
    background:rgba(15,23,42,0.60);
    backdrop-filter:blur(4px);
    color:#E8F4F8;
    border:0.5px solid rgba(255,255,255,0.15);
    text-shadow:none;
    box-shadow:0 4px 12px rgba(0,0,0,0.25);
  }
  body.theme-dark .gpin-label .gpin-label-dot {
    box-shadow:0 0 3px var(--gpin-color);
  }

  body.theme-light .gpin-dot {
    box-shadow:0 1px 3px rgba(0,0,0,0.18),0 0 4px var(--gpin-color) !important;
    border-color:rgba(255,255,255,0.5) !important;
  }
  body.theme-dark .gpin-dot {
    box-shadow:0 0 6px var(--gpin-color),0 0 12px var(--gpin-color)44 !important;
    border-color:rgba(255,255,255,0.25) !important;
    animation: gpin-glow-pulse 3s ease-in-out infinite;
  }
`;

function injectPinStyles() {
  if (document.getElementById('gpin-styles')) return;
  const s = document.createElement('style');
  s.id = 'gpin-styles';
  s.textContent = PIN_STYLES;
  document.head.appendChild(s);
}

// ── Dot size by node type ─────────────────────────────────────────────────────
function dotSizeForType(type: string): number {
  if (type === 'hq')                           return 14;
  if (type === 'research')                     return 12;
  if (type === 'assembly' || type === 'manufacturing') return 10;
  if (type === 'silicon'  || type === 'display')       return  9;
  if (type === 'sourcing' || type === 'dairy')         return  8;
  return 7;
}

// ── Company pill toggle ───────────────────────────────────────────────────────
function CompanyToggle({
  active,
  isLight,
  onChange,
}: {
  active: 'apple' | 'nestle';
  isLight: boolean;
  onChange: (id: 'apple' | 'nestle') => void;
}) {
  const companies: Array<{ id: 'apple' | 'nestle'; label: string; color: string }> = [
    { id: 'apple',  label: 'Apple Inc.', color: '#60A5FA' },
    { id: 'nestle', label: 'Nestlé',     color: '#c8943e' },
  ];

  return (
    <div style={{
      position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', gap: '2px', padding: '3px',
      background: isLight ? 'rgba(255,252,247,0.88)' : 'rgba(15,23,42,0.75)',
      backdropFilter: 'blur(8px)',
      borderRadius: '999px',
      border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.13)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
      pointerEvents: 'all',
    }}>
      {companies.map(({ id, label, color }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              padding: '6px 16px', borderRadius: '999px', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              fontFamily: "'Sora', sans-serif", whiteSpace: 'nowrap',
              background: isActive
                ? (isLight ? color + '22' : color + '33')
                : 'transparent',
              color: isActive
                ? (isLight ? color : color)
                : (isLight ? '#888' : '#8B949E'),
              boxShadow: isActive ? `inset 0 0 0 1px ${color}44` : 'none',
              transition: 'all 0.18s ease',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Initial point-of-view per company ────────────────────────────────────────
const INITIAL_POV = {
  apple:  { lat: 28,  lng: 108, altitude: 1.65 },
  nestle: { lat: 20,  lng:  15, altitude: 1.80 },
};

// ── GlobeView ─────────────────────────────────────────────────────────────────
export default function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized  = useRef(false);
  const { theme }    = useTheme();
  const isLight      = theme === 'light';

  const [activeCompanyId, setActiveCompanyId] = useState<'apple' | 'nestle'>('apple');

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    injectPinStyles();

    const el      = containerRef.current;
    const network = buildNetwork(activeCompanyId, isLight);
    const timing  = ARC_TIMING[activeCompanyId as 'apple' | 'nestle'];

    // Label element refs for per-frame opacity fade
    const labelEls = new Map<string, HTMLElement>();

    let cancelled = false;

    import('globe.gl').then(({ default: GlobeModule }) => {
      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Globe = GlobeModule as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globe: any = Globe({ animateIn: true })
        .width(el.clientWidth)
        .height(el.clientHeight)
        .globeImageUrl(isLight ? GLOBE_DAY : GLOBE_NIGHT)
        .bumpImageUrl(GLOBE_BUMP)
        .atmosphereColor(isLight ? '#C4956A' : '#1a3a52')
        .atmosphereAltitude(isLight ? 0.08 : 0.20)
        .backgroundColor('rgba(0,0,0,0)')
        // ── Thin, semi-translucent supply arcs ──────────────────────────────
        .arcsData(network.arcs)
        .arcStartLat((d: any) => d.startLat)
        .arcStartLng((d: any) => d.startLng)
        .arcEndLat((d: any) => d.endLat)
        .arcEndLng((d: any) => d.endLng)
        .arcColor((d: any) => {
          // Gradient from solid to more transparent at arc end for a fade-out tail
          return [d.color, d.color.slice(0, 7) + '44'];
        })
        .arcDashLength(0.35)
        .arcDashGap(0.65)
        .arcDashAnimateTime((d: any) =>
          timing[d.arcType as keyof typeof timing] ?? 10000
        )
        .arcStroke((d: any) => {
          if (d.arcType === 'downstream') return 0.8;
          if (d.arcType === 'upstream')   return 0.7;
          return 0.6;
        })
        .arcAltitude(null)
        .arcAltitudeAutoScale(0.35)
        // ── HTML supply-chain pins ───────────────────────────────────────────
        .htmlElementsData(network.nodes)
        .htmlLat((d: any) => d.lat)
        .htmlLng((d: any) => d.lng)
        .htmlAltitude(0.020)
        .htmlElement((d: any) => {
          const anchor = document.createElement('div');
          anchor.style.cssText = 'position:relative;width:0;height:0;overflow:visible;';

          const dotSize = dotSizeForType(d.type);

          const wrapper = document.createElement('div');
          wrapper.className = 'gpin-wrapper';
          wrapper.style.cssText = [
            `--gpin-color:${d.color}`,
            `--gpin-border:${d.color}44`,
            'pointer-events:all',
            'cursor:pointer',
            'position:absolute',
            'top:0',
            'left:0',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'width:22px',
            'height:22px',
            'transform:translate(-50%,-50%)',
          ].join(';');

          wrapper.innerHTML = `
            <div class="gpin-ring"  style="background:${d.color}33;"></div>
            <div class="gpin-ring gpin-ring2" style="background:${d.color}22;"></div>
            <div class="gpin-dot" style="
              width:${dotSize}px;height:${dotSize}px;border-radius:50%;
              background:${d.color};
              box-shadow:0 0 6px ${d.color}88;
              border:1.5px solid rgba(255,255,255,0.35);
            "></div>
            <div class="gpin-label">
              <span class="gpin-label-dot"></span>
              ${d.name}
            </div>
          `;

          labelEls.set(d.id, wrapper);
          anchor.appendChild(wrapper);
          return anchor;
        });

      globe(el);

      const controls = globe.controls();
      controls.autoRotate      = true;
      controls.autoRotateSpeed = 0.20;
      controls.enableZoom      = false;
      controls.minPolarAngle   = Math.PI / 5;
      controls.maxPolarAngle   = (4 * Math.PI) / 5;

      globe.pointOfView(INITIAL_POV[activeCompanyId as 'apple' | 'nestle']);

      // Camera-distance label opacity: fires on every rotation frame
      controls.addEventListener('change', () =>
        updateLabelOpacities(globe, labelEls, network.nodes)
      );

      const onResize = () => {
        if (containerRef.current) {
          globe.width(containerRef.current.clientWidth);
          globe.height(containerRef.current.clientHeight);
        }
      };
      window.addEventListener('resize', onResize);
      (el as any).__globeCleanup = () => window.removeEventListener('resize', onResize);
    });

    return () => {
      cancelled = true;
      initialized.current = false;
      if ((el as any).__globeCleanup) {
        (el as any).__globeCleanup();
        delete (el as any).__globeCleanup;
      }
      while (el.firstChild) el.removeChild(el.firstChild);
    };
  }, [theme, activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={containerRef}
        className="globe-canvas-container"
        style={{ position: 'absolute', inset: 0 }}
      />
      <CompanyToggle
        active={activeCompanyId}
        isLight={isLight}
        onChange={setActiveCompanyId}
      />
    </div>
  );
}

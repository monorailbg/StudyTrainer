import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SubjectDef } from '../data/subjects';
import { useTheme } from '../context/ThemeContext';

const GLOBE_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg';
const GLOBE_DAY   = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg';
const GLOBE_BUMP  = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';

// ── Dark-mode: subject network arcs ─────────────────────────────────────────
const ARC_PAIRS: [string, string][] = [
  ['international-trade', 'finance'],
  ['international-trade', 'economics'],
  ['international-trade', 'chinese'],
  ['international-trade', 'accounting-advanced'],
  ['finance', 'accounting-advanced'],
  ['finance', 'economics'],
  ['finance', 'management'],
  ['marketing', 'management'],
  ['marketing', 'business-economics'],
  ['japanese', 'chinese'],
  ['research-business', 'pre-seminar'],
  ['eq-pc', 'management'],
  ['economics', 'business-economics'],
  ['japanese', 'international-trade'],
];

// ── Light-mode: Apple supply chain nodes ─────────────────────────────────────
interface SupplyNode {
  id: string;
  label: string;
  role: 'silicon' | 'display' | 'memory' | 'sensor' | 'rawmat' | 'assembly' | 'hq' | 'dist' | 'design';
  color: string;
  lat: number;
  lng: number;
}

const SUPPLY_NODES: SupplyNode[] = [
  // Taiwan — Silicon fabrication
  { id: 'tsmc-hsinchu', label: 'Advanced Silicon (TSMC)',    role: 'silicon',  color: '#60A5FA', lat: 24.81, lng: 120.97 },
  { id: 'tsmc-tainan',  label: 'Leading-Edge Fabs (TSMC)',   role: 'silicon',  color: '#3B82F6', lat: 22.99, lng: 120.21 },
  // South Korea — Display & memory
  { id: 'samsung-seoul', label: 'OLED & Memory Hub',          role: 'display',  color: '#A78BFA', lat: 37.57, lng: 126.98 },
  { id: 'lg-gumi',       label: 'OLED Display (LG)',           role: 'display',  color: '#8B5CF6', lat: 36.12, lng: 128.34 },
  // Japan — Sensors & NAND
  { id: 'kioxia-jp',    label: 'NAND Flash (Kioxia)',          role: 'memory',   color: '#F472B6', lat: 34.97, lng: 136.62 },
  { id: 'sony-sensors', label: 'Camera Sensor Labs (Sony)',    role: 'sensor',   color: '#EC4899', lat: 35.44, lng: 139.38 },
  // China — Raw materials
  { id: 'baotou',       label: 'Rare Earth Mining',            role: 'rawmat',   color: '#F59E0B', lat: 40.66, lng: 109.82 },
  { id: 'ganzhou',      label: 'Battery Materials',            role: 'rawmat',   color: '#F97316', lat: 25.83, lng: 114.93 },
  // China — Final assembly
  { id: 'zhengzhou',    label: 'iPhone Assembly (Foxconn)',    role: 'assembly', color: '#10B981', lat: 34.75, lng: 113.63 },
  { id: 'shenzhen',     label: 'PCB & Electronics Hub',        role: 'assembly', color: '#34D399', lat: 22.54, lng: 114.06 },
  { id: 'chengdu',      label: 'iPad Assembly (Foxconn)',       role: 'assembly', color: '#6EE7B7', lat: 30.57, lng: 104.07 },
  // India — Assembly clusters
  { id: 'chennai',      label: 'India iPhone Assembly',        role: 'assembly', color: '#22D3EE', lat: 13.08, lng:  80.27 },
  { id: 'bengaluru',    label: 'India Assembly Hub',            role: 'assembly', color: '#06B6D4', lat: 12.97, lng:  77.59 },
  // Vietnam — AirPods & Watch
  { id: 'bacninh',      label: 'AirPods Assembly (Luxshare)',  role: 'assembly', color: '#4ADE80', lat: 21.12, lng: 106.06 },
  { id: 'danang',       label: 'Watch & AirPods (Goertek)',    role: 'assembly', color: '#86EFAC', lat: 16.05, lng: 108.21 },
  // Design & distribution
  { id: 'cupertino',    label: 'Apple HQ',                     role: 'hq',       color: '#EF4444', lat: 37.33, lng: -122.03 },
  { id: 'cork',         label: 'European Operations',           role: 'dist',     color: '#F87171', lat: 51.90, lng:   -8.47 },
  { id: 'munich',       label: 'Silicon Design Center',         role: 'design',   color: '#FB923C', lat: 48.14, lng:   11.58 },
];

type SupplyArcType = 'rawmaterial' | 'upstream' | 'downstream';

interface SupplyArcDef { from: string; to: string; type: SupplyArcType; }

const SUPPLY_ARC_DEFS: SupplyArcDef[] = [
  // Raw material → component fabs
  { from: 'baotou',        to: 'samsung-seoul',  type: 'rawmaterial' },
  { from: 'baotou',        to: 'tsmc-hsinchu',   type: 'rawmaterial' },
  { from: 'ganzhou',       to: 'shenzhen',       type: 'rawmaterial' },
  { from: 'ganzhou',       to: 'zhengzhou',      type: 'rawmaterial' },
  // Upstream: Taiwan silicon → China assembly
  { from: 'tsmc-hsinchu',  to: 'zhengzhou',      type: 'upstream' },
  { from: 'tsmc-hsinchu',  to: 'shenzhen',       type: 'upstream' },
  { from: 'tsmc-tainan',   to: 'zhengzhou',      type: 'upstream' },
  { from: 'tsmc-tainan',   to: 'chengdu',        type: 'upstream' },
  // Upstream: South Korea → China assembly
  { from: 'samsung-seoul', to: 'zhengzhou',      type: 'upstream' },
  { from: 'samsung-seoul', to: 'shenzhen',       type: 'upstream' },
  { from: 'lg-gumi',       to: 'shenzhen',       type: 'upstream' },
  // Upstream: Japan → China assembly
  { from: 'kioxia-jp',     to: 'zhengzhou',      type: 'upstream' },
  { from: 'sony-sensors',  to: 'zhengzhou',      type: 'upstream' },
  // Upstream: Taiwan / Korea → India assembly
  { from: 'tsmc-hsinchu',  to: 'chennai',        type: 'upstream' },
  { from: 'samsung-seoul', to: 'chennai',        type: 'upstream' },
  // Upstream: Shenzhen hub → Vietnam lines
  { from: 'shenzhen',      to: 'bacninh',        type: 'upstream' },
  { from: 'shenzhen',      to: 'danang',         type: 'upstream' },
  // Upstream: Munich design spec → TSMC
  { from: 'munich',        to: 'tsmc-hsinchu',   type: 'upstream' },
  // Downstream: final assembly → global distribution
  { from: 'zhengzhou',     to: 'cupertino',      type: 'downstream' },
  { from: 'shenzhen',      to: 'cupertino',      type: 'downstream' },
  { from: 'chennai',       to: 'cupertino',      type: 'downstream' },
  { from: 'zhengzhou',     to: 'cork',           type: 'downstream' },
  { from: 'shenzhen',      to: 'cork',           type: 'downstream' },
  { from: 'bacninh',       to: 'cupertino',      type: 'downstream' },
  { from: 'danang',        to: 'cupertino',      type: 'downstream' },
  // Cupertino ↔ Munich design loop
  { from: 'cupertino',     to: 'munich',         type: 'downstream' },
];

// Vibrant, saturated arc colors — stay legible in both light and dark
const SUPPLY_ARC_COLORS: Record<SupplyArcType, [string, string]> = {
  rawmaterial: ['#F59E0BF2', '#FB923CF2'],
  upstream:    ['#3B82F6F2', '#10B981F2'],
  downstream:  ['#EF4444FF', '#F87171F0'],
};

// Globe-pin styles injected once into <head>.
// CSS custom properties (--gpin-color, --gpin-border) are set on .gpin-wrapper.
// body.theme-light overrides produce solid, high-contrast labels on the cream canvas.
const PIN_STYLES = `
  @keyframes gpin-pulse {
    0%   { transform: scale(1);   opacity: 0.55; }
    100% { transform: scale(3.2); opacity: 0; }
  }
  .gpin-ring {
    position:absolute; inset:0; border-radius:50%;
    animation: gpin-pulse 2.8s ease-out infinite;
  }
  .gpin-ring2 { animation-delay: 1.4s; }
  .gpin-dot {
    position:relative; z-index:2;
    transition: transform 0.2s ease;
  }
  .gpin-wrapper:hover .gpin-dot { transform: scale(1.45); }

  /* ── Label: dark-mode default ── */
  .gpin-label {
    position:absolute; top:-30px; left:50%;
    transform:translateX(-50%);
    white-space:nowrap;
    font-family:'Sora',sans-serif;
    font-size:10px; font-weight:700;
    letter-spacing:0.05em; pointer-events:none;
    padding:2px 8px 2px 6px; border-radius:5px;
    display:flex; align-items:center; gap:5px;
    background:rgba(13,17,23,0.82);
    color:var(--gpin-color);
    border:1px solid var(--gpin-border);
    text-shadow:0 1px 4px rgba(0,0,0,0.9);
    box-shadow:none;
  }
  .gpin-label-dot {
    width:5px; height:5px; border-radius:50%; flex-shrink:0;
    background:var(--gpin-color);
    box-shadow:0 0 5px var(--gpin-color);
  }

  /* ── Label: light-mode — solid off-white, sharp charcoal, explicit border ── */
  body.theme-light .gpin-label {
    background:rgba(255,252,247,1.0);
    color:#1E2028;
    border:1px solid rgba(0,0,0,0.12);
    text-shadow:none;
    box-shadow:0 2px 10px rgba(0,0,0,0.16),0 1px 3px rgba(0,0,0,0.10);
  }
  /* Retain the colored identification dot in light mode */
  body.theme-light .gpin-label .gpin-label-dot {
    box-shadow:0 0 4px var(--gpin-color);
  }

  /* ── Dot: tone down neon glow on bright background ── */
  body.theme-light .gpin-dot {
    box-shadow:0 2px 6px rgba(0,0,0,0.20),0 0 7px var(--gpin-color) !important;
    border-color:rgba(255,255,255,0.65) !important;
  }
`;

function injectPinStyles() {
  if (document.getElementById('gpin-styles')) return;
  const s = document.createElement('style');
  s.id = 'gpin-styles';
  s.textContent = PIN_STYLES;
  document.head.appendChild(s);
}

export default function GlobeView({ subjects }: { subjects: SubjectDef[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    injectPinStyles();

    const el = containerRef.current;
    const isLight = theme === 'light';

    // ── Dark mode: subject network arcs & pins ───────────────────────────────
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const arcs = ARC_PAIRS.flatMap(([a, b]) => {
      const src = subjectMap.get(a);
      const dst = subjectMap.get(b);
      if (!src || !dst || src.lat == null || dst.lat == null) return [];
      return [{
        startLat: src.lat!, startLng: src.lng!,
        endLat:   dst.lat!, endLng:   dst.lng!,
        srcColor: src.color, dstColor: dst.color,
      }];
    });
    const pinSubjects = subjects.filter(s => s.lat != null);

    // ── Light mode: Apple supply chain arcs & pins ───────────────────────────
    const supplyNodeMap = new Map(SUPPLY_NODES.map(n => [n.id, n]));
    const supplyArcs = SUPPLY_ARC_DEFS.map(def => {
      const src = supplyNodeMap.get(def.from);
      const dst = supplyNodeMap.get(def.to);
      if (!src || !dst) return null;
      return {
        startLat: src.lat, startLng: src.lng,
        endLat:   dst.lat, endLng:   dst.lng,
        type:     def.type,
        srcColor: src.color,
        dstColor: dst.color,
      };
    }).filter(Boolean);

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
        .atmosphereColor(isLight ? '#C4956A' : '#5599FF')
        .atmosphereAltitude(isLight ? 0.12 : 0.28)
        .backgroundColor('rgba(0,0,0,0)')
        // ── Arcs ──────────────────────────────────────────────────────────
        .arcsData(isLight ? supplyArcs : arcs)
        .arcStartLat((d: any) => d.startLat)
        .arcStartLng((d: any) => d.startLng)
        .arcEndLat((d: any) => d.endLat)
        .arcEndLng((d: any) => d.endLng)
        .arcColor((d: any) => {
          if (isLight) {
            return SUPPLY_ARC_COLORS[d.type as SupplyArcType] ?? ['#6B7280F0', '#6B7280F0'];
          }
          return [`${d.srcColor}EE`, `${d.dstColor}EE`];
        })
        .arcDashLength(0.42)
        .arcDashGap(0.58)
        .arcDashAnimateTime((d: any) => {
          if (!isLight) return 2400;
          if (d.type === 'downstream') return 1800;
          if (d.type === 'upstream')   return 2500;
          return 3400; // rawmaterial — slower
        })
        .arcStroke((d: any) => {
          if (!isLight) return 0.7;
          if (d.type === 'downstream') return 1.4;
          if (d.type === 'upstream')   return 1.1;
          return 0.8; // rawmaterial
        })
        .arcAltitude(null)
        .arcAltitudeAutoScale(0.4)
        // ── HTML pins ─────────────────────────────────────────────────────
        .htmlElementsData(isLight ? SUPPLY_NODES : pinSubjects)
        .htmlLat((d: any) => d.lat)
        .htmlLng((d: any) => d.lng)
        .htmlAltitude(0.025)
        .htmlElement((d: any) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'gpin-wrapper';

          // Dot size scaled by supply chain role
          const dotSize = isLight
            ? (d.role === 'hq'       ? 19
             : d.role === 'assembly' ? 15
             : d.role === 'silicon' || d.role === 'display' ? 13
             : 11)
            : 15;

          wrapper.style.cssText = [
            `--gpin-color:${d.color}`,
            `--gpin-border:${d.color}55`,
            'pointer-events:all',
            'cursor:pointer',
            'position:relative',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'width:26px',
            'height:26px',
          ].join(';');

          // Label text: supply nodes use d.label; subject pins use d.title
          const labelText = isLight ? d.label : d.title;

          wrapper.innerHTML = `
            <div class="gpin-ring"  style="background:${d.color}44;"></div>
            <div class="gpin-ring gpin-ring2" style="background:${d.color}33;"></div>
            <div class="gpin-dot" style="
              width:${dotSize}px;height:${dotSize}px;border-radius:50%;
              background:${d.color};
              box-shadow:0 0 8px ${d.color},0 0 20px ${d.color}88;
              border:2px solid rgba(255,255,255,0.45);
            "></div>
            <div class="gpin-label">
              <span class="gpin-label-dot"></span>
              ${labelText}
            </div>
          `;

          // Only subject pins navigate; supply nodes are informational
          if (!isLight) {
            wrapper.addEventListener('click', () => {
              navigate(`/subject/${d.id}`);
            });
          }

          return wrapper;
        });

      globe(el);

      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = isLight ? 0.25 : 0.35;
      controls.enableZoom = false;
      controls.minPolarAngle = Math.PI / 5;
      controls.maxPolarAngle = (4 * Math.PI) / 5;

      // Light mode: focus on the East-Asia / Pacific supply chain region.
      // Dark mode: keep Europe/Middle-East so most subject pins are visible on load.
      globe.pointOfView(
        isLight
          ? { lat: 28, lng: 108, altitude: 1.70 }
          : { lat: 22, lng:  30, altitude: 1.75 },
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
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="globe-canvas-container" style={{ position: 'absolute', inset: 0 }} />;
}

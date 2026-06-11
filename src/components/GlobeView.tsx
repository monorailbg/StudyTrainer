import { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const GLOBE_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg';
const GLOBE_DAY   = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg';
const GLOBE_BUMP  = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';


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
  { id: 'baotou',       label: 'Rare Earth Mining',            role: 'rawmat',   color: '#D4A574', lat: 40.66, lng: 109.82 },
  { id: 'ganzhou',      label: 'Battery Materials',            role: 'rawmat',   color: '#C9A876', lat: 25.83, lng: 114.93 },
  // China — Final assembly
  { id: 'zhengzhou',    label: 'iPhone Assembly (Foxconn)',    role: 'assembly', color: '#4FB3D9', lat: 34.75, lng: 113.63 },
  { id: 'shenzhen',     label: 'PCB & Electronics Hub',        role: 'assembly', color: '#6FC4E5', lat: 22.54, lng: 114.06 },
  { id: 'chengdu',      label: 'iPad Assembly (Foxconn)',       role: 'assembly', color: '#8FD5F0', lat: 30.57, lng: 104.07 },
  // India — Assembly clusters
  { id: 'chennai',      label: 'India iPhone Assembly',        role: 'assembly', color: '#4DCCBD', lat: 13.08, lng:  80.27 },
  { id: 'bengaluru',    label: 'India Assembly Hub',            role: 'assembly', color: '#6DD9CA', lat: 12.97, lng:  77.59 },
  // Vietnam — AirPods & Watch
  { id: 'bacninh',      label: 'AirPods Assembly (Luxshare)',  role: 'assembly', color: '#8BE6D7', lat: 21.12, lng: 106.06 },
  { id: 'danang',       label: 'Watch & AirPods (Goertek)',    role: 'assembly', color: '#A5F0E0', lat: 16.05, lng: 108.21 },
  // Design & distribution
  { id: 'cupertino',    label: 'Apple HQ',                     role: 'hq',       color: '#A78BFA', lat: 37.33, lng: -122.03 },
  { id: 'cork',         label: 'European Operations',           role: 'dist',     color: '#C4B5FD', lat: 51.90, lng:   -8.47 },
  { id: 'munich',       label: 'Silicon Design Center',         role: 'design',   color: '#DDD6FE', lat: 48.14, lng:   11.58 },
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
  { from: 'cupertino',     to: 'munich',         type: 'downstream' },
];

// Calming, semi-transparent supply line colors
// Light mode: soft slate blue, muted amber, soft teal
// Dark mode: ethereal neon-cyan, soft lavender, mint green
const SUPPLY_ARC_COLORS_LIGHT: Record<SupplyArcType, [string, string]> = {
  rawmaterial: ['#8B9DC366', '#A0B97F55'],
  upstream:    ['#5B8DBF77', '#4DCCBD66'],
  downstream:  ['#7BA5D088', '#8FD5F077'],
};

const SUPPLY_ARC_COLORS_DARK: Record<SupplyArcType, [string, string]> = {
  rawmaterial: ['#7DD3C0AA', '#9D84B788'],
  upstream:    ['#00E5FFCC', '#7C3AEDAA'],
  downstream:  ['#A5F0E0BB', '#67E8F9BB'],
};

// Globe-pin styles with optimized label sizing and dark-mode glassmorphism
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

  /* ── Label: base styles — reduced size & padding ── */
  .gpin-label {
    position:absolute; top:-32px; left:50%;
    transform:translateX(-50%);
    white-space:nowrap;
    font-family:'Sora',sans-serif;
    font-size:7px; font-weight:700;
    letter-spacing:0.04em; pointer-events:none;
    padding:1px 6px 1px 5px; border-radius:4px;
    display:flex; align-items:center; gap:3px;
    background:rgba(13,17,23,0.75);
    color:var(--gpin-color);
    border:0.5px solid var(--gpin-border);
    text-shadow:0 0.5px 2px rgba(0,0,0,0.8);
    box-shadow:none;
    opacity:0.85;
    transition: opacity 0.3s ease;
  }
  .gpin-label-dot {
    width:3px; height:3px; border-radius:50%; flex-shrink:0;
    background:var(--gpin-color);
    box-shadow:0 0 3px var(--gpin-color);
  }

  /* ── Label: light-mode — crisp micro-border ── */
  body.theme-light .gpin-label {
    background:rgba(255,252,247,0.95);
    color:#2C2A25;
    border:0.5px solid rgba(0,0,0,0.08);
    text-shadow:none;
    box-shadow:0 1px 3px rgba(0,0,0,0.10);
    opacity:0.90;
  }
  body.theme-light .gpin-label .gpin-label-dot {
    box-shadow:0 0 2px var(--gpin-color);
  }

  /* ── Label: dark-mode — glassmorphism with blur ── */
  body.theme-dark .gpin-label {
    background:rgba(15,23,42,0.60);
    backdrop-filter:blur(4px);
    color:#E8F4F8;
    border:0.5px solid rgba(255,255,255,0.15);
    text-shadow:none;
    box-shadow:0 4px 12px rgba(0,0,0,0.25);
    opacity:0.88;
  }
  body.theme-dark .gpin-label .gpin-label-dot {
    box-shadow:0 0 3px var(--gpin-color);
  }

  /* ── Dot: subtle glow, no aggressive neon ── */
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

export default function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const { theme } = useTheme();
  const cameraRef = useRef({ lat: 0, lng: 0, altitude: 2 });

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    injectPinStyles();

    const el = containerRef.current;
    const isLight = theme === 'light';

    // ── Both modes: Apple supply chain arcs & pins ───────────────────────────
    // Coordinate parity: arc endpoints (startLat/startLng, endLat/endLng) and
    // pin positions (htmlLat/htmlLng) both read from the same SUPPLY_NODES objects
    // without any intermediate rounding, ensuring arcs terminate at exact pin centers.
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
        .atmosphereColor(isLight ? '#C4956A' : '#1a3a52')
        .atmosphereAltitude(isLight ? 0.08 : 0.20)
        .backgroundColor('rgba(0,0,0,0)')
        // ── Arcs: thin, elegant, calming ──────────────────────────────────
        .arcsData(supplyArcs)
        .arcStartLat((d: any) => d.startLat)
        .arcStartLng((d: any) => d.startLng)
        .arcEndLat((d: any) => d.endLat)
        .arcEndLng((d: any) => d.endLng)
        .arcColor((d: any) => {
          if (isLight) {
            return SUPPLY_ARC_COLORS_LIGHT[d.type as SupplyArcType] ?? ['#64748B88', '#64748B77'];
          }
          return SUPPLY_ARC_COLORS_DARK[d.type as SupplyArcType] ?? ['#7DD3C088', '#9D84B755'];
        })
        .arcDashLength(0.35)
        .arcDashGap(0.65)
        .arcDashAnimateTime((d: any) => {
          // Dramatically slower animations — contemplative rather than urgent
          if (d.type === 'downstream') return 6000; // ~6 seconds
          if (d.type === 'upstream')   return 8000; // ~8 seconds
          return 12000; // rawmaterial — slow meditation (~12 seconds)
        })
        .arcStroke((d: any) => {
          if (d.type === 'downstream') return 0.8;
          if (d.type === 'upstream')   return 0.7;
          return 0.6; // rawmaterial
        })
        .arcAltitude(null)
        .arcAltitudeAutoScale(0.35)
        // ── HTML pins: supply chain nodes in both modes ──────────────────────
        .htmlElementsData(SUPPLY_NODES)
        .htmlLat((d: any) => d.lat)
        .htmlLng((d: any) => d.lng)
        .htmlAltitude(0.020)
        .htmlElement((d: any) => {
          // Zero-size anchor: globe.gl sets this element's style.transform every frame
          // to position it at the projected coordinate. Keeping it 0×0 gives globe.gl
          // an exact origin with no size ambiguity.
          const anchor = document.createElement('div');
          anchor.style.cssText = 'position:relative;width:0;height:0;overflow:visible;';

          // Dot sizes scaled by supply chain role
          const dotSize = d.role === 'hq'
            ? 14
            : d.role === 'assembly' ? 10
            : d.role === 'silicon' || d.role === 'display' ? 9
            : 7;

          // Inner wrapper: holds dot + label together as one unified node.
          // The inline transform:translate(-50%,-50%) is applied to this child — NOT to
          // the anchor — so globe.gl's per-frame positioning override cannot touch it.
          // Percentage values resolve against wrapper's own 22×22 size, keeping the dot
          // center pinned to the coordinate under all zoom levels and rotation angles.
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
              ${d.label}
            </div>
          `;

          anchor.appendChild(wrapper);
          return anchor;
        });

      globe(el);

      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.20; // Slow, contemplative rotation
      controls.enableZoom = false;
      controls.minPolarAngle = Math.PI / 5;
      controls.maxPolarAngle = (4 * Math.PI) / 5;

      // Track camera position for occlusion opacity
      const onUpdate = () => {
        const pov = globe.pointOfView();
        cameraRef.current = pov;
      };

      // Both modes show supply chain centered on East Asia
      globe.pointOfView({ lat: 28, lng: 108, altitude: 1.65 });

      globe.onUpdate?.(onUpdate);

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

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SubjectDef } from '../data/subjects';
import { useTheme } from '../context/ThemeContext';

const GLOBE_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg';
const GLOBE_DAY   = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg';
const GLOBE_BUMP  = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';

// Arcs that form the "spiderweb" network between subjects
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

// Globe-pin styles injected once into <head>.
// Uses CSS custom properties (--gpin-color, --gpin-border) set on the
// .gpin-wrapper element so both the dot and label can reference them.
// body.theme-light overrides make labels crisp on the cream canvas.
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

  /* ── Label: light-mode override — crisp on cream canvas ── */
  body.theme-light .gpin-label {
    background:rgba(255,252,247,0.97);
    color:#3D3428;
    border:1px solid rgba(0,0,0,0.10);
    text-shadow:none;
    box-shadow:0 2px 8px rgba(0,0,0,0.14),0 1px 3px rgba(0,0,0,0.08);
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
    // Strict-mode guard: only initialise once per dep cycle.
    // Cleanup resets this so theme changes trigger a full re-init.
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    injectPinStyles();

    const el = containerRef.current;
    const isLight = theme === 'light';

    // Build arcs from the pair list
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

    // Only use subjects that have coordinates
    const pinSubjects = subjects.filter(s => s.lat != null);

    // Cancellation flag for the async import — prevents stale init after cleanup
    let cancelled = false;

    import('globe.gl').then(({ default: GlobeModule }) => {
      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Globe = GlobeModule as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globe: any = Globe({ animateIn: true })
        .width(el.clientWidth)
        .height(el.clientHeight)
        // Swap texture: day photo for light mode, night city-lights for dark
        .globeImageUrl(isLight ? GLOBE_DAY : GLOBE_NIGHT)
        .bumpImageUrl(GLOBE_BUMP)
        .atmosphereColor(isLight ? '#C4956A' : '#5599FF')
        .atmosphereAltitude(isLight ? 0.12 : 0.28)
        .backgroundColor('rgba(0,0,0,0)')
        // Arcs
        .arcsData(arcs)
        .arcStartLat((d: any) => d.startLat)
        .arcStartLng((d: any) => d.startLng)
        .arcEndLat((d: any) => d.endLat)
        .arcEndLng((d: any) => d.endLng)
        // Boost arc opacity in light mode so they remain legible on cream
        .arcColor((d: any) => isLight
          ? [`${d.srcColor}EE`, `${d.dstColor}EE`]
          : [`${d.srcColor}CC`, `${d.dstColor}CC`]
        )
        .arcDashLength(0.45)
        .arcDashGap(0.55)
        .arcDashAnimateTime(2400)
        .arcStroke(isLight ? 1.0 : 0.7)
        .arcAltitude(null)
        .arcAltitudeAutoScale(0.4)
        // HTML subject pins
        .htmlElementsData(pinSubjects)
        .htmlLat((d: any) => d.lat)
        .htmlLng((d: any) => d.lng)
        .htmlAltitude(0.025)
        .htmlElement((d: any) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'gpin-wrapper';
          // CSS custom properties on the wrapper let both .gpin-dot and
          // .gpin-label reference the subject color via var(--gpin-color).
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

          wrapper.innerHTML = `
            <div class="gpin-ring"  style="background:${d.color}44;"></div>
            <div class="gpin-ring gpin-ring2" style="background:${d.color}33;"></div>
            <div class="gpin-dot" style="
              width:15px;height:15px;border-radius:50%;
              background:${d.color};
              box-shadow:0 0 8px ${d.color},0 0 20px ${d.color}88;
              border:2px solid rgba(255,255,255,0.45);
            "></div>
            <div class="gpin-label">
              <span class="gpin-label-dot"></span>
              ${d.title}
            </div>
          `;

          wrapper.addEventListener('click', () => {
            navigate(`/subject/${d.id}`);
          });

          return wrapper;
        });

      globe(el);

      // Controls
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableZoom = false;
      controls.minPolarAngle = Math.PI / 5;
      controls.maxPolarAngle = (4 * Math.PI) / 5;

      // Initial camera: centred on Europe/Middle East for maximum pin density on load
      globe.pointOfView({ lat: 22, lng: 30, altitude: 1.75 });

      // Resize
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
      // Mark async init as stale so it won't mount a globe into a cleared container
      cancelled = true;
      // Reset guard so the next effect run (theme change or Strict Mode remount)
      // can initialise a fresh globe instance
      initialized.current = false;
      if ((el as any).__globeCleanup) {
        (el as any).__globeCleanup();
        delete (el as any).__globeCleanup;
      }
      // Clear container so the new globe instance starts with a clean DOM
      while (el.firstChild) el.removeChild(el.firstChild);
    };
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="globe-canvas-container" style={{ position: 'absolute', inset: 0 }} />;
}

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const GLOBE_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg';
const GLOBE_DAY   = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg';
const GLOBE_BUMP  = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';

// ── Shared network interface ──────────────────────────────────────────────────
interface SupplyChainNode {
  id: string; name: string; lat: number; lng: number;
  type: string; color: string; desc: string;
  country: string; url: string;
}

interface SupplyChainNetwork {
  companyId: string;
  companyName: string;
  subtitle: string;
  nodes: SupplyChainNode[];
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
  { id: 'tsmc-hsinchu',  name: 'Advanced Silicon (TSMC)',     lat: 24.81, lng: 120.97, type: 'silicon',  color: '#60A5FA', desc: "World's most advanced chip fabrication for Apple Silicon processors.", country: 'Taiwan',      url: 'https://en.wikipedia.org/wiki/Hsinchu' },
  { id: 'tsmc-tainan',   name: 'Leading-Edge Fabs (TSMC)',    lat: 22.99, lng: 120.21, type: 'silicon',  color: '#3B82F6', desc: 'Cutting-edge leading-edge process fabs for A-series chips.', country: 'Taiwan',      url: 'https://en.wikipedia.org/wiki/Tainan' },
  { id: 'samsung-seoul', name: 'OLED & Memory Hub',           lat: 37.57, lng: 126.98, type: 'display',  color: '#A78BFA', desc: 'OLED display panels and DRAM/LPDDR memory for iPhone and iPad.', country: 'South Korea', url: 'https://en.wikipedia.org/wiki/Seoul' },
  { id: 'lg-gumi',       name: 'OLED Display (LG)',           lat: 36.12, lng: 128.34, type: 'display',  color: '#8B5CF6', desc: 'ProMotion OLED panels for iPhone Pro and MacBook Pro displays.', country: 'South Korea', url: 'https://en.wikipedia.org/wiki/Gumi' },
  { id: 'kioxia-jp',     name: 'NAND Flash (Kioxia)',         lat: 34.97, lng: 136.62, type: 'memory',   color: '#F472B6', desc: 'NAND flash storage for iPhone, iPad, and MacBook.', country: 'Japan',       url: 'https://en.wikipedia.org/wiki/Yokkaichi' },
  { id: 'sony-sensors',  name: 'Camera Sensor Labs (Sony)',   lat: 35.44, lng: 139.38, type: 'sensor',   color: '#EC4899', desc: 'Custom camera image sensors for all iPhone camera systems.', country: 'Japan',       url: 'https://en.wikipedia.org/wiki/Yokohama' },
  { id: 'baotou',        name: 'Rare Earth Mining',           lat: 40.66, lng: 109.82, type: 'rawmat',   color: '#D4A574', desc: 'Primary source of rare earth elements for magnets and electronics.', country: 'China',       url: 'https://en.wikipedia.org/wiki/Baotou' },
  { id: 'ganzhou',       name: 'Battery Materials',           lat: 25.83, lng: 114.93, type: 'rawmat',   color: '#C9A876', desc: 'Lithium and battery-grade minerals for Apple device batteries.', country: 'China',       url: 'https://en.wikipedia.org/wiki/Ganzhou' },
  { id: 'zhengzhou',     name: 'iPhone Assembly (Foxconn)',   lat: 34.75, lng: 113.63, type: 'assembly', color: '#4FB3D9', desc: 'Primary iPhone assembly facility, capacity 300M+ units per year.', country: 'China',       url: 'https://en.wikipedia.org/wiki/Zhengzhou' },
  { id: 'shenzhen',      name: 'PCB & Electronics Hub',       lat: 22.54, lng: 114.06, type: 'assembly', color: '#6FC4E5', desc: 'PCB fabrication, component integration, and testing hub.', country: 'China',       url: 'https://en.wikipedia.org/wiki/Shenzhen' },
  { id: 'chengdu',       name: 'iPad Assembly (Foxconn)',     lat: 30.57, lng: 104.07, type: 'assembly', color: '#8FD5F0', desc: 'iPad and Mac assembly operations.', country: 'China',       url: 'https://en.wikipedia.org/wiki/Chengdu' },
  { id: 'chennai',       name: 'India iPhone Assembly',       lat: 13.08, lng:  80.27, type: 'assembly', color: '#4DCCBD', desc: 'iPhone assembly for Indian market and export, Foxconn and Pegatron.', country: 'India',       url: 'https://en.wikipedia.org/wiki/Chennai' },
  { id: 'bengaluru',     name: 'India Assembly Hub',          lat: 12.97, lng:  77.59, type: 'assembly', color: '#6DD9CA', desc: 'Secondary India assembly hub and component logistics.', country: 'India',       url: 'https://en.wikipedia.org/wiki/Bangalore' },
  { id: 'bacninh',       name: 'AirPods Assembly (Luxshare)', lat: 21.12, lng: 106.06, type: 'assembly', color: '#8BE6D7', desc: 'AirPods and accessories assembly, Luxshare operations.', country: 'Vietnam',     url: 'https://en.wikipedia.org/wiki/B%E1%BA%AFc_Ninh_province' },
  { id: 'danang',        name: 'Watch & AirPods (Goertek)',   lat: 16.05, lng: 108.21, type: 'assembly', color: '#A5F0E0', desc: 'Apple Watch and AirPods production, Goertek facility.', country: 'Vietnam',     url: 'https://en.wikipedia.org/wiki/Da_Nang' },
  { id: 'cupertino',     name: 'Apple HQ',                    lat: 37.33, lng: -122.03, type: 'hq',     color: '#A78BFA', desc: 'Apple world headquarters and global distribution coordination.', country: 'USA',         url: 'https://en.wikipedia.org/wiki/Cupertino,_California' },
  { id: 'cork',          name: 'European Operations',         lat: 51.90, lng:   -8.47, type: 'dist',   color: '#C4B5FD', desc: 'European operations center and distribution hub.', country: 'Ireland',     url: 'https://en.wikipedia.org/wiki/Cork_(city)' },
  { id: 'munich',        name: 'Silicon Design Center',       lat: 48.14, lng:   11.58, type: 'design', color: '#DDD6FE', desc: 'Apple Silicon design center, modem and chip architecture.', country: 'Germany',     url: 'https://en.wikipedia.org/wiki/Munich' },
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
// Color logic mirrors Apple: each functional type gets its own hue family,
// and nodes within the same type share the same hue with slight tonal variation.
//   HQ/Research  → warm amber-gold   (#D97706 / #FBBF24)
//   Coffee src   → earthy green      (#16A34A / #15803D)
//   Cocoa src    → deep chocolate    (#92400E / #78350F)
//   Agri src     → olive             (#A16207)
//   Dairy        → sky blue / cream  (#0EA5E9 / #38BDF8)
//   Mfg Americas → warm coral-orange (#EA580C / #DC4F0B / #C2410C)
//   Mfg Asia     → violet-purple     (#7C3AED / #6D28D9)
//   Mfg Europe   → teal-green        (#0F766E / #0D9488)
const NESTLE_NODES: SupplyChainNetwork['nodes'] = [
  { id: 'nestle-vevey-hq',             name: 'Nestlé Headquarters',          lat:  46.4628, lng:   6.8426, type: 'hq',            color: '#D97706', desc: 'Global management, procurement strategy, product development.', country: 'Switzerland', url: 'https://en.wikipedia.org/wiki/Vevey' },
  { id: 'nestle-lausanne-research',     name: 'Nestlé Research',              lat:  46.5197, lng:   6.6323, type: 'research',       color: '#FBBF24', desc: 'Largest research center; nutrition, food science, product innovation.', country: 'Switzerland', url: 'https://en.wikipedia.org/wiki/Lausanne' },
  { id: 'nestle-brazil-coffee',         name: 'Coffee Sourcing Network',      lat: -18.5122, lng: -44.5550, type: 'sourcing-coffee', color: '#16A34A', desc: 'Major source of coffee for Nescafé products.', country: 'Brazil', url: 'https://en.wikipedia.org/wiki/Minas_Gerais' },
  { id: 'nestle-vietnam-coffee',        name: 'Coffee Sourcing Network',      lat:  12.6667, lng: 108.0500, type: 'sourcing-coffee', color: '#15803D', desc: "One of Nestlé's largest coffee sourcing regions.", country: 'Vietnam', url: 'https://en.wikipedia.org/wiki/Central_Highlands_(Vietnam)' },
  { id: 'nestle-cotedivoire-cocoa',     name: 'Cocoa Sourcing Network',       lat:   7.5400, lng:  -5.5471, type: 'sourcing-cocoa',  color: '#92400E', desc: 'Largest cocoa source for chocolate products.', country: "Côte d'Ivoire", url: 'https://en.wikipedia.org/wiki/Ivory_Coast' },
  { id: 'nestle-ghana-cocoa',           name: 'Cocoa Sourcing Network',       lat:   7.9465, lng:  -1.0232, type: 'sourcing-cocoa',  color: '#78350F', desc: 'Major cocoa supplier.', country: 'Ghana', url: 'https://en.wikipedia.org/wiki/Ghana' },
  { id: 'nestle-indonesia-agri',        name: 'Coffee & Dairy Sourcing',      lat:  -7.5360, lng: 112.2384, type: 'sourcing-agri',   color: '#A16207', desc: 'Coffee beans and agricultural ingredients.', country: 'Indonesia', url: 'https://en.wikipedia.org/wiki/East_Java' },
  { id: 'nestle-nz-dairy',              name: 'Dairy Suppliers',              lat: -37.6878, lng: 175.4430, type: 'dairy',           color: '#0EA5E9', desc: 'Milk powder and dairy ingredients.', country: 'New Zealand', url: 'https://en.wikipedia.org/wiki/Waikato' },
  { id: 'nestle-usa-solon',             name: 'Coffee Production Facilities', lat:  41.3898, lng:  -81.4412, type: 'mfg-americas',  color: '#EA580C', desc: 'Production of coffee brands and products.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Solon,_Ohio' },
  { id: 'nestle-usa-glendale',          name: 'Beverage Manufacturing',       lat:  33.5387, lng: -112.1860, type: 'mfg-americas',  color: '#DC4F0B', desc: 'Creamers and beverage products.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Glendale,_Arizona' },
  { id: 'nestle-mexico-toluca',         name: 'Food Manufacturing Hub',       lat:  19.2826, lng:  -99.6557, type: 'mfg-americas',  color: '#C2410C', desc: 'Food and beverage production for North America.', country: 'Mexico', url: 'https://en.wikipedia.org/wiki/Toluca' },
  { id: 'nestle-china-tianjin',         name: 'Manufacturing Hub',            lat:  39.3434, lng:  117.3616, type: 'mfg-asia',      color: '#7C3AED', desc: 'Food and beverage production for China.', country: 'China', url: 'https://en.wikipedia.org/wiki/Tianjin' },
  { id: 'nestle-india-moga',            name: 'Dairy Collection Network',     lat:  30.8175, lng:   75.1730, type: 'dairy',          color: '#38BDF8', desc: "One of Nestlé's largest milk procurement centers.", country: 'India', url: 'https://en.wikipedia.org/wiki/Moga,_Punjab' },
  { id: 'nestle-india-nanjangud',       name: 'Manufacturing Plant',          lat:  12.1200, lng:   76.6800, type: 'mfg-asia',      color: '#6D28D9', desc: 'Foods, beverages, and confectionery.', country: 'India', url: 'https://en.wikipedia.org/wiki/Nanjangud' },
  { id: 'nestle-germany-biessenhofen',  name: 'Dairy Production',             lat:  47.7667, lng:   10.6333, type: 'mfg-europe',    color: '#0F766E', desc: 'Milk-based products and ingredients.', country: 'Germany', url: 'https://en.wikipedia.org/wiki/Biessenhofen' },
  { id: 'nestle-france-dieppe',         name: 'Coffee Manufacturing',         lat:  49.9230, lng:    1.0747, type: 'mfg-europe',    color: '#0D9488', desc: 'Coffee processing and production.', country: 'France', url: 'https://en.wikipedia.org/wiki/Dieppe,_Seine-Maritime' },
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

// ── Walmart supply chain — 30-node dataset ───────────────────────────────────
// Color logic: Walmart signature retail blue (#0071dc) family.
//   HQ / US core          → Walmart blue     #0071dc / #1565c0
//   US ports              → sky blue         #0288d1 / #039be5
//   US inland dist        → mid-blue         #0277bd
//   China mfg             → steel blue       #4a90d9 / #5b9de0 / #6aaae7 / #79b7ee / #88c4f5
//   Vietnam alt mfg       → teal-cyan        #00acc1 / #00b8cc / #00c4d8
//   India sourcing        → indigo-violet    #5c6bc0 / #7986cb / #9fa8da
//   Bangladesh apparel    → rose-coral       #e57373 / #ef9a9a
//   Cambodia apparel      → mauve            #ba68c8
//   Mexico nearshore      → cyan-teal        #26c6da / #29d6ea / #2ce6fa
//   Canada dist           → dark navy        #1a4fa0
//   S. America agri       → leaf green       #4caf50 / #66bb6a / #81c784
//   South Africa          → amber-gold       #ffa726
//   Thailand / Indonesia  → orchid / sienna  #ab47bc / #8d6e63

const WALMART_NODES: SupplyChainNetwork['nodes'] = [
  // ── United States ────────────────────────────────────────────────────────
  { id: 'wmt-bentonville',  name: 'Walmart HQ',              lat:  36.3729, lng:  -94.2088, type: 'hq',       color: '#0071dc', desc: 'Global headquarters, supply chain management, sourcing strategy.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Bentonville,_Arkansas' },
  { id: 'wmt-dallas',       name: 'Dallas–Fort Worth Hub',   lat:  32.7767, lng:  -96.7970, type: 'dist',     color: '#0277bd', desc: 'Major distribution and logistics hub for the central US.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Dallas%E2%80%93Fort_Worth_metroplex' },
  { id: 'wmt-los-angeles',  name: 'Los Angeles Gateway',     lat:  34.0522, lng: -118.2437, type: 'port',     color: '#0288d1', desc: 'Main import gateway for Asian goods entering the US.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Los_Angeles' },
  { id: 'wmt-long-beach',   name: 'Long Beach Port',         lat:  33.7701, lng: -118.1937, type: 'port',     color: '#039be5', desc: 'Major container port receiving bulk Asian imports.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Port_of_Long_Beach' },
  { id: 'wmt-savannah',     name: 'Savannah Gateway',        lat:  32.0809, lng:  -81.0912, type: 'port',     color: '#0288d1', desc: 'Key East Coast logistics and distribution gateway.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Port_of_Savannah' },
  { id: 'wmt-houston',      name: 'Houston Logistics Hub',   lat:  29.7604, lng:  -95.3698, type: 'dist',     color: '#0277bd', desc: 'Gulf Coast logistics, import hub, and agricultural receiving center.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Port_of_Houston' },
  // ── China ────────────────────────────────────────────────────────────────
  { id: 'wmt-shenzhen',     name: 'Shenzhen Sourcing',       lat:  22.5431, lng:  114.0579, type: 'mfg',      color: '#4a90d9', desc: 'Largest sourcing hub for electronics, toys, and household goods.', country: 'China', url: 'https://en.wikipedia.org/wiki/Shenzhen' },
  { id: 'wmt-dongguan',     name: 'Dongguan Manufacturing',  lat:  23.0210, lng:  113.7518, type: 'mfg',      color: '#5b9de0', desc: 'Manufacturing and export production center.', country: 'China', url: 'https://en.wikipedia.org/wiki/Dongguan' },
  { id: 'wmt-guangzhou',    name: 'Guangzhou Goods Hub',     lat:  23.1291, lng:  113.2644, type: 'mfg',      color: '#6aaae7', desc: 'Consumer goods manufacturing and export coordination.', country: 'China', url: 'https://en.wikipedia.org/wiki/Guangzhou' },
  { id: 'wmt-shanghai',     name: 'Shanghai Sourcing Office',lat:  31.2304, lng:  121.4737, type: 'mfg',      color: '#79b7ee', desc: 'Major sourcing office and primary export gateway.', country: 'China', url: 'https://en.wikipedia.org/wiki/Shanghai' },
  { id: 'wmt-ningbo',       name: 'Ningbo Shipping Hub',     lat:  29.8683, lng:  121.5440, type: 'mfg',      color: '#88c4f5', desc: 'High-volume manufacturing and container shipping hub.', country: 'China', url: 'https://en.wikipedia.org/wiki/Ningbo' },
  // ── Vietnam ──────────────────────────────────────────────────────────────
  { id: 'wmt-hcmc',         name: 'Ho Chi Minh City Mfg',   lat:  10.8231, lng:  106.6297, type: 'mfg',      color: '#00acc1', desc: 'Major alternative manufacturing hub to China.', country: 'Vietnam', url: 'https://en.wikipedia.org/wiki/Ho_Chi_Minh_City' },
  { id: 'wmt-haiphong',     name: 'Hai Phong Export Port',   lat:  20.8449, lng:  106.6881, type: 'port',     color: '#00b8cc', desc: 'Export manufacturing and primary shipping port.', country: 'Vietnam', url: 'https://en.wikipedia.org/wiki/Haiphong' },
  { id: 'wmt-hanoi',        name: 'Hanoi Supplier Mgmt',     lat:  21.0285, lng:  105.8542, type: 'mfg',      color: '#00c4d8', desc: 'Supplier management and northern Vietnam manufacturing.', country: 'Vietnam', url: 'https://en.wikipedia.org/wiki/Hanoi' },
  // ── India ────────────────────────────────────────────────────────────────
  { id: 'wmt-bengaluru',    name: 'Bengaluru Sourcing Ctr',  lat:  12.9716, lng:   77.5946, type: 'mfg',      color: '#5c6bc0', desc: 'Major sourcing office and supplier development center.', country: 'India', url: 'https://en.wikipedia.org/wiki/Bangalore' },
  { id: 'wmt-delhi',        name: 'Delhi NCR Sourcing',      lat:  28.6139, lng:   77.2090, type: 'mfg',      color: '#7986cb', desc: 'Textiles and consumer goods sourcing for global stores.', country: 'India', url: 'https://en.wikipedia.org/wiki/National_Capital_Region_(India)' },
  { id: 'wmt-mumbai',       name: 'Mumbai Export Coord.',    lat:  19.0760, lng:   72.8777, type: 'port',     color: '#9fa8da', desc: 'Export coordination and supplier logistics gateway.', country: 'India', url: 'https://en.wikipedia.org/wiki/Mumbai' },
  // ── Bangladesh ───────────────────────────────────────────────────────────
  { id: 'wmt-dhaka',        name: 'Dhaka Apparel Mfg',       lat:  23.8103, lng:   90.4125, type: 'mfg',      color: '#e57373', desc: 'Large-scale apparel manufacturing for Walmart private labels.', country: 'Bangladesh', url: 'https://en.wikipedia.org/wiki/Dhaka' },
  { id: 'wmt-chattogram',   name: 'Chattogram Garment Port', lat:  22.3569, lng:   91.7832, type: 'port',     color: '#ef9a9a', desc: 'Garment exports and primary sea logistics gateway.', country: 'Bangladesh', url: 'https://en.wikipedia.org/wiki/Chittagong' },
  // ── Cambodia ─────────────────────────────────────────────────────────────
  { id: 'wmt-phnom-penh',   name: 'Phnom Penh Apparel',      lat:  11.5564, lng:  104.9282, type: 'mfg',      color: '#ba68c8', desc: 'Apparel manufacturing, growing alternative to Bangladesh.', country: 'Cambodia', url: 'https://en.wikipedia.org/wiki/Phnom_Penh' },
  // ── Mexico ───────────────────────────────────────────────────────────────
  { id: 'wmt-monterrey',    name: 'Monterrey Nearshore',      lat:  25.6866, lng: -100.3161, type: 'mfg',      color: '#26c6da', desc: 'Nearshoring manufacturing hub serving US stores directly.', country: 'Mexico', url: 'https://en.wikipedia.org/wiki/Monterrey' },
  { id: 'wmt-guadalajara',  name: 'Guadalajara Mfg',          lat:  20.6597, lng: -103.3496, type: 'mfg',      color: '#29d6ea', desc: 'Consumer goods and electronics manufacturing.', country: 'Mexico', url: 'https://en.wikipedia.org/wiki/Guadalajara' },
  { id: 'wmt-mexico-city',  name: 'Mexico City Dist.',        lat:  19.4326, lng:  -99.1332, type: 'dist',     color: '#2ce6fa', desc: 'Distribution and supplier coordination for Latin America.', country: 'Mexico', url: 'https://en.wikipedia.org/wiki/Mexico_City' },
  // ── Canada ───────────────────────────────────────────────────────────────
  { id: 'wmt-mississauga',  name: 'Mississauga Canadian Ops', lat:  43.5890, lng:  -79.6441, type: 'dist',     color: '#1a4fa0', desc: 'Canadian distribution operations center.', country: 'Canada', url: 'https://en.wikipedia.org/wiki/Mississauga' },
  // ── South America (agricultural) ─────────────────────────────────────────
  { id: 'wmt-santiago',     name: 'Santiago Produce Hub',     lat: -33.4489, lng:  -70.6693, type: 'agri',     color: '#4caf50', desc: 'Fruit, produce, and fresh seafood sourcing for US stores.', country: 'Chile', url: 'https://en.wikipedia.org/wiki/Santiago' },
  { id: 'wmt-lima',         name: 'Lima Fresh Produce',       lat: -12.0464, lng:  -77.0428, type: 'agri',     color: '#66bb6a', desc: 'Fresh produce, asparagus, and agricultural goods sourcing.', country: 'Peru', url: 'https://en.wikipedia.org/wiki/Lima' },
  { id: 'wmt-san-jose',     name: 'San José Agri Exports',    lat:   9.9281, lng:  -84.0907, type: 'agri',     color: '#81c784', desc: 'Pineapples, bananas, and tropical agricultural exports.', country: 'Costa Rica', url: 'https://en.wikipedia.org/wiki/San_Jos%C3%A9,_Costa_Rica' },
  // ── South Africa ─────────────────────────────────────────────────────────
  { id: 'wmt-johannesburg', name: 'Johannesburg Retail Hub',  lat: -26.2041, lng:   28.0473, type: 'dist',     color: '#ffa726', desc: 'African distribution and retail operations hub.', country: 'South Africa', url: 'https://en.wikipedia.org/wiki/Johannesburg' },
  // ── Thailand ─────────────────────────────────────────────────────────────
  { id: 'wmt-bangkok',      name: 'Bangkok Goods Mfg',        lat:  13.7563, lng:  100.5018, type: 'mfg',      color: '#ab47bc', desc: 'Consumer goods and home-goods manufacturing.', country: 'Thailand', url: 'https://en.wikipedia.org/wiki/Bangkok' },
  // ── Indonesia ────────────────────────────────────────────────────────────
  { id: 'wmt-jakarta',      name: 'Jakarta Apparel Sourcing', lat:  -6.2088, lng:  106.8456, type: 'mfg',      color: '#8d6e63', desc: 'Apparel and consumer goods sourcing hub.', country: 'Indonesia', url: 'https://en.wikipedia.org/wiki/Jakarta' },
];

const WALMART_ARC_DEFS: InternalArcDef[] = [
  // Upstream: regional Chinese factories → Shenzhen / Shanghai export hubs
  { from: 'wmt-dongguan',    to: 'wmt-shenzhen',    arcType: 'upstream' },
  { from: 'wmt-guangzhou',   to: 'wmt-shenzhen',    arcType: 'upstream' },
  { from: 'wmt-bangkok',     to: 'wmt-shenzhen',    arcType: 'upstream' },
  { from: 'wmt-jakarta',     to: 'wmt-shenzhen',    arcType: 'upstream' },
  { from: 'wmt-phnom-penh',  to: 'wmt-hcmc',        arcType: 'upstream' },
  { from: 'wmt-hanoi',       to: 'wmt-haiphong',    arcType: 'upstream' },
  { from: 'wmt-dhaka',       to: 'wmt-chattogram',  arcType: 'upstream' },
  { from: 'wmt-delhi',       to: 'wmt-mumbai',      arcType: 'upstream' },
  { from: 'wmt-bengaluru',   to: 'wmt-mumbai',      arcType: 'upstream' },
  { from: 'wmt-guadalajara', to: 'wmt-monterrey',   arcType: 'upstream' },
  { from: 'wmt-mexico-city', to: 'wmt-monterrey',   arcType: 'upstream' },
  // Raw agricultural sourcing → US Gulf / East Coast hubs
  { from: 'wmt-santiago',    to: 'wmt-houston',     arcType: 'rawmaterial' },
  { from: 'wmt-lima',        to: 'wmt-houston',     arcType: 'rawmaterial' },
  { from: 'wmt-san-jose',    to: 'wmt-houston',     arcType: 'rawmaterial' },
  { from: 'wmt-san-jose',    to: 'wmt-savannah',    arcType: 'rawmaterial' },
  { from: 'wmt-johannesburg',to: 'wmt-savannah',    arcType: 'rawmaterial' },
  // Downstream: Asian port hubs → US West Coast entry points
  { from: 'wmt-shenzhen',    to: 'wmt-long-beach',  arcType: 'downstream' },
  { from: 'wmt-shenzhen',    to: 'wmt-los-angeles', arcType: 'downstream' },
  { from: 'wmt-ningbo',      to: 'wmt-long-beach',  arcType: 'downstream' },
  { from: 'wmt-shanghai',    to: 'wmt-long-beach',  arcType: 'downstream' },
  { from: 'wmt-haiphong',    to: 'wmt-los-angeles', arcType: 'downstream' },
  { from: 'wmt-chattogram',  to: 'wmt-long-beach',  arcType: 'downstream' },
  { from: 'wmt-hcmc',        to: 'wmt-los-angeles', arcType: 'downstream' },
  { from: 'wmt-mumbai',      to: 'wmt-savannah',    arcType: 'downstream' },
  // Downstream: US ports + nearshore → Dallas distribution hub
  { from: 'wmt-long-beach',  to: 'wmt-dallas',      arcType: 'downstream' },
  { from: 'wmt-los-angeles', to: 'wmt-dallas',      arcType: 'downstream' },
  { from: 'wmt-savannah',    to: 'wmt-dallas',      arcType: 'downstream' },
  { from: 'wmt-houston',     to: 'wmt-dallas',      arcType: 'downstream' },
  { from: 'wmt-monterrey',   to: 'wmt-dallas',      arcType: 'downstream' },
  // Downstream: regional hubs → Bentonville HQ
  { from: 'wmt-dallas',      to: 'wmt-bentonville', arcType: 'downstream' },
  { from: 'wmt-mississauga', to: 'wmt-bentonville', arcType: 'downstream' },
];

// ── Johnson & Johnson supply chain — 14-node dataset ─────────────────────────
// Color logic: each functional type gets its own hue family.
//   HQ                    → crimson red     #DC2626
//   Distribution (NJ)     → rose            #E11D48
//   Pharma mfg USA (NJ/PA)→ coral-orange    #EA580C / #F97316
//   Pharma mfg Europe     → medical teal/blue #0891B2 / #0E7490 / #06B6D4 / #2563EB
//   Vaccine lab (NL)      → emerald         #059669
//   Pharma mfg Puerto Rico→ amber           #D97706 / #CA8A04
//   Pharma mfg Asia       → violet          #7C3AED / #9333EA
//   API sourcing (India)  → green           #16A34A
const JNJ_NODES: SupplyChainNetwork['nodes'] = [
  { id: 'jnj-new-brunswick-hq', name: 'J&J Headquarters',              lat:  40.4934, lng:  -74.4447, type: 'hq',          color: '#DC2626', desc: 'Global management, R&D, supply-chain oversight.', country: 'USA', url: 'https://en.wikipedia.org/wiki/New_Brunswick,_New_Jersey' },
  { id: 'jnj-raritan-dist',     name: 'J&J Distribution Network',      lat:  40.5695, lng:  -74.6343, type: 'dist',         color: '#E11D48', desc: 'Major pharmaceutical distribution hub.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Raritan,_New_Jersey' },
  { id: 'jnj-titusville',       name: 'Janssen Operations',             lat:  40.3168, lng:  -74.8818, type: 'pharma-usa',  color: '#EA580C', desc: 'Pharmaceutical manufacturing and commercialization.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Titusville,_New_Jersey' },
  { id: 'jnj-horsham',          name: 'Janssen Biotech',                lat:  40.1779, lng:  -75.1235, type: 'pharma-usa',  color: '#F97316', desc: 'Drug development and operations.', country: 'USA', url: 'https://en.wikipedia.org/wiki/Horsham,_Pennsylvania' },
  { id: 'jnj-beerse',           name: 'Janssen Pharmaceuticals',        lat:  51.3194, lng:    4.8561, type: 'pharma-eu',   color: '#0891B2', desc: "One of J&J's most important pharmaceutical manufacturing and R&D sites.", country: 'Belgium', url: 'https://en.wikipedia.org/wiki/Beerse' },
  { id: 'jnj-cork',             name: 'J&J Manufacturing',              lat:  51.8985, lng:   -8.4756, type: 'pharma-eu',   color: '#0E7490', desc: 'Pharmaceutical production for global markets.', country: 'Ireland', url: 'https://en.wikipedia.org/wiki/Cork_(city)' },
  { id: 'jnj-ringaskiddy',      name: 'Janssen Sciences Ireland',       lat:  51.8315, lng:   -8.3075, type: 'pharma-eu',   color: '#06B6D4', desc: 'Biologics and pharmaceutical manufacturing.', country: 'Ireland', url: 'https://en.wikipedia.org/wiki/Ringaskiddy' },
  { id: 'jnj-schaffhausen',     name: 'Cilag AG',                       lat:  47.6959, lng:    8.6380, type: 'pharma-eu',   color: '#2563EB', desc: 'Pharmaceutical manufacturing and packaging.', country: 'Switzerland', url: 'https://en.wikipedia.org/wiki/Schaffhausen' },
  { id: 'jnj-leiden',           name: 'Janssen Vaccines',               lat:  52.1601, lng:    4.4970, type: 'vaccine',     color: '#059669', desc: 'Vaccine development and manufacturing.', country: 'Netherlands', url: 'https://en.wikipedia.org/wiki/Leiden' },
  { id: 'jnj-gurabo',           name: 'J&J Manufacturing',              lat:  18.2544, lng:  -65.9729, type: 'pharma-pr',   color: '#D97706', desc: 'High-volume pharmaceutical production.', country: 'Puerto Rico', url: 'https://en.wikipedia.org/wiki/Gurabo,_Puerto_Rico' },
  { id: 'jnj-manati',           name: 'Janssen Manufacturing',          lat:  18.4275, lng:  -66.4741, type: 'pharma-pr',   color: '#CA8A04', desc: 'Pharmaceutical manufacturing and packaging.', country: 'Puerto Rico', url: 'https://en.wikipedia.org/wiki/Manat%C3%AD,_Puerto_Rico' },
  { id: 'jnj-singapore',        name: 'Janssen Supply Chain',           lat:   1.3236, lng:  103.6441, type: 'pharma-asia', color: '#7C3AED', desc: 'Biologics and pharmaceutical production.', country: 'Singapore', url: 'https://en.wikipedia.org/wiki/Tuas' },
  { id: 'jnj-xian',             name: 'J&J Manufacturing',              lat:  34.3416, lng:  108.9398, type: 'pharma-asia', color: '#9333EA', desc: 'Pharmaceutical manufacturing for Asia.', country: 'China', url: 'https://en.wikipedia.org/wiki/Xi%27an' },
  { id: 'jnj-hyderabad',        name: 'API Suppliers',                  lat:  17.3850, lng:   78.4867, type: 'api',         color: '#16A34A', desc: 'Active pharmaceutical ingredients and contract manufacturing.', country: 'India', url: 'https://en.wikipedia.org/wiki/Hyderabad' },
];

const JNJ_ARC_DEFS: InternalArcDef[] = [
  // Raw API sourcing → manufacturing sites
  { from: 'jnj-hyderabad',        to: 'jnj-beerse',           arcType: 'rawmaterial' },
  { from: 'jnj-hyderabad',        to: 'jnj-cork',             arcType: 'rawmaterial' },
  { from: 'jnj-hyderabad',        to: 'jnj-gurabo',           arcType: 'rawmaterial' },
  // Vaccine / biologics labs → manufacturing hubs
  { from: 'jnj-leiden',           to: 'jnj-cork',             arcType: 'upstream' },
  { from: 'jnj-leiden',           to: 'jnj-raritan-dist',     arcType: 'upstream' },
  { from: 'jnj-singapore',        to: 'jnj-gurabo',           arcType: 'upstream' },
  // EU internal manufacturing flows
  { from: 'jnj-beerse',           to: 'jnj-titusville',       arcType: 'upstream' },
  { from: 'jnj-beerse',           to: 'jnj-schaffhausen',     arcType: 'upstream' },
  { from: 'jnj-ringaskiddy',      to: 'jnj-cork',             arcType: 'upstream' },
  // Manufacturing → distribution (downstream)
  { from: 'jnj-gurabo',           to: 'jnj-raritan-dist',     arcType: 'downstream' },
  { from: 'jnj-manati',           to: 'jnj-raritan-dist',     arcType: 'downstream' },
  { from: 'jnj-cork',             to: 'jnj-raritan-dist',     arcType: 'downstream' },
  { from: 'jnj-titusville',       to: 'jnj-raritan-dist',     arcType: 'downstream' },
  { from: 'jnj-horsham',          to: 'jnj-raritan-dist',     arcType: 'downstream' },
  { from: 'jnj-xian',             to: 'jnj-raritan-dist',     arcType: 'downstream' },
  // Strategic: HQ → key global sites
  { from: 'jnj-new-brunswick-hq', to: 'jnj-beerse',           arcType: 'downstream' },
  { from: 'jnj-new-brunswick-hq', to: 'jnj-singapore',        arcType: 'downstream' },
  { from: 'jnj-new-brunswick-hq', to: 'jnj-leiden',           arcType: 'downstream' },
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
  jnj: {
    light: { rawmaterial: '#F4748855', upstream: '#12708277', downstream: '#DC262666' },
    dark:  { rawmaterial: '#FB718888', upstream: '#22D3EECC', downstream: '#F87171BB' },
  },
  walmart: {
    light: { rawmaterial: '#4caf5066', upstream: '#0288d177', downstream: '#0071dc88' },
    dark:  { rawmaterial: '#81c78499', upstream: '#29b6f6BB', downstream: '#40c4ffCC' },
  },
} as const;

// ── Arc animation timing (ms) ─────────────────────────────────────────────────
const ARC_TIMING = {
  apple:   { rawmaterial: 12000, upstream:  8000, downstream:  6000 },
  nestle:  { rawmaterial: 15000, upstream: 10000, downstream:  7000 },
  jnj:     { rawmaterial: 13000, upstream:  9000, downstream:  6500 },
  walmart: { rawmaterial: 14000, upstream:  9500, downstream:  6000 },
} as const;

// ── Company lookup tables ─────────────────────────────────────────────────────
type CompanyId = 'apple' | 'nestle' | 'jnj' | 'walmart';

const COMPANY_META: Record<CompanyId, { companyName: string; subtitle: string }> = {
  apple:   { companyName: 'Apple Inc.',        subtitle: 'Global Hardware Supply Chain' },
  nestle:  { companyName: 'Nestlé',            subtitle: 'Global Food & Beverage Supply Matrix' },
  jnj:     { companyName: 'Johnson & Johnson', subtitle: 'Global Pharmaceutical Supply Network' },
  walmart: { companyName: 'Walmart',           subtitle: 'Global Retail Supply Network' },
};

const COMPANY_NODES: Record<CompanyId, SupplyChainNetwork['nodes']> = {
  apple:   APPLE_NODES,
  nestle:  NESTLE_NODES,
  jnj:     JNJ_NODES,
  walmart: WALMART_NODES,
};

const COMPANY_ARC_DEFS: Record<CompanyId, InternalArcDef[]> = {
  apple:   APPLE_ARC_DEFS,
  nestle:  NESTLE_ARC_DEFS,
  jnj:     JNJ_ARC_DEFS,
  walmart: WALMART_ARC_DEFS,
};

// ── Build a fully-resolved SupplyChainNetwork ─────────────────────────────────
function buildNetwork(companyId: CompanyId, isLight: boolean): SupplyChainNetwork {
  const nodes   = COMPANY_NODES[companyId];
  const arcDefs = COMPANY_ARC_DEFS[companyId];
  const palette = ARC_COLORS[companyId][isLight ? 'light' : 'dark'];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

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

  return { companyId, ...COMPANY_META[companyId], nodes, arcs };
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

  @keyframes ginfo-in {
    from { opacity: 0; transform: translate(-50%, 10px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  .ginfo-panel {
    animation: ginfo-in 0.2s ease-out;
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
  if (type === 'hq')                                              return 14;
  if (type === 'research' || type === 'vaccine')                  return 12;
  if (type === 'assembly' || type.startsWith('mfg-') ||
      type.startsWith('pharma-'))                                  return 10;
  if (type === 'dist' || type === 'port')                         return 10;
  if (type === 'silicon'  || type === 'display')                  return  9;
  if (type === 'mfg')                                             return  9;
  if (type === 'dairy'    || type.startsWith('sourcing') ||
      type === 'api'      || type === 'agri')                     return  8;
  return 7;
}

// ── Initial point-of-view per company ────────────────────────────────────────
const INITIAL_POV: Record<CompanyId, { lat: number; lng: number; altitude: number }> = {
  apple:   { lat:  28, lng:  108, altitude: 1.65 },
  nestle:  { lat:  20, lng:   15, altitude: 1.80 },
  jnj:     { lat:  38, lng:  -50, altitude: 1.75 },
  walmart: { lat:  25, lng:  -40, altitude: 1.70 },
};

// ── GlobeView ─────────────────────────────────────────────────────────────────
export default function GlobeView({
  activeCompanyId = 'apple',
}: {
  activeCompanyId?: CompanyId;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized  = useRef(false);
  const { theme }    = useTheme();
  const isLight      = theme === 'light';
  const [selectedNode, setSelectedNode] = useState<SupplyChainNode | null>(null);

  useEffect(() => {
    setSelectedNode(null);
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    injectPinStyles();

    const el      = containerRef.current;
    const network = buildNetwork(activeCompanyId, isLight);
    const timing  = ARC_TIMING[activeCompanyId];

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

          wrapper.setAttribute('role', 'button');
          wrapper.setAttribute('tabindex', '0');
          wrapper.setAttribute('aria-label', `${d.name}, ${d.country}`);
          wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedNode(d);
          });
          wrapper.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedNode(d);
            }
          });

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

      globe.pointOfView(INITIAL_POV[activeCompanyId]);

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
      {selectedNode && (
        <div
          className="ginfo-panel"
          role="dialog"
          aria-label={selectedNode.name}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            width: 'min(360px, calc(100% - 32px))',
            background: isLight ? '#f6f3ea' : '#0b0e14',
            color: isLight ? '#2C2A25' : '#E8F4F8',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '12px',
            padding: '14px 16px',
            boxShadow: isLight ? '0 6px 20px rgba(0,0,0,0.12)' : '0 8px 28px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setSelectedNode(null)}
            aria-label="Close"
            style={{
              position: 'absolute', top: '8px', right: '10px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isLight ? '#8a8675' : '#7d8590', padding: '2px', lineHeight: 0,
            }}
          >
            <svg viewBox="0 0 14 14" width="13" height="13" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: selectedNode.color, flexShrink: 0, boxShadow: `0 0 6px ${selectedNode.color}` }} />
            <span style={{ fontWeight: 700, fontSize: '14px', paddingRight: '16px' }}>{selectedNode.name}</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', opacity: 0.65, marginBottom: '8px' }}>
            {selectedNode.country}
          </div>
          <div style={{ fontSize: '12.5px', lineHeight: 1.5, opacity: 0.9, marginBottom: '12px' }}>
            {selectedNode.desc}
          </div>
          <a
            href={selectedNode.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '12.5px', fontWeight: 600,
              color: isLight ? '#0a5fc2' : '#5eb3ff',
              textDecoration: 'none',
            }}
          >
            Learn more
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

export interface SupplyChainRole {
  role: string;
  locations: string[];
}

export interface CompanyDef {
  id: string;
  name: string;
  ticker?: string;
  industry: string;
  sector: string;
  hq: string;
  founded: number;
  description: string;
  color: string;
  markets: string[];
  competitors: string[];
  brands: string[];
  conceptIds: string[];
  globeCompanyId?: 'apple' | 'nestle' | 'walmart';
  supplyChain: {
    suppliers: SupplyChainRole[];
    manufacturing: string[];
    distribution: string[];
    keyCountries: string[];
    logisticsFlow: string;
  };
  financials: {
    revenue: string;
    netIncome: string;
    marketCap: string;
    employees: string;
    fiscalYear: number;
  };
  tags: string[];
}

export const COMPANIES: CompanyDef[] = [
  {
    id: 'apple',
    name: 'Apple',
    ticker: 'AAPL',
    industry: 'Technology',
    sector: 'Consumer Electronics',
    hq: 'Cupertino, California, USA',
    founded: 1976,
    description: 'Apple designs and sells consumer electronics, software, and services. Known for iPhone, Mac, and iPad, it operates one of the world\'s most tightly controlled hardware-software ecosystems, generating over $391 billion in revenue.',
    color: '#636366',
    markets: ['North America', 'Europe', 'Asia-Pacific', 'Greater China', 'Japan', 'Rest of Americas'],
    competitors: ['Samsung', 'Google', 'Microsoft', 'Huawei', 'Sony'],
    brands: ['iPhone', 'Mac', 'iPad', 'Apple Watch', 'AirPods', 'Apple TV+', 'iCloud', 'App Store'],
    conceptIds: ['competitive-advantage', 'brand-management', 'global-strategy', 'oligopoly', 'value-chain', 'npv', 'pricing-strategy', 'fdi', 'trade-barriers', 'exchange-rates', 'international-logistics', 'product-development'],
    globeCompanyId: 'apple',
    supplyChain: {
      suppliers: [
        { role: 'Semiconductors', locations: ['TSMC — Taiwan', 'Samsung — South Korea'] },
        { role: 'Displays', locations: ['Samsung Display — South Korea', 'LG Display — South Korea', 'BOE — China'] },
        { role: 'Memory', locations: ['Kioxia — Japan', 'SK Hynix — South Korea'] },
        { role: 'Camera Sensors', locations: ['Sony — Japan', 'LG Innotek — South Korea'] },
        { role: 'Rare Earth Metals', locations: ['Baotou — Inner Mongolia, China'] },
      ],
      manufacturing: ['Zhengzhou — China (Foxconn)', 'Shenzhen — China (Pegatron)', 'Chennai — India', 'Bengaluru — India', 'Vietnam (AirPods)'],
      distribution: ['Cupertino HQ — USA', 'Cork — Ireland (EMEA hub)', 'Munich — Germany', 'Singapore (APAC hub)'],
      keyCountries: ['USA', 'China', 'Taiwan', 'South Korea', 'Japan', 'India', 'Vietnam', 'Ireland'],
      logisticsFlow: 'Raw materials → Component fabs → Assembly (China/India) → Air freight → Regional DCs → Apple Stores & Direct',
    },
    financials: { revenue: '$391B', netIncome: '$97B', marketCap: '~$3.3T', employees: '161,000', fiscalYear: 2024 },
    tags: ['Tech', 'Hardware', 'Ecosystem', 'Premium'],
  },
  {
    id: 'toyota',
    name: 'Toyota',
    ticker: 'TM',
    industry: 'Automotive',
    sector: 'Manufacturing',
    hq: 'Toyota City, Aichi, Japan',
    founded: 1937,
    description: 'Toyota is the world\'s largest automaker by volume and pioneer of the Toyota Production System — the foundation of modern lean manufacturing. It leads in hybrid technology and is expanding into hydrogen and battery electric vehicles.',
    color: '#EB0A1E',
    markets: ['Japan', 'North America', 'Europe', 'Asia', 'Oceania', 'Middle East & Africa', 'Latin America'],
    competitors: ['Volkswagen', 'Hyundai', 'General Motors', 'Ford', 'Tesla', 'Honda'],
    brands: ['Toyota', 'Lexus', 'Daihatsu', 'Hino', 'GR Sport', 'Crown', 'Land Cruiser', 'Prius'],
    conceptIds: ['value-chain', 'competitive-advantage', 'comparative-advantage', 'international-logistics', 'exchange-rates', 'fdi', 'trade-barriers', 'cost-functions', 'generic-strategies', 'global-strategy', 'strategic-alliances', 'swot'],
    supplyChain: {
      suppliers: [
        { role: 'Steel & Aluminium', locations: ['Nippon Steel — Japan', 'JFE Steel — Japan'] },
        { role: 'Electronics & Sensors', locations: ['Denso — Japan', 'Aisin — Japan'] },
        { role: 'Batteries (HV/EV)', locations: ['Panasonic — Japan', 'Prime Earth EV Energy — Japan'] },
        { role: 'Tyres', locations: ['Bridgestone — Japan', 'Michelin — France'] },
        { role: 'Glass', locations: ['Asahi Glass — Japan'] },
      ],
      manufacturing: ['Toyota City — Japan', 'Georgetown — Kentucky, USA', 'Cambridge — Ontario, Canada', 'Burnaston — UK', 'Tianjin & Guangzhou — China', 'Bangkok — Thailand', 'Chennai — India'],
      distribution: ['Toyota City HQ', 'Port of Nagoya', 'Port of Long Beach (USA)', 'Bremerhaven (Europe)'],
      keyCountries: ['Japan', 'USA', 'China', 'Thailand', 'India', 'UK', 'Canada', 'Australia'],
      logisticsFlow: 'Just-in-Time sourcing → Assembly plants worldwide → Port export → Regional distributors → Dealerships',
    },
    financials: { revenue: '$274B', netIncome: '$28B', marketCap: '~$250B', employees: '375,000', fiscalYear: 2024 },
    tags: ['Manufacturing', 'Lean', 'Automotive', 'Hybrid', 'JIT'],
  },
  {
    id: 'walmart',
    name: 'Walmart',
    ticker: 'WMT',
    industry: 'Retail',
    sector: 'Consumer Staples',
    hq: 'Bentonville, Arkansas, USA',
    founded: 1962,
    description: 'Walmart is the world\'s largest retailer by revenue, operating 10,500+ stores in 20+ countries. Its competitive edge rests on an unmatched logistics network, everyday-low-prices (EDLP) strategy, and a massive private-label supply chain spanning Asia, the Americas, and Africa.',
    color: '#0071DC',
    markets: ['USA', 'China', 'Canada', 'Mexico', 'India', 'Chile', 'South Africa', 'Central America'],
    competitors: ['Amazon', 'Target', 'Costco', 'Carrefour', 'Tesco', 'Kroger', 'JD.com'],
    brands: ['Walmart', "Sam's Club", 'Flipkart', 'Asda', 'Great Value', 'Equate', 'Marketside'],
    conceptIds: ['supply-demand', 'distribution-channels', 'competitive-advantage', 'cost-functions', 'value-chain', 'international-logistics', 'comparative-advantage', 'trade-barriers', 'oligopoly', 'pricing-strategy', 'global-strategy', 'generic-strategies'],
    globeCompanyId: 'walmart',
    supplyChain: {
      suppliers: [
        { role: 'Electronics & Apparel', locations: ['Shenzhen — China', 'Dongguan — China', 'Ho Chi Minh City — Vietnam', 'Dhaka — Bangladesh'] },
        { role: 'Fresh Produce', locations: ['Salinas Valley — California, USA', 'Santiago — Chile', 'Lima — Peru'] },
        { role: 'Branded CPG', locations: ['P&G, Unilever, Nestlé — Global'] },
        { role: 'Private Label Manufacturing', locations: ['Guangzhou — China', 'Phnom Penh — Cambodia', 'Bangkok — Thailand'] },
      ],
      manufacturing: ['Sourced globally; Walmart does not own factories but mandates production standards'],
      distribution: ['Bentonville HQ (command centre)', 'Dallas-Fort Worth DC', 'Los Angeles DC', 'Savannah port hub', 'Long Beach port hub'],
      keyCountries: ['USA', 'China', 'Vietnam', 'Bangladesh', 'India', 'Mexico', 'Canada', 'Chile'],
      logisticsFlow: 'Factory (Asia) → Ocean freight → Port (Long Beach/Savannah) → Cross-dock DC → Daily store replenishment',
    },
    financials: { revenue: '$648B', netIncome: '$16B', marketCap: '~$760B', employees: '2.1M', fiscalYear: 2024 },
    tags: ['Retail', 'EDLP', 'Logistics', 'Scale', 'Private Label'],
  },
  {
    id: 'nestle',
    name: 'Nestlé',
    ticker: 'NESN',
    industry: 'Food & Beverage',
    sector: 'Consumer Staples',
    hq: 'Vevey, Switzerland',
    founded: 1866,
    description: 'Nestlé is the world\'s largest food and beverage company by revenue, with products in 186 countries. Its portfolio spans coffee (Nescafé, Nespresso), nutrition, pet care, and confectionery across emerging and developed markets.',
    color: '#8B1A1A',
    markets: ['Europe', 'Americas', 'Asia/Oceania/Africa', 'Greater China', 'Emerging markets (55%+)'],
    competitors: ['Unilever', 'Danone', 'PepsiCo', 'Coca-Cola', 'Kraft Heinz', 'Mondelez'],
    brands: ['Nescafé', 'Nespresso', 'KitKat', 'Maggi', 'Purina', 'Milo', 'Perrier', 'San Pellegrino', 'Gerber', 'Haagen-Dazs'],
    conceptIds: ['brand-management', 'market-segmentation', 'positioning', 'global-strategy', 'mergers-acquisitions', 'fdi', 'growth-strategies', 'consumer-behavior', 'distribution-channels', 'exchange-rates', 'comparative-advantage', 'strategic-alliances'],
    globeCompanyId: 'nestle',
    supplyChain: {
      suppliers: [
        { role: 'Coffee Beans', locations: ['Minas Gerais — Brazil', 'Central Highlands — Vietnam', 'Huila — Colombia'] },
        { role: 'Cocoa', locations: ['Côte d\'Ivoire', 'Ghana'] },
        { role: 'Dairy', locations: ['New Zealand', 'Netherlands', 'Germany'] },
        { role: 'Palm Oil', locations: ['Malaysia', 'Indonesia'] },
        { role: 'Sugar', locations: ['Brazil', 'Thailand'] },
      ],
      manufacturing: ['Vevey — Switzerland (R&D & HQ)', 'Brampton — Canada', 'Glendale — California', 'Guangzhou & Shanghai — China', 'São Paulo — Brazil', 'Abidjan — Côte d\'Ivoire'],
      distribution: ['Vevey HQ', 'Warsaw (EMEA)', 'Dubai (MEA)', 'Singapore (APAC)', 'São Paulo (Latin America)'],
      keyCountries: ['Switzerland', 'USA', 'Brazil', 'China', 'Germany', 'UK', "Côte d'Ivoire", 'Vietnam'],
      logisticsFlow: 'Agricultural sourcing → Ingredient processing → Factory production → Regional warehouse → Distributor → Retail shelf',
    },
    financials: { revenue: '$92B', netIncome: '$9B', marketCap: '~$250B', employees: '270,000', fiscalYear: 2023 },
    tags: ['FMCG', 'Food', 'Brands', 'Nutrition', 'Sustainability'],
  },
  {
    id: 'tesla',
    name: 'Tesla',
    ticker: 'TSLA',
    industry: 'Automotive / Energy',
    sector: 'Technology & Manufacturing',
    hq: 'Austin, Texas, USA',
    founded: 2003,
    description: 'Tesla designs, manufactures, and sells electric vehicles, battery energy storage, and solar products. It pioneered mass-market EVs and operates Gigafactories across three continents using a vertically integrated, direct-to-consumer model.',
    color: '#E82127',
    markets: ['USA', 'China', 'Europe', 'Canada', 'Australia', 'Japan', 'Middle East', 'Southeast Asia'],
    competitors: ['BYD', 'Volkswagen', 'GM', 'Ford', 'Rivian', 'NIO', 'Lucid', 'Hyundai'],
    brands: ['Tesla', 'Model S', 'Model 3', 'Model X', 'Model Y', 'Cybertruck', 'Powerwall', 'Megapack', 'Supercharger'],
    conceptIds: ['competitive-advantage', 'blue-ocean', 'npv', 'risk-return', 'market-segmentation', 'product-development', 'generic-strategies', 'growth-strategies', 'exchange-rates', 'fdi', 'value-chain', 'debt-vs-equity'],
    supplyChain: {
      suppliers: [
        { role: 'Battery Cells', locations: ['Panasonic — Nevada, USA', 'CATL — Shanghai, China', 'LG Energy Solution — South Korea'] },
        { role: 'Semiconductors', locations: ['Samsung — South Korea', 'TSMC — Taiwan', 'Texas Instruments — USA'] },
        { role: 'Steel & Aluminium', locations: ['Nucor — USA', 'Aleris — USA'] },
        { role: 'Rare Earths', locations: ['MP Materials — Mountain Pass, California'] },
      ],
      manufacturing: ['Gigafactory Fremont — California', 'Gigafactory Nevada — Sparks, NV', 'Gigafactory Shanghai — China', 'Gigafactory Berlin-Brandenburg — Germany', 'Gigafactory Texas — Austin, TX'],
      distribution: ['Direct online sales', 'Tesla-owned showrooms', 'Global Supercharger network (50,000+ stations)'],
      keyCountries: ['USA', 'China', 'Germany', 'South Korea', 'Taiwan', 'Japan', 'Netherlands'],
      logisticsFlow: 'Battery cell sourcing → Gigafactory assembly → Direct sales online → Customer delivery centres',
    },
    financials: { revenue: '$97B', netIncome: '$7.1B', marketCap: '~$800B', employees: '140,000', fiscalYear: 2023 },
    tags: ['EV', 'Energy', 'Disruption', 'Direct Sales', 'Innovation'],
  },
  {
    id: 'nike',
    name: 'Nike',
    ticker: 'NKE',
    industry: 'Apparel & Footwear',
    sector: 'Consumer Discretionary',
    hq: 'Beaverton, Oregon, USA',
    founded: 1964,
    description: 'Nike is the world\'s largest sportswear company. It designs and markets athletic footwear, apparel, and equipment under the Nike, Jordan, and Converse brands — outsourcing almost all manufacturing while owning the brand and distribution.',
    color: '#F05A28',
    markets: ['North America', 'Europe/Middle East/Africa', 'Greater China', 'Asia Pacific & Latin America'],
    competitors: ['Adidas', 'Under Armour', 'Puma', 'New Balance', 'Lululemon', 'ASICS'],
    brands: ['Nike', 'Air Jordan', 'Converse', 'Nike Pro', 'Nike Air', 'Flyknit', 'Dri-FIT', 'React'],
    conceptIds: ['brand-management', 'positioning', 'global-strategy', 'fdi', 'international-logistics', 'comparative-advantage', 'market-segmentation', 'consumer-behavior', 'digital-marketing', 'pricing-strategy', 'distribution-channels', 'strategic-alliances'],
    supplyChain: {
      suppliers: [
        { role: 'Footwear Manufacturing', locations: ['Vietnam (50%)', 'Indonesia (27%)', 'China (18%)'] },
        { role: 'Apparel Manufacturing', locations: ['China', 'Vietnam', 'Thailand', 'Bangladesh', 'Cambodia'] },
        { role: 'Natural Rubber', locations: ['Vietnam', 'Indonesia', 'Thailand'] },
        { role: 'Synthetic Fabrics', locations: ['Taiwan', 'South Korea', 'China'] },
      ],
      manufacturing: ['Outsourced entirely to 500+ contract manufacturers across 40+ countries'],
      distribution: ['Memphis — Tennessee DC (Americas)', 'Laakdal — Belgium DC (EMEA)', 'Shanghai DC (China)', 'Nike Direct retail & digital'],
      keyCountries: ['USA', 'Vietnam', 'Indonesia', 'China', 'Bangladesh', 'Thailand', 'Cambodia'],
      logisticsFlow: 'Contract manufacturing → QC inspection → Regional DCs → Nike Direct (stores + app) & wholesale partners',
    },
    financials: { revenue: '$51B', netIncome: '$5.7B', marketCap: '~$90B', employees: '83,700', fiscalYear: 2024 },
    tags: ['Sportswear', 'Brand', 'Outsourcing', 'Direct-to-Consumer', 'Marketing'],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    ticker: 'AMZN',
    industry: 'E-commerce / Cloud',
    sector: 'Technology',
    hq: 'Seattle, Washington, USA',
    founded: 1994,
    description: 'Amazon is the world\'s largest online retailer and cloud computing provider (AWS). Its flywheel model spans e-commerce, logistics, cloud infrastructure, digital streaming, and AI — with AWS accounting for the majority of operating profit.',
    color: '#FF9900',
    markets: ['North America', 'Europe', 'Asia-Pacific', 'Middle East', 'India', 'Brazil', 'Australia'],
    competitors: ['Walmart', 'Alibaba', 'JD.com', 'Microsoft Azure', 'Google Cloud', 'Shopify', 'eBay'],
    brands: ['Amazon', 'AWS', 'Prime', 'Kindle', 'Echo', 'Alexa', 'Whole Foods', 'Ring', 'Twitch', 'MGM'],
    conceptIds: ['distribution-channels', 'competitive-advantage', 'blue-ocean', 'value-chain', 'growth-strategies', 'mergers-acquisitions', 'oligopoly', 'digital-marketing', 'consumer-behavior', 'stock-valuation', 'npv', 'market-segmentation'],
    supplyChain: {
      suppliers: [
        { role: 'Third-party Sellers', locations: ['Globally (60%+ of unit sales)'] },
        { role: 'Private Label Sourcing', locations: ['China', 'India', 'Bangladesh'] },
        { role: 'AWS Infrastructure', locations: ['US data centres (multiple regions)', 'EU data centres', 'APAC data centres'] },
        { role: 'Packaging', locations: ['USA domestic suppliers'] },
      ],
      manufacturing: ['Platform model: Amazon does not manufacture; it enables third-party sellers and manages fulfilment'],
      distribution: ['200+ fulfilment centres worldwide', 'Amazon Air (85+ aircraft)', 'Amazon Last Mile delivery vans', 'Locker network', 'Whole Foods as urban fulfilment nodes'],
      keyCountries: ['USA', 'UK', 'Germany', 'Japan', 'India', 'Canada', 'France', 'Italy', 'Spain'],
      logisticsFlow: 'Seller inventory → Fulfilment centre → Sortation centre → Delivery station → Customer (same/next-day)',
    },
    financials: { revenue: '$575B', netIncome: '$30B', marketCap: '~$2.1T', employees: '1.5M', fiscalYear: 2023 },
    tags: ['E-commerce', 'Cloud', 'Logistics', 'Platform', 'AI'],
  },
  {
    id: 'samsung',
    name: 'Samsung',
    ticker: '005930.KS',
    industry: 'Technology / Conglomerate',
    sector: 'Electronics & Semiconductors',
    hq: 'Suwon, South Korea',
    founded: 1938,
    description: "Samsung Electronics is the world's largest memory chip and smartphone manufacturer. As South Korea's leading chaebol, it operates across semiconductors, displays, and consumer electronics with deep vertical integration.",
    color: '#1428A0',
    markets: ['South Korea', 'USA', 'Europe', 'China', 'India', 'Southeast Asia', 'Latin America', 'MEA'],
    competitors: ['TSMC', 'Apple', 'Huawei', 'Sony', 'Micron', 'SK Hynix', 'LG Electronics', 'Qualcomm'],
    brands: ['Samsung Galaxy', 'Samsung QLED', 'Exynos', 'Knox', 'Bespoke', 'Neo QLED', 'The Frame'],
    conceptIds: ['competitive-advantage', 'oligopoly', 'value-chain', 'fdi', 'global-strategy', 'product-development', 'international-logistics', 'trade-barriers', 'exchange-rates', 'npv', 'cost-functions', 'mergers-acquisitions'],
    supplyChain: {
      suppliers: [
        { role: 'Silicon Wafers', locations: ['Shin-Etsu Chemical — Japan', 'Sumco — Japan'] },
        { role: 'Chemical Materials', locations: ['JSR Corporation — Japan', 'Merck Group — Germany'] },
        { role: 'Lithography Equipment', locations: ['ASML — Netherlands', 'Tokyo Electron — Japan'] },
        { role: 'Specialty Gases', locations: ['Air Liquide — France', 'Linde — Germany'] },
      ],
      manufacturing: ['Suwon — South Korea (Smartphones)', 'Hwaseong — South Korea (Semiconductors)', 'Pyeongtaek — South Korea (DRAM)', "Xi'an — China (NAND Flash)", 'Taylor — Texas, USA (new fab)', 'Noida — India (Smartphones)'],
      distribution: ['Samsung B2B (enterprise)', 'Global carrier partnerships', 'Samsung.com direct', 'Authorised resellers worldwide'],
      keyCountries: ['South Korea', 'USA', 'China', 'Vietnam', 'India', 'Netherlands', 'Japan'],
      logisticsFlow: 'Wafer fab → Chip packaging → Device assembly → Regional distribution → Carrier/Retailer → Consumer',
    },
    financials: { revenue: '$220B', netIncome: '$15B', marketCap: '~$300B', employees: '270,000', fiscalYear: 2023 },
    tags: ['Semiconductors', 'Electronics', 'Chaebol', 'Memory', 'Vertically Integrated'],
  },
  {
    id: 'unilever',
    name: 'Unilever',
    ticker: 'UL',
    industry: 'Consumer Goods',
    sector: 'FMCG',
    hq: 'London, United Kingdom',
    founded: 1929,
    description: "Unilever is a leading FMCG company with products in 190 countries, owning 400+ brands spanning personal care, home care, and food. It generates 55%+ of revenue from emerging markets and has a stated sustainability-first corporate purpose.",
    color: '#1F36C7',
    markets: ['Europe', 'Asia/AMET/RUB', 'Americas', 'Emerging Markets (55%+ of revenue)'],
    competitors: ['Nestlé', 'P&G', 'Henkel', 'Colgate-Palmolive', 'Reckitt', 'Danone'],
    brands: ['Dove', 'Axe/Lynx', 'Lifebuoy', 'Knorr', "Hellmann's", "Ben & Jerry's", 'Magnum', 'Vaseline', 'Domestos', 'TRESemmé', 'Simple'],
    conceptIds: ['brand-management', 'market-segmentation', 'global-strategy', 'mergers-acquisitions', 'consumer-behavior', 'distribution-channels', 'positioning', 'fdi', 'comparative-advantage', 'growth-strategies', 'strategic-alliances', 'pricing-strategy'],
    supplyChain: {
      suppliers: [
        { role: 'Palm Oil', locations: ['Malaysia', 'Indonesia'] },
        { role: 'Agricultural Ingredients', locations: ['Brazil (soy)', 'India (tea)', 'Indonesia (coconut)'] },
        { role: 'Chemical Compounds', locations: ['Regional — Middle East, Europe'] },
        { role: 'Packaging', locations: ['Regional suppliers globally'] },
      ],
      manufacturing: ['Enfield — UK', 'Rotterdam — Netherlands', 'Port Sunlight — UK', 'São Paulo — Brazil', 'Mumbai — India', 'Johannesburg — South Africa', 'Bangkok — Thailand', 'Shanghai — China'],
      distribution: ['Regional distribution hubs', 'Retail partnerships (Tesco, Walmart, Carrefour)', 'E-commerce (Alibaba, Amazon)'],
      keyCountries: ['UK', 'Netherlands', 'USA', 'Brazil', 'India', 'Indonesia', 'China', 'South Africa'],
      logisticsFlow: 'Agricultural sourcing → Processing → Manufacturing → Regional DC → Retail partners → Consumer shelf',
    },
    financials: { revenue: '$60B', netIncome: '$7B', marketCap: '~$110B', employees: '128,000', fiscalYear: 2023 },
    tags: ['FMCG', 'Sustainability', 'Portfolio', 'Emerging Markets', 'Personal Care'],
  },
  {
    id: 'lvmh',
    name: 'LVMH',
    ticker: 'MC.PA',
    industry: 'Luxury Goods',
    sector: 'Consumer Discretionary',
    hq: 'Paris, France',
    founded: 1987,
    description: "LVMH Moët Hennessy Louis Vuitton is the world's largest luxury goods conglomerate, managing 75+ prestigious brands across fashion & leather goods, spirits, cosmetics, jewellery, and hospitality. Pricing power and brand heritage define its economic moat.",
    color: '#C9A96E',
    markets: ['Europe', 'United States', 'Asia (ex-Japan)', 'Japan', 'Rest of World'],
    competitors: ['Kering', 'Richemont', 'Hermès', 'Chanel', 'Prada', 'Burberry', 'Ralph Lauren'],
    brands: ['Louis Vuitton', 'Christian Dior', 'Moët & Chandon', 'Hennessy', 'Bulgari', 'TAG Heuer', 'Givenchy', 'Fendi', 'Loro Piana', 'Sephora', 'Tiffany & Co.'],
    conceptIds: ['brand-management', 'pricing-strategy', 'competitive-advantage', 'generic-strategies', 'mergers-acquisitions', 'positioning', 'global-strategy', 'consumer-behavior', 'market-segmentation', 'blue-ocean', 'growth-strategies', 'stock-valuation'],
    supplyChain: {
      suppliers: [
        { role: 'Leather & Textiles', locations: ['Tuscany — Italy', 'France (tanneries)'] },
        { role: 'Champagne Grapes', locations: ['Épernay — Champagne, France'] },
        { role: 'Cognac Grapes', locations: ['Cognac — Charente, France'] },
        { role: 'Precious Stones', locations: ['Botswana (diamonds)', 'Colombia (emeralds)'] },
        { role: 'Luxury Fabrics', locations: ['Lyon — France (silk)', 'Como — Italy (silk)'] },
      ],
      manufacturing: ['Paris — France (haute couture ateliers)', 'Florence — Italy (Pucci, Fendi)', 'Cognac — France (Hennessy)', 'Geneva — Switzerland (watches)', 'New York — USA (Tiffany)'],
      distribution: ['Flagship boutiques worldwide (5,600+)', 'Sephora retail chain (2,700+ stores)', 'DFS duty-free airports', 'Selective wholesale', 'Brand-owned online stores'],
      keyCountries: ['France', 'Italy', 'Switzerland', 'USA', 'China', 'Japan', 'UK', 'Spain'],
      logisticsFlow: 'Artisan sourcing → Atelier production → Quality certification → Flagship boutiques → VIP client service',
    },
    financials: { revenue: '$86B', netIncome: '$12B', marketCap: '~$340B', employees: '213,000', fiscalYear: 2023 },
    tags: ['Luxury', 'Heritage', 'Conglomerate', 'Aspirational', 'Craftsmanship'],
  },
];

export const COMPANY_MAP: Map<string, CompanyDef> = new Map(COMPANIES.map(c => [c.id, c]));

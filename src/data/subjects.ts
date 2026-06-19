export interface SubjectDef {
  id: string;
  title: string;
  description: string;
  color: string;
  icon?: string;          // named glyph key (see data/subjectIcons); falls back to id map
  levels?: string[];
  hasContent?: boolean;
  flashcardTopic?: string;
  notesSubject?: string;
  quizTopic?: string;
  lat?: number;
  lng?: number;
}

export const CORE_SUBJECTS: SubjectDef[] = [
  {
    id: 'international-trade',
    title: 'International Trade',
    description: 'Comparative advantage, trade policy, Heckscher-Ohlin, terms of trade.',
    color: '#d4a843',
    hasContent: true,
    flashcardTopic: 'International Trade',
    notesSubject: 'International Trade',
    quizTopic: 'International Trade',
    lat: 25.20, lng: 55.27,    // Dubai — East–West trade crossroads
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Marketing mix, segmentation, brand equity, consumer behaviour.',
    color: '#73869C',
    hasContent: true,
    flashcardTopic: 'Marketing',
    notesSubject: 'Marketing',
    quizTopic: 'Marketing',
    lat: -23.55, lng: -46.63,  // São Paulo — largest consumer market in South America
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'NPV, IRR, WACC, capital markets, EMH, risk and return.',
    color: '#7A8F7D',
    hasContent: true,
    flashcardTopic: 'Finance',
    notesSubject: 'Finance',
    quizTopic: 'Finance',
    lat: 51.51, lng: -0.13,    // London — global financial centre
  },
  {
    id: 'economics',
    title: 'Economics',
    description: 'Elasticity, GDP, monetary policy, game theory and market structures.',
    color: '#c084fc',
    hasContent: true,
    flashcardTopic: 'Economics',
    notesSubject: 'Economics',
    quizTopic: 'Economics',
    lat: 41.88, lng: -87.63,   // Chicago — Chicago School of Economics
  },
];

export const EXTENDED_SUBJECTS: SubjectDef[] = [
  {
    id: 'japanese',
    title: 'Japanese',
    description: 'Japanese language studies: grammar, vocabulary and kanji.',
    color: '#C58B83',
    lat: 35.68, lng: 139.65,   // Tokyo
  },
  {
    id: 'chinese',
    title: 'Chinese',
    description: 'Mandarin Chinese language studies: grammar, vocabulary and hanzi.',
    color: '#C29C6D',
    lat: 39.91, lng: 116.39,   // Beijing — ~2100 km from Tokyo
  },
  {
    id: 'research-business',
    title: 'Research for Business Studies',
    description: 'Research methods, methodology, data collection and analysis.',
    color: '#6E8C8A',
    lat: 59.33, lng: 18.07,    // Stockholm — Scandinavia, ~1700 km from London
  },
  {
    id: 'eq-pc',
    title: 'English for Qualifications and Practical communication',
    description: 'English for academic qualifications and practical, real-world communication.',
    color: '#a78bfa',
    levels: ['Level 1', 'Level 2', 'Level 3'],
    lat: -26.20, lng: 28.04,   // Johannesburg — Southern Africa
  },
  {
    id: 'business-economics',
    title: 'Business Economics',
    description: 'Applied economics: business cycles, fiscal policy, exchange rates.',
    color: '#C2410C',
    lat: 1.35, lng: 103.82,    // Singapore — SE Asia business hub
  },
  {
    id: 'pre-seminar',
    title: 'Pre Seminar',
    description: 'Academic writing, research skills, presentation and citation.',
    color: '#818cf8',
    lat: -34.60, lng: -58.38,  // Buenos Aires — academic tradition, South America
  },
  {
    id: 'accounting-advanced',
    title: 'Accounting Advanced',
    description: 'Advanced financial reporting, consolidation, US GAAP standards.',
    color: '#7A8F7D',
    lat: -33.87, lng: 151.21,  // Sydney — Pacific financial hub, Oceania
  },
  {
    id: 'management',
    title: 'Management',
    description: 'Managerial theory, organisational behaviour, leadership and change.',
    color: '#C58B83',
    lat: 40.71, lng: -74.01,   // New York — ~1200 km from Chicago
  },
];

export const ALL_SUBJECTS = [...CORE_SUBJECTS, ...EXTENDED_SUBJECTS];

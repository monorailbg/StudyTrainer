export interface SubjectDef {
  id: string;
  title: string;
  description: string;
  color: string;
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
    lat: 1.35, lng: 103.82,   // Singapore — crossroads of global trade
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Marketing mix, segmentation, brand equity, consumer behaviour.',
    color: '#60a5fa',
    hasContent: true,
    flashcardTopic: 'Marketing',
    notesSubject: 'Marketing',
    quizTopic: 'Marketing',
    lat: 35.68, lng: 139.65,  // Tokyo — consumer culture capital
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'NPV, IRR, WACC, capital markets, EMH, risk and return.',
    color: '#4ade80',
    hasContent: true,
    flashcardTopic: 'Finance',
    notesSubject: 'Finance',
    quizTopic: 'Finance',
    lat: 51.51, lng: -0.13,   // London — global financial centre
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
    lat: 50.11, lng: 8.68,    // Frankfurt — eurozone economic hub
  },
];

export const EXTENDED_SUBJECTS: SubjectDef[] = [
  {
    id: 'japanese',
    title: 'Japanese',
    description: 'Japanese language studies across three progressive levels.',
    color: '#f87171',
    levels: ['Level 1', 'Level 2', 'Level 3'],
    lat: 34.69, lng: 135.50,  // Osaka
  },
  {
    id: 'chinese',
    title: 'Chinese',
    description: 'Mandarin Chinese language studies across three progressive levels.',
    color: '#fb923c',
    levels: ['Level 1', 'Level 2', 'Level 3'],
    lat: 31.23, lng: 121.47,  // Shanghai
  },
  {
    id: 'research-business',
    title: 'Research for Business Studies',
    description: 'Research methods, methodology, data collection and analysis.',
    color: '#22d3ee',
    lat: 42.36, lng: -71.06,  // Boston — Harvard, MIT
  },
  {
    id: 'eq-pc',
    title: 'EQ and PC',
    description: 'Emotional Intelligence and Personal Competencies across three levels.',
    color: '#a78bfa',
    levels: ['Level 1', 'Level 2', 'Level 3'],
    lat: 47.38, lng: 8.54,    // Zurich
  },
  {
    id: 'business-economics',
    title: 'Business Economics',
    description: 'Applied economics: business cycles, fiscal policy, exchange rates.',
    color: '#fbbf24',
    lat: 41.88, lng: -87.63,  // Chicago — economics school
  },
  {
    id: 'pre-seminar',
    title: 'Pre Seminar',
    description: 'Academic writing, research skills, presentation and citation.',
    color: '#818cf8',
    lat: 48.21, lng: 16.37,   // Vienna — academic tradition
  },
  {
    id: 'accounting-advanced',
    title: 'Accounting Advanced',
    description: 'Advanced financial reporting, consolidation, IFRS standards.',
    color: '#34d399',
    lat: 22.32, lng: 114.17,  // Hong Kong — accounting hub
  },
  {
    id: 'management',
    title: 'Management',
    description: 'Managerial theory, organisational behaviour, leadership and change.',
    color: '#f472b6',
    lat: 40.71, lng: -74.01,  // New York
  },
];

export const ALL_SUBJECTS = [...CORE_SUBJECTS, ...EXTENDED_SUBJECTS];

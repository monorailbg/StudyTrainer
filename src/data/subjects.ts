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
  },
];

export const EXTENDED_SUBJECTS: SubjectDef[] = [
  {
    id: 'japanese',
    title: 'Japanese',
    description: 'Japanese language studies across three progressive levels.',
    color: '#f87171',
    levels: ['Level 1', 'Level 2', 'Level 3'],
  },
  {
    id: 'chinese',
    title: 'Chinese',
    description: 'Mandarin Chinese language studies across three progressive levels.',
    color: '#fb923c',
    levels: ['Level 1', 'Level 2', 'Level 3'],
  },
  {
    id: 'research-business',
    title: 'Research for Business Studies',
    description: 'Research methods, methodology, data collection and analysis.',
    color: '#22d3ee',
  },
  {
    id: 'eq-pc',
    title: 'EQ and PC',
    description: 'Emotional Intelligence and Personal Competencies across three levels.',
    color: '#a78bfa',
    levels: ['Level 1', 'Level 2', 'Level 3'],
  },
  {
    id: 'business-economics',
    title: 'Business Economics',
    description: 'Applied economics: business cycles, fiscal policy, exchange rates.',
    color: '#fbbf24',
  },
  {
    id: 'pre-seminar',
    title: 'Pre Seminar',
    description: 'Academic writing, research skills, presentation and citation.',
    color: '#818cf8',
  },
  {
    id: 'accounting-advanced',
    title: 'Accounting Advanced',
    description: 'Advanced financial reporting, consolidation, IFRS standards.',
    color: '#34d399',
  },
  {
    id: 'management',
    title: 'Management',
    description: 'Managerial theory, organisational behaviour, leadership and change.',
    color: '#f472b6',
  },
];

export const ALL_SUBJECTS = [...CORE_SUBJECTS, ...EXTENDED_SUBJECTS];

export interface Flashcard {
  id: string;
  topic: string;
  chapter: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
}

export interface NoteConfig {
  id: string;
  title: string;
  chapter: string;
  rawUrl: string;
  subject: string;
}

export interface Subject {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  flashcardCount: number;
  questionCount: number;
  noteCount: number;
}

export interface StudyProgress {
  flashcardsStudied: string[];
  flashcardsKnown: string[];
  quizScores: { topic: string; score: number; total: number; date: string }[];
  notesRead: string[];
}

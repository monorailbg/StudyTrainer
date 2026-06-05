import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StudyStore {
  flashcardsStudied: string[];
  flashcardsKnown: string[];
  quizScores: { topic: string; score: number; total: number; date: string }[];
  notesRead: string[];
  recentSubjects: { id: string; at: number }[];
  markFlashcardStudied: (id: string) => void;
  markFlashcardKnown: (id: string) => void;
  markFlashcardReview: (id: string) => void;
  addQuizScore: (topic: string, score: number, total: number) => void;
  markNoteRead: (id: string) => void;
  visitSubject: (id: string) => void;
  removeRecentSubject: (id: string) => void;
  resetProgress: () => void;
}

export const useStore = create<StudyStore>()(
  persist(
    (set) => ({
      flashcardsStudied: [],
      flashcardsKnown: [],
      quizScores: [],
      notesRead: [],
      recentSubjects: [],

      markFlashcardStudied: (id) =>
        set((s) => ({
          flashcardsStudied: s.flashcardsStudied.includes(id)
            ? s.flashcardsStudied
            : [...s.flashcardsStudied, id],
        })),

      markFlashcardKnown: (id) =>
        set((s) => ({
          flashcardsKnown: s.flashcardsKnown.includes(id)
            ? s.flashcardsKnown
            : [...s.flashcardsKnown, id],
          flashcardsStudied: s.flashcardsStudied.includes(id)
            ? s.flashcardsStudied
            : [...s.flashcardsStudied, id],
        })),

      markFlashcardReview: (id) =>
        set((s) => ({
          flashcardsKnown: s.flashcardsKnown.filter((k) => k !== id),
        })),

      addQuizScore: (topic, score, total) =>
        set((s) => ({
          quizScores: [
            ...s.quizScores,
            { topic, score, total, date: new Date().toISOString() },
          ],
        })),

      markNoteRead: (id) =>
        set((s) => ({
          notesRead: s.notesRead.includes(id) ? s.notesRead : [...s.notesRead, id],
        })),

      visitSubject: (id) =>
        set((s) => ({
          recentSubjects: [
            { id, at: Date.now() },
            ...s.recentSubjects.filter((r) => r.id !== id),
          ].slice(0, 6),
        })),

      removeRecentSubject: (id) =>
        set((s) => ({
          recentSubjects: s.recentSubjects.filter((r) => r.id !== id),
        })),

      resetProgress: () =>
        set({ flashcardsStudied: [], flashcardsKnown: [], quizScores: [], notesRead: [], recentSubjects: [] }),
    }),
    { name: 'study-trainer-progress' }
  )
);

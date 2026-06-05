import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ExamDate {
  subjectId: string;
  date: string;
  label?: string;
}

interface ExamDatesStore {
  dates: ExamDate[];
  setDate: (subjectId: string, date: string, label?: string) => void;
  removeDate: (subjectId: string) => void;
}

export const useExamDates = create<ExamDatesStore>()(
  persist(
    (set) => ({
      dates: [],
      setDate: (subjectId, date, label) =>
        set((s) => ({
          dates: [{ subjectId, date, label }, ...s.dates.filter((d) => d.subjectId !== subjectId)],
        })),
      removeDate: (subjectId) => set((s) => ({ dates: s.dates.filter((d) => d.subjectId !== subjectId) })),
    }),
    { name: 'examDates' }
  )
);

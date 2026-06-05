import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityType = 'note' | 'flashcards' | 'quiz' | 'generate';

export interface ActivityEvent {
  id:          string;
  type:        ActivityType;
  subjectId:   string;
  subjectName: string;
  detail:      string;   // full description, e.g. "Reviewed 12 cards in Finance"
  timestamp:   number;
}

interface ActivityStore {
  events: ActivityEvent[];
  record: (e: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

const CAP = 100;

export const useActivity = create<ActivityStore>()(
  persist(
    (set) => ({
      events: [],
      record: (e) =>
        set((s) => ({
          events: [
            { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now() },
            ...s.events,
          ].slice(0, CAP),
        })),
      clear: () => set({ events: [] }),
    }),
    { name: 'study-trainer-activity' },
  ),
);

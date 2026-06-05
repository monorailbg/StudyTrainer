import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { schedule, isKnown, isDue, type Rating, type SRSCard } from '../lib/srs';

interface SRSStore {
  cards: Record<string, SRSCard>;
  rate: (cardId: string, subjectId: string, rating: Rating) => void;
  reset: () => void;
}

export const useSRS = create<SRSStore>()(
  persist(
    (set) => ({
      cards: {},
      rate: (cardId, subjectId, rating) =>
        set((s) => {
          const next = schedule(s.cards[cardId], rating);
          return { cards: { ...s.cards, [cardId]: { ...next, subjectId } } };
        }),
      reset: () => set({ cards: {} }),
    }),
    { name: 'study-trainer-srs' },
  ),
);

// ── Derived per-subject tallies ────────────────────────────────────────────────
// Given the SRS map and the set of card ids that belong to a subject, count how
// many are known and how many are due. Unseen cards (no record yet) are not due.

export interface SubjectSrsStats { total: number; known: number; due: number; }

export function subjectSrsStats(
  cards: Record<string, SRSCard>,
  cardIds: string[],
  now = Date.now(),
): SubjectSrsStats {
  let known = 0;
  let due = 0;
  for (const id of cardIds) {
    const c = cards[id];
    if (!c) continue;
    if (isKnown(c)) known++;
    if (isDue(c, now)) due++;
  }
  return { total: cardIds.length, known, due };
}

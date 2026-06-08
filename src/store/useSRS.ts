import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  schedule, isKnown, isDue,
  type Rating, type SRSCard, type CardState,
} from '../lib/srs';

interface SRSStore {
  cards: Record<string, SRSCard>;
  rate:       (cardId: string, subjectId: string, rating: Rating) => void;
  resetCards: (cardIds: string[]) => void;
  reset:      () => void;
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
      resetCards: (cardIds) =>
        set((s) => {
          const next = { ...s.cards };
          for (const id of cardIds) delete next[id];
          return { cards: next };
        }),
      reset: () => set({ cards: {} }),
    }),
    {
      name: 'study-trainer-srs',
      version: 2,

      // v1 → v2: rename `repetitions` → `repetitionCount`, add `state` field.
      migrate: (persisted: unknown, version: number) => {
        const stored = persisted as { cards?: Record<string, Record<string, unknown>> };
        if (version < 2) {
          const raw = stored?.cards ?? {};
          const migrated: Record<string, SRSCard> = {};
          for (const [id, c] of Object.entries(raw)) {
            const reps = (c.repetitions as number | undefined) ??
                         (c.repetitionCount as number | undefined) ?? 0;
            const ef   = (c.easeFactor as number | undefined) ?? 2.5;
            const cardState: CardState =
              reps === 0             ? 'NEW'
              : ef > 2.0 && reps >= 2 ? 'GRADUATED'
              :                         'LEARNING';
            migrated[id] = {
              subjectId:       (c.subjectId as string | undefined) ?? '',
              state:           cardState,
              easeFactor:      ef,
              repetitionCount: reps,
              interval:        (c.interval as number | undefined) ?? 1,
              nextReviewDate:  (c.nextReviewDate as number | undefined) ?? Date.now(),
              lastReviewedAt:  (c.lastReviewedAt as number | undefined) ?? Date.now(),
            };
          }
          return { cards: migrated };
        }
        return stored as unknown as { cards: Record<string, SRSCard> };
      },
    },
  ),
);

// ── Derived per-subject tallies ────────────────────────────────────────────────

export interface SubjectSrsStats {
  total:     number;
  due:       number;  // nextReviewDate <= now
  unseen:    number;  // no SRS record (brand-new)
  known:     number;  // graduated or well-spaced
  newCount:  number;  // state === 'NEW'
  learning:  number;  // state === 'LEARNING'
  graduated: number;  // state === 'GRADUATED'
}

/**
 * subjectSrsStats — derives per-set/subject counts from the SRS store.
 *
 * Pass the full SRS card map and the card IDs that belong to this set.
 * Equivalent to a GROUP BY query across the SRS metrics.
 */
export function subjectSrsStats(
  cards:   Record<string, SRSCard>,
  cardIds: string[],
  now = Date.now(),
): SubjectSrsStats {
  let due = 0, unseen = 0, known = 0, newCount = 0, learning = 0, graduated = 0;

  for (const id of cardIds) {
    const c = cards[id];
    if (c == null) { unseen++; continue; }
    if (isDue(c, now))            due++;
    if (isKnown(c))               known++;
    if (c.state === 'NEW')        newCount++;
    else if (c.state === 'LEARNING')  learning++;
    else if (c.state === 'GRADUATED') graduated++;
  }

  return { total: cardIds.length, due, unseen, known, newCount, learning, graduated };
}

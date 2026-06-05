// Lightweight spaced-repetition scheduling (SM-2 variant).
// One record per flashcard id, updated each time the user rates a card.

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface SRSCard {
  subjectId:      string;
  easeFactor:     number;  // SM-2 ease, starts at 2.5, floored at 1.3
  repetitions:    number;  // consecutive successful (>= Hard) reviews
  interval:       number;  // current interval in days
  nextReviewDate: number;  // epoch ms — when the card is next due
  lastReviewedAt: number;  // epoch ms
}

const DAY = 86_400_000;

const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function startOfToday(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type Scheduled = Omit<SRSCard, 'subjectId'>;

// Apply one rating to a card's prior state (or a fresh card) and return the
// next schedule. "Again" resets progress and keeps the card due today.
export function schedule(prev: Partial<SRSCard> | undefined, rating: Rating, now = Date.now()): Scheduled {
  const q = QUALITY[rating];
  let ease = prev?.easeFactor ?? 2.5;
  let reps = prev?.repetitions ?? 0;
  let interval = prev?.interval ?? 0;

  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;

  if (q < 3) {
    return { easeFactor: ease, repetitions: 0, interval: 0, nextReviewDate: now, lastReviewedAt: now };
  }

  reps += 1;
  if (reps === 1) interval = 1;
  else if (reps === 2) interval = 6;
  else interval = Math.round(interval * ease);
  if (rating === 'easy') interval = Math.round(interval * 1.3);
  if (interval < 1) interval = 1;

  return {
    easeFactor: ease,
    repetitions: reps,
    interval,
    nextReviewDate: startOfToday(now) + interval * DAY,
    lastReviewedAt: now,
  };
}

// A card is "known" once it's well-spaced and answered well a few times.
export function isKnown(c: { easeFactor: number; repetitions: number }): boolean {
  return c.easeFactor > 2.0 && c.repetitions >= 2;
}

// Due if its next review date has arrived (or it's never been scheduled — but
// unseen cards have no record, so the caller decides how to treat those).
export function isDue(c: { nextReviewDate: number }, now = Date.now()): boolean {
  return c.nextReviewDate <= now;
}

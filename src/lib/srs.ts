/**
 * Spaced Repetition System — SM-2 variant
 *
 * "DB SCHEMA" (one record per flashcard):
 *   state            TEXT     DEFAULT 'NEW'   -- 'NEW' | 'LEARNING' | 'GRADUATED'
 *   ease_factor      REAL     DEFAULT 2.5     -- SM-2 E-Factor, floor 1.30, cap 4.0
 *   repetition_count INTEGER  DEFAULT 0       -- consecutive successful (Hard+) reviews
 *   interval         INTEGER  DEFAULT 1       -- next interval in days
 *   next_review_date BIGINT                   -- epoch ms; due when <= NOW()
 *   last_reviewed_at BIGINT                   -- epoch ms
 *
 * This module is fully decoupled from any database. Pass the card's
 * current metrics → get back updated metrics ready to save anywhere.
 */

export type Rating    = 'again' | 'hard' | 'good' | 'easy';
export type CardState = 'NEW' | 'LEARNING' | 'GRADUATED';

export interface SRSCard {
  subjectId:       string;
  state:           CardState; // lifecycle stage
  easeFactor:      number;    // E-Factor, default 2.5, min 1.30, max 4.0
  repetitionCount: number;    // consecutive successful reviews (Hard or better)
  interval:        number;    // scheduled interval in days
  nextReviewDate:  number;    // epoch ms
  lastReviewedAt:  number;    // epoch ms
}

const DAY = 86_400_000;

export function startOfToday(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type Scheduled = Omit<SRSCard, 'subjectId'>;

/**
 * schedule() — pure, stateless scheduling engine.
 *
 * Pass in the card's prior metrics (undefined = brand-new card) and the
 * user's rating. Returns the complete new metrics object — no DB connection
 * needed, works with any per-subject database.
 *
 * Rating rules per spec:
 *  again (1): rep → 0,   EF -= 0.20  (floor 1.30), interval = 1 day,       state → LEARNING
 *  hard  (2): rep++,     EF -= 0.15  (floor 1.30), interval = round(ivl × 1.2)
 *  good  (3): rep++,     EF unchanged,              interval = round(ivl × EF)
 *  easy  (4): rep++,     EF += 0.15  (cap  4.00),  interval = round(ivl × EF × 1.3), state → GRADUATED
 *
 * State transitions:
 *  Any score on NEW   → at least LEARNING (Easy jumps directly to GRADUATED)
 *  Easy               → GRADUATED (always)
 *  Again              → LEARNING  (demotes GRADUATED back to LEARNING)
 */
export function schedule(
  prev:   Partial<SRSCard> | undefined,
  rating: Rating,
  now = Date.now(),
): Scheduled {
  let ef    = prev?.easeFactor      ?? 2.5;
  let rep   = prev?.repetitionCount ?? 0;
  let ivl   = prev?.interval        ?? 1;   // first review defaults to 1 day
  let state: CardState = prev?.state ?? 'NEW';

  switch (rating) {
    case 'again':
      // Lapse: reset progress, penalise EF, schedule for tomorrow
      rep   = 0;
      ef    = Math.max(1.30, ef - 0.20);
      ivl   = 1;
      state = 'LEARNING';
      break;

    case 'hard':
      // Slow progress: minor EF penalty, interval grows only 1.2×
      rep  += 1;
      ef    = Math.max(1.30, ef - 0.15);
      ivl   = Math.max(1, Math.round(ivl * 1.2));
      if (state === 'NEW') state = 'LEARNING';
      break;

    case 'good':
      // Normal: EF unchanged, standard SM-2 interval growth
      rep  += 1;
      // ef stays the same
      ivl   = Math.max(1, Math.round(ivl * ef));
      if (state === 'NEW') state = 'LEARNING';
      break;

    case 'easy':
      // Bonus: EF reward + super-multiplier for well-known cards
      rep  += 1;
      ef    = Math.min(4.0, ef + 0.15);      // cap avoids runaway intervals
      ivl   = Math.max(1, Math.round(ivl * ef * 1.3));
      state = 'GRADUATED';
      break;
  }

  return {
    state,
    easeFactor:      ef,
    repetitionCount: rep,
    interval:        ivl,
    nextReviewDate:  startOfToday(now) + ivl * DAY,
    lastReviewedAt:  now,
  };
}

// ── Predicates ────────────────────────────────────────────────────────────────

/** A card is "known" once it has graduated or is well-spaced with a good EF. */
export function isKnown(c: Pick<SRSCard, 'state' | 'easeFactor' | 'repetitionCount'>): boolean {
  return c.state === 'GRADUATED' || (c.easeFactor > 2.0 && c.repetitionCount >= 2);
}

/** Due when next_review_date <= now — the core SRS queue condition. */
export function isDue(c: Pick<SRSCard, 'nextReviewDate'>, now = Date.now()): boolean {
  return c.nextReviewDate <= now;
}

// ── Queue query ───────────────────────────────────────────────────────────────

/**
 * getStudyQueue — client-side equivalent of:
 *
 *   SELECT * FROM cards
 *   WHERE subject_id = $subjectId
 *     AND next_review_date <= CURRENT_TIMESTAMP
 *   ORDER BY next_review_date ASC;
 *
 * Returns due cards (most-overdue first) then unseen (NEW, no record yet).
 * Fully decoupled — pass in any card list and the SRS records map.
 *
 * @param cards      Full card list for this set/subject
 * @param srsRecords The SRS store record map (cardId → SRSCard)
 * @param now        Current timestamp (override for testing)
 */
export function getStudyQueue<C extends { id: string }>(
  cards:      C[],
  srsRecords: Record<string, SRSCard>,
  now = Date.now(),
): { due: C[]; unseen: C[]; queue: C[] } {
  // Due cards: have a record and nextReviewDate <= now, sorted chronologically
  const due = cards
    .filter(c => {
      const r = srsRecords[c.id];
      return r != null && isDue(r, now);
    })
    .sort((a, b) =>
      (srsRecords[a.id]?.nextReviewDate ?? 0) - (srsRecords[b.id]?.nextReviewDate ?? 0),
    );

  // Unseen: no SRS record yet (brand-new cards, never reviewed)
  const unseen = cards.filter(c => srsRecords[c.id] == null);

  return { due, unseen, queue: [...due, ...unseen] };
}

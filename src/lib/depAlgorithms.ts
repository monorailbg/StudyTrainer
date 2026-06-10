import { CONCEPTS, CONCEPT_MAP, getUnlocks, type ConceptDef } from '../data/conceptGraph';

export interface EnrichedConcept extends ConceptDef {
  masteryScore: number;
  readinessScore: number;
  depth: number;
  unlockIds: string[];
}

// ── Transitive traversal ─────────────────────────────────────────────

/** All prerequisites recursively (ancestors) */
export function getAllPrereqs(conceptId: string, visited = new Set<string>()): Set<string> {
  if (visited.has(conceptId)) return visited;
  visited.add(conceptId);
  const def = CONCEPT_MAP.get(conceptId);
  if (!def) return visited;
  for (const p of def.prerequisites) getAllPrereqs(p, visited);
  visited.delete(conceptId); // only ancestors, not self
  return visited;
}

/** All descendants recursively (unlocks) */
export function getAllUnlocks(conceptId: string, visited = new Set<string>()): Set<string> {
  if (visited.has(conceptId)) return visited;
  visited.add(conceptId);
  for (const u of getUnlocks(conceptId)) getAllUnlocks(u.id, visited);
  visited.delete(conceptId);
  return visited;
}

// ── Readiness scoring ────────────────────────────────────────────────

/**
 * Readiness = average mastery of immediate prerequisites.
 * If no prerequisites, concept is always ready (score = 100).
 */
export function calcReadiness(
  conceptId: string,
  masteryGetter: (id: string) => number
): number {
  const def = CONCEPT_MAP.get(conceptId);
  if (!def || def.prerequisites.length === 0) return 100;
  const scores = def.prerequisites.map(masteryGetter);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ── Depth ────────────────────────────────────────────────────────────

function _depth(conceptId: string, cache: Map<string, number>): number {
  if (cache.has(conceptId)) return cache.get(conceptId)!;
  const def = CONCEPT_MAP.get(conceptId);
  if (!def || def.prerequisites.length === 0) {
    cache.set(conceptId, 1);
    return 1;
  }
  const d = 1 + Math.max(...def.prerequisites.map((p) => _depth(p, cache)));
  cache.set(conceptId, d);
  return d;
}

export function calcDepth(conceptId: string): number {
  return _depth(conceptId, new Map());
}

// ── Enrich ──────────────────────────────────────────────────────────

export function enrichConcepts(
  masteryGetter: (id: string) => number
): EnrichedConcept[] {
  const depthCache = new Map<string, number>();
  return CONCEPTS.map((c) => ({
    ...c,
    masteryScore: masteryGetter(c.id),
    readinessScore: calcReadiness(c.id, masteryGetter),
    depth: _depth(c.id, depthCache),
    unlockIds: getUnlocks(c.id).map((u) => u.id),
  }));
}

// ── Coverage metrics ─────────────────────────────────────────────────

export interface CoverageMetrics {
  total: number;
  mastered: number;   // >= 80
  partial: number;    // 40-79
  weak: number;       // 1-39
  locked: number;     // 0
  pctMastered: number;
  byCategory: Record<string, { mastered: number; total: number; pct: number }>;
}

export function calcCoverage(enriched: EnrichedConcept[]): CoverageMetrics {
  let mastered = 0, partial = 0, weak = 0, locked = 0;
  const byCategory: Record<string, { mastered: number; total: number }> = {};

  for (const c of enriched) {
    const cat = byCategory[c.category] ?? (byCategory[c.category] = { mastered: 0, total: 0 });
    cat.total++;
    if (c.masteryScore >= 80) { mastered++; cat.mastered++; }
    else if (c.masteryScore >= 40) partial++;
    else if (c.masteryScore > 0) weak++;
    else locked++;
  }

  const byCategoryFull: Record<string, { mastered: number; total: number; pct: number }> = {};
  for (const [k, v] of Object.entries(byCategory)) {
    byCategoryFull[k] = { ...v, pct: v.total > 0 ? (v.mastered / v.total) * 100 : 0 };
  }

  return {
    total: enriched.length,
    mastered, partial, weak, locked,
    pctMastered: enriched.length > 0 ? (mastered / enriched.length) * 100 : 0,
    byCategory: byCategoryFull,
  };
}

// ── Bottleneck analysis ──────────────────────────────────────────────

export interface BottleneckResult {
  concept: EnrichedConcept;
  descendantCount: number;
  impactScore: number; // descendantCount * (1 - mastery)
}

export function findBottlenecks(enriched: EnrichedConcept[]): BottleneckResult[] {
  return enriched
    .map((c) => {
      const descendants = getAllUnlocks(c.id).size;
      const impactScore = descendants * (1 - c.masteryScore / 100);
      return { concept: c, descendantCount: descendants, impactScore };
    })
    .filter((r) => r.descendantCount > 0)
    .sort((a, b) => b.impactScore - a.impactScore);
}

// ── High-leverage concepts ───────────────────────────────────────────

export interface LeverageResult {
  concept: EnrichedConcept;
  leverageScore: number;
}

export function findHighLeverage(enriched: EnrichedConcept[]): LeverageResult[] {
  return enriched
    .map((c) => {
      const descendants = getAllUnlocks(c.id).size;
      const difficultyWeight = c.difficulty === 'beginner' ? 1 : c.difficulty === 'intermediate' ? 2 : 3;
      const leverageScore = (descendants / difficultyWeight) * (c.readinessScore / 100);
      return { concept: c, leverageScore };
    })
    .filter((r) => r.leverageScore > 0 && r.concept.masteryScore < 80)
    .sort((a, b) => b.leverageScore - a.leverageScore);
}

// ── Learning path ────────────────────────────────────────────────────

/**
 * BFS: ordered list of concepts you need to study to reach the target,
 * starting from those with no unmet prerequisites.
 */
export function buildLearningPath(
  targetId: string,
  masteryGetter: (id: string) => number
): ConceptDef[] {
  const target = CONCEPT_MAP.get(targetId);
  if (!target) return [];

  // Collect all prerequisites transitively
  const needed = new Set<string>();
  function collect(id: string) {
    const def = CONCEPT_MAP.get(id);
    if (!def) return;
    for (const p of def.prerequisites) {
      if (!needed.has(p)) {
        needed.add(p);
        collect(p);
      }
    }
  }
  collect(targetId);
  needed.add(targetId);

  // Topological sort on the needed set
  const sorted: ConceptDef[] = [];
  const visited = new Set<string>();

  function topo(id: string) {
    if (visited.has(id) || !needed.has(id)) return;
    visited.add(id);
    const def = CONCEPT_MAP.get(id)!;
    for (const p of def.prerequisites) topo(p);
    sorted.push(def);
  }

  for (const id of needed) topo(id);

  // Return only concepts not yet mastered (< 80%)
  return sorted.filter((c) => masteryGetter(c.id) < 80);
}

// ── What-If simulation ───────────────────────────────────────────────

/**
 * Given a hypothetical mastery increase on conceptId,
 * return the list of concept ids that would newly become "unlocked"
 * (all prerequisites >= 60%).
 */
export function simulateWhatIf(
  conceptId: string,
  newScore: number,
  masteryGetter: (id: string) => number
): string[] {
  const overriddenGetter = (id: string) =>
    id === conceptId ? newScore : masteryGetter(id);

  const wasUnlocked = (id: string) =>
    CONCEPT_MAP.get(id)?.prerequisites.every((p) => masteryGetter(p) >= 60) ?? false;

  const wouldUnlock = (id: string) =>
    CONCEPT_MAP.get(id)?.prerequisites.every((p) => overriddenGetter(p) >= 60) ?? false;

  // Check all concepts that list conceptId as a prerequisite (transitive)
  const candidates = [...getAllUnlocks(conceptId)];
  return candidates.filter((id) => !wasUnlocked(id) && wouldUnlock(id));
}

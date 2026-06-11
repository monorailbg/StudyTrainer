import { CONCEPTS, CONCEPT_MAP, CATEGORY_COLORS } from '../data/conceptGraph';
import type { StoredNote, StoredFlashcardSet, StoredQuiz, QuizResult } from './db';
import type { EnrichedConcept } from './depAlgorithms';

export type PKGNodeType = 'concept' | 'note' | 'flashcard_set' | 'quiz' | 'mistake';

export type PKGRelationType =
  | 'related_to'
  | 'depends_on'
  | 'explains'
  | 'appears_in'
  | 'expands_on'
  | 'frequently_confused_with';

export interface PKGNode {
  id: string;
  type: PKGNodeType;
  label: string;
  subjectId?: string;
  conceptId?: string;
  description?: string;
  masteryScore?: number;
  category?: string;
  difficulty?: string;
  confusionCount?: number;
  createdAt: number;
}

export interface PKGEdge {
  id: string;
  source: string;
  target: string;
  relation: PKGRelationType;
  weight?: number;
  auto: boolean;
}

export interface PKGAnalytics {
  hubNodes: { node: PKGNode; degree: number }[];
  isolatedNodes: PKGNode[];
  confusionPairs: { nodeA: PKGNode; nodeB: PKGNode; count: number }[];
  knowledgeGaps: { node: PKGNode; degree: number; mastery: number }[];
  totalNodes: number;
  totalEdges: number;
  connectedComponents: number;
}

// Keyword match against CONCEPT_MAP names
export function extractConceptMentions(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [id, def] of CONCEPT_MAP.entries()) {
    if (lower.includes(def.name.toLowerCase())) found.push(id);
  }
  return found;
}

export function buildPKGNodes(
  enriched: EnrichedConcept[],
  notes: StoredNote[],
  flashcardSets: StoredFlashcardSet[],
  quizzes: StoredQuiz[],
  quizResults: QuizResult[],
): PKGNode[] {
  const nodes: PKGNode[] = [];

  for (const c of enriched) {
    nodes.push({
      id: `concept:${c.id}`,
      type: 'concept',
      label: c.name,
      conceptId: c.id,
      description: c.description,
      masteryScore: c.masteryScore,
      category: c.category,
      difficulty: c.difficulty,
      createdAt: 0,
    });
  }

  for (const n of notes) {
    nodes.push({ id: `note:${n.id}`, type: 'note', label: n.name, subjectId: n.subjectId, createdAt: n.createdAt });
  }

  for (const fc of flashcardSets) {
    nodes.push({ id: `fc:${fc.id}`, type: 'flashcard_set', label: fc.name, subjectId: fc.subjectId, createdAt: fc.createdAt });
  }

  for (const q of quizzes) {
    nodes.push({ id: `quiz:${q.id}`, type: 'quiz', label: q.name, subjectId: q.subjectId, createdAt: q.createdAt });
  }

  // Mistake nodes — group recurring wrong answers by concept mention
  const mistakeMap = new Map<string, number>();
  for (const result of quizResults) {
    for (const q of result.questions) {
      if (!q.wasCorrect) {
        for (const cid of extractConceptMentions(q.questionText + ' ' + q.correctAnswer)) {
          mistakeMap.set(cid, (mistakeMap.get(cid) ?? 0) + 1);
        }
      }
    }
  }
  for (const [cid, count] of mistakeMap) {
    if (count >= 2) {
      const def = CONCEPT_MAP.get(cid);
      if (def) {
        nodes.push({
          id: `mistake:${cid}`,
          type: 'mistake',
          label: `${def.name} errors`,
          conceptId: cid,
          confusionCount: count,
          createdAt: 0,
        });
      }
    }
  }

  return nodes;
}

export function buildPKGEdges(
  nodes: PKGNode[],
  notes: StoredNote[],
  flashcardSets: StoredFlashcardSet[],
  quizzes: StoredQuiz[],
  quizResults: QuizResult[],
): PKGEdge[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges: PKGEdge[] = [];

  // depends_on: concept prerequisite edges from CONCEPT_MAP
  for (const c of CONCEPTS) {
    for (const prereq of c.prerequisites) {
      const src = `concept:${prereq}`;
      const tgt = `concept:${c.id}`;
      if (nodeIds.has(src) && nodeIds.has(tgt)) {
        edges.push({ id: `dep:${prereq}→${c.id}`, source: src, target: tgt, relation: 'depends_on', auto: true });
      }
    }
  }

  // appears_in: note → concept via keyword match on note name
  for (const n of notes) {
    for (const cid of extractConceptMentions(n.name)) {
      const src = `note:${n.id}`;
      const tgt = `concept:${cid}`;
      if (nodeIds.has(src) && nodeIds.has(tgt)) {
        edges.push({ id: `note-c:${n.id}→${cid}`, source: src, target: tgt, relation: 'appears_in', auto: true });
      }
    }
  }

  // explains: flashcard_set → concept
  for (const fc of flashcardSets) {
    for (const cid of extractConceptMentions(fc.name)) {
      const src = `fc:${fc.id}`;
      const tgt = `concept:${cid}`;
      if (nodeIds.has(src) && nodeIds.has(tgt)) {
        edges.push({ id: `fc-c:${fc.id}→${cid}`, source: src, target: tgt, relation: 'explains', auto: true });
      }
    }
  }

  // appears_in: quiz → concept
  for (const q of quizzes) {
    for (const cid of extractConceptMentions(q.name)) {
      const src = `quiz:${q.id}`;
      const tgt = `concept:${cid}`;
      if (nodeIds.has(src) && nodeIds.has(tgt)) {
        edges.push({ id: `quiz-c:${q.id}→${cid}`, source: src, target: tgt, relation: 'appears_in', auto: true });
      }
    }
  }

  // related_to: mistake → concept
  for (const node of nodes) {
    if (node.type === 'mistake' && node.conceptId) {
      const src = node.id;
      const tgt = `concept:${node.conceptId}`;
      if (nodeIds.has(src) && nodeIds.has(tgt)) {
        edges.push({ id: `mistake-c:${node.conceptId}`, source: src, target: tgt, relation: 'related_to', auto: true });
      }
    }
  }

  // frequently_confused_with: concept pairs co-occurring in wrong answers
  const confMap = new Map<string, number>();
  for (const result of quizResults) {
    for (const q of result.questions) {
      if (!q.wasCorrect) {
        const mentions = extractConceptMentions(q.questionText);
        for (let i = 0; i < mentions.length; i++) {
          for (let j = i + 1; j < mentions.length; j++) {
            const key = [mentions[i], mentions[j]].sort().join('|');
            confMap.set(key, (confMap.get(key) ?? 0) + 1);
          }
        }
      }
    }
  }
  for (const [key, count] of confMap) {
    if (count >= 2) {
      const [a, b] = key.split('|');
      const src = `concept:${a}`;
      const tgt = `concept:${b}`;
      if (nodeIds.has(src) && nodeIds.has(tgt)) {
        edges.push({ id: `conf:${key}`, source: src, target: tgt, relation: 'frequently_confused_with', weight: count, auto: true });
      }
    }
  }

  return edges;
}

// Category-column layout for concepts; content types in additional columns
export function layoutPKGNodes(nodes: PKGNode[]): Record<string, { x: number; y: number }> {
  const colW = 240;
  const rowH = 130;
  const positions: Record<string, { x: number; y: number }> = {};

  const conceptsByCategory: Record<string, PKGNode[]> = {};
  for (const n of nodes) {
    if (n.type === 'concept') {
      const cat = n.category ?? 'Other';
      if (!conceptsByCategory[cat]) conceptsByCategory[cat] = [];
      conceptsByCategory[cat].push(n);
    }
  }

  let colIdx = 0;
  for (const group of Object.values(conceptsByCategory)) {
    group.forEach((n, rowIdx) => { positions[n.id] = { x: colIdx * colW, y: rowIdx * rowH }; });
    colIdx++;
  }

  const contentTypes: PKGNodeType[] = ['note', 'flashcard_set', 'quiz', 'mistake'];
  for (const type of contentTypes) {
    const group = nodes.filter(n => n.type === type);
    if (group.length === 0) continue;
    group.forEach((n, rowIdx) => { positions[n.id] = { x: colIdx * colW, y: rowIdx * rowH }; });
    colIdx++;
  }

  return positions;
}

export function computePKGAnalytics(nodes: PKGNode[], edges: PKGEdge[]): PKGAnalytics {
  const degreeMap = new Map<string, number>(nodes.map(n => [n.id, 0]));
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const hubNodes = nodes
    .map(n => ({ node: n, degree: degreeMap.get(n.id) ?? 0 }))
    .filter(x => x.degree >= 3)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);

  const isolatedNodes = nodes.filter(n => (degreeMap.get(n.id) ?? 0) === 0);

  const confusionPairs = edges
    .filter(e => e.relation === 'frequently_confused_with')
    .map(e => ({ nodeA: nodeMap.get(e.source)!, nodeB: nodeMap.get(e.target)!, count: e.weight ?? 1 }))
    .filter(x => x.nodeA && x.nodeB)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const knowledgeGaps = nodes
    .filter(n => n.type === 'concept' && (n.masteryScore ?? 0) < 40)
    .map(n => ({ node: n, degree: degreeMap.get(n.id) ?? 0, mastery: n.masteryScore ?? 0 }))
    .filter(x => x.degree >= 2)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);

  // Union-Find for connected component count
  const parent = new Map<string, string>(nodes.map(n => [n.id, n.id]));
  function find(x: string): string {
    const p = parent.get(x) ?? x;
    if (p !== x) { const r = find(p); parent.set(x, r); return r; }
    return p;
  }
  for (const e of edges) {
    const px = find(e.source), py = find(e.target);
    if (px !== py) parent.set(px, py);
  }
  const connectedComponents = new Set(nodes.map(n => find(n.id))).size;

  return {
    hubNodes, isolatedNodes, confusionPairs, knowledgeGaps,
    totalNodes: nodes.length, totalEdges: edges.length, connectedComponents,
  };
}

export function searchPKG(nodes: PKGNode[], query: string): Set<string> {
  if (!query.trim()) return new Set(nodes.map(n => n.id));
  const q = query.toLowerCase();
  return new Set(
    nodes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      (n.description ?? '').toLowerCase().includes(q) ||
      (n.category ?? '').toLowerCase().includes(q) ||
      n.type.replace(/_/g, ' ').includes(q)
    ).map(n => n.id)
  );
}

export function getNeighborIds(nodeId: string, edges: PKGEdge[]): string[] {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId) out.add(e.target);
    if (e.target === nodeId) out.add(e.source);
  }
  return [...out];
}

export { CATEGORY_COLORS };

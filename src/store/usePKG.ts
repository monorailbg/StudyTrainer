import { create } from 'zustand';
import { getAllNotes, getAllFlashcardSets, getAllQuizzes, getAllQuizResults } from '../lib/db';
import { getAllCloudNotes, getAllCloudFlashcardSets, getAllCloudQuizzes, isFirebaseConfigured } from '../lib/cloudDb';
import { enrichConcepts } from '../lib/depAlgorithms';
import { useDependencies } from './useDependencies';
import {
  buildPKGNodes,
  buildPKGEdges,
  layoutPKGNodes,
  computePKGAnalytics,
  searchPKG,
  type PKGNode,
  type PKGEdge,
  type PKGAnalytics,
  type PKGNodeType,
} from '../lib/pkgEngine';

interface PKGState {
  loaded: boolean;
  nodes: PKGNode[];
  edges: PKGEdge[];
  positions: Record<string, { x: number; y: number }>;
  analytics: PKGAnalytics | null;
  selectedNodeId: string | null;
  searchQuery: string;
  visibleTypes: Set<PKGNodeType>;
  matchingIds: Set<string>;

  load: () => Promise<void>;
  selectNode: (id: string | null) => void;
  setSearch: (query: string) => void;
  toggleVisibleType: (type: PKGNodeType) => void;
}

const ALL_TYPES: PKGNodeType[] = ['concept', 'note', 'flashcard_set', 'quiz', 'mistake'];

export const usePKG = create<PKGState>((set, get) => ({
  loaded: false,
  nodes: [],
  edges: [],
  positions: {},
  analytics: null,
  selectedNodeId: null,
  searchQuery: '',
  visibleTypes: new Set(ALL_TYPES),
  matchingIds: new Set(),

  load: async () => {
    try {
      const [notes, flashcardSets, quizzes, quizResults] = await Promise.all([
        isFirebaseConfigured ? getAllCloudNotes() : getAllNotes(),
        isFirebaseConfigured ? getAllCloudFlashcardSets() : getAllFlashcardSets(),
        isFirebaseConfigured ? getAllCloudQuizzes() : getAllQuizzes(),
        getAllQuizResults(),
      ]);
      const getMastery = useDependencies.getState().getMastery;
      const enriched = enrichConcepts(getMastery);
      const nodes = buildPKGNodes(enriched, notes, flashcardSets, quizzes, quizResults);
      const edges = buildPKGEdges(nodes, notes, flashcardSets, quizzes, quizResults);
      const positions = layoutPKGNodes(nodes);
      const analytics = computePKGAnalytics(nodes, edges);
      const matchingIds = searchPKG(nodes, get().searchQuery);
      set({ loaded: true, nodes, edges, positions, analytics, matchingIds });
    } catch {
      set({ loaded: true });
    }
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  setSearch: (query) => {
    const { nodes } = get();
    const matchingIds = searchPKG(nodes, query);
    set({ searchQuery: query, matchingIds });
  },

  toggleVisibleType: (type) => {
    const { visibleTypes } = get();
    const next = new Set(visibleTypes);
    if (next.has(type)) next.delete(type); else next.add(type);
    set({ visibleTypes: next });
  },
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ConceptMastery {
  conceptId: string;
  masteryScore: number; // 0-100
  attempts: number;
  lastReviewed: number | null; // timestamp
}

interface DependenciesState {
  masteryMap: Record<string, ConceptMastery>;
  selectedConceptId: string | null;
  highlightPrereqs: Set<string>;
  highlightUnlocks: Set<string>;
  searchQuery: string;
  targetConceptId: string | null;
  whatIfConceptId: string | null;
  whatIfScore: number;

  // Actions
  setMastery: (conceptId: string, score: number) => void;
  selectConcept: (id: string | null, allPrereqs?: Set<string>, allUnlocks?: Set<string>) => void;
  clearSelection: () => void;
  setSearchQuery: (q: string) => void;
  setTargetConcept: (id: string | null) => void;
  setWhatIf: (conceptId: string | null, score?: number) => void;
  getMastery: (conceptId: string) => number;
}

export const useDependencies = create<DependenciesState>()(
  persist(
    (set, get) => ({
      masteryMap: {},
      selectedConceptId: null,
      highlightPrereqs: new Set(),
      highlightUnlocks: new Set(),
      searchQuery: '',
      targetConceptId: null,
      whatIfConceptId: null,
      whatIfScore: 0,

      setMastery: (conceptId, score) =>
        set((s) => ({
          masteryMap: {
            ...s.masteryMap,
            [conceptId]: {
              conceptId,
              masteryScore: Math.max(0, Math.min(100, score)),
              attempts: (s.masteryMap[conceptId]?.attempts ?? 0) + 1,
              lastReviewed: Date.now(),
            },
          },
        })),

      selectConcept: (id, allPrereqs = new Set(), allUnlocks = new Set()) =>
        set({
          selectedConceptId: id,
          highlightPrereqs: allPrereqs,
          highlightUnlocks: allUnlocks,
        }),

      clearSelection: () =>
        set({
          selectedConceptId: null,
          highlightPrereqs: new Set(),
          highlightUnlocks: new Set(),
        }),

      setSearchQuery: (q) => set({ searchQuery: q }),

      setTargetConcept: (id) => set({ targetConceptId: id }),

      setWhatIf: (conceptId, score = 80) =>
        set({ whatIfConceptId: conceptId, whatIfScore: score }),

      getMastery: (conceptId) =>
        get().masteryMap[conceptId]?.masteryScore ?? 0,
    }),
    {
      name: 'study-trainer-dependencies',
      // Don't persist transient UI state
      partialize: (s) => ({
        masteryMap: s.masteryMap,
      }),
    }
  )
);

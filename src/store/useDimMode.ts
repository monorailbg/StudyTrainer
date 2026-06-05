import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Shared "dim reading mode" preference. One global flag, persisted, consumed by
// the Notes, Flashcards and Quiz pages so the moon toggle stays in sync as the
// user moves between them.
interface DimModeStore {
  dim: boolean;
  toggle: () => void;
  setDim: (v: boolean) => void;
}

export const useDimMode = create<DimModeStore>()(
  persist(
    (set) => ({
      dim: false,
      toggle: () => set((s) => ({ dim: !s.dim })),
      setDim: (v) => set({ dim: v }),
    }),
    { name: 'dimMode' },
  ),
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Annotation {
  id: string;
  noteId: string;
  sectionIndex: number;
  type: 'highlight' | 'underline';
  color?: string;
  selectedText: string;
  createdAt: number;
}

interface AnnotationsState {
  annotations: Annotation[];
  add: (ann: Omit<Annotation, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  getForSection: (noteId: string, sectionIndex: number) => Annotation[];
}

export const useAnnotations = create<AnnotationsState>()(
  persist(
    (set, get) => ({
      annotations: [],
      add: (ann) => {
        const newAnn: Annotation = {
          ...ann,
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          createdAt: Date.now(),
        };
        set(s => ({ annotations: [...s.annotations, newAnn] }));
      },
      remove: (id) => set(s => ({ annotations: s.annotations.filter(a => a.id !== id) })),
      getForSection: (noteId, sectionIndex) =>
        get().annotations.filter(a => a.noteId === noteId && a.sectionIndex === sectionIndex),
    }),
    { name: 'gbs-annotations-v1' }
  )
);

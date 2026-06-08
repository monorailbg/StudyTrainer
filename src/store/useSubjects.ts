import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CORE_SUBJECTS,
  ALL_SUBJECTS,
  type SubjectDef,
} from '../data/subjects';

// Which built-in subjects are "core" by default. The user can re-assign any
// subject between core / extended, which is tracked in `coreOverrides`.
const DEFAULT_CORE_IDS = new Set(CORE_SUBJECTS.map(s => s.id));

// Palette offered when creating a new subject.
export const SUBJECT_COLORS = [
  '#3D7EFF', '#60a5fa', '#4ade80', '#34d399', '#22d3ee',
  '#c084fc', '#a78bfa', '#818cf8', '#f472b6', '#f87171',
  '#fb923c', '#fbbf24', '#d4a843', '#2dd4bf', '#e879f9',
];

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Spread a new subject somewhere on the globe so its pin doesn't stack on
// existing ones. Deterministic-ish random is fine here.
function randomCoord() {
  return {
    lat: Math.round((Math.random() * 140 - 70) * 100) / 100,
    lng: Math.round((Math.random() * 360 - 180) * 100) / 100,
  };
}

export interface NewSubjectInput {
  title: string;
  description: string;
  color: string;
  isCore: boolean;
}

// Fields a user can override on any subject (built-in or custom).
export type SubjectEdit = Partial<Pick<SubjectDef, 'title' | 'description' | 'color' | 'icon'>>;

interface SubjectsStore {
  customSubjects: SubjectDef[];
  deletedIds: string[];
  coreOverrides: Record<string, boolean>;
  edits: Record<string, SubjectEdit>;

  addSubject: (input: NewSubjectInput) => void;
  deleteSubject: (id: string) => void;
  setCore: (id: string, core: boolean) => void;
  editSubject: (id: string, patch: SubjectEdit) => void;
  restoreDefaults: () => void;
}

export const useSubjects = create<SubjectsStore>()(
  persist(
    (set) => ({
      customSubjects: [],
      deletedIds: [],
      coreOverrides: {},
      edits: {},

      addSubject: (input) =>
        set((s) => {
          const base = slugify(input.title) || 'subject';
          let id = base;
          const taken = new Set([...ALL_SUBJECTS.map(x => x.id), ...s.customSubjects.map(x => x.id)]);
          let n = 2;
          while (taken.has(id)) id = `${base}-${n++}`;
          const { lat, lng } = randomCoord();
          const subject: SubjectDef = {
            id,
            title: input.title.trim(),
            description: input.description.trim(),
            color: input.color,
            lat, lng,
          };
          return {
            customSubjects: [...s.customSubjects, subject],
            coreOverrides: { ...s.coreOverrides, [id]: input.isCore },
          };
        }),

      deleteSubject: (id) =>
        set((s) => ({
          deletedIds: s.deletedIds.includes(id) ? s.deletedIds : [...s.deletedIds, id],
          customSubjects: s.customSubjects.filter(c => c.id !== id),
        })),

      setCore: (id, core) =>
        set((s) => ({ coreOverrides: { ...s.coreOverrides, [id]: core } })),

      editSubject: (id, patch) =>
        set((s) => {
          // Drop empty-string / undefined fields so an edit never blanks a value.
          const clean: SubjectEdit = {};
          if (patch.title?.trim())       clean.title = patch.title.trim();
          if (patch.description !== undefined) clean.description = patch.description.trim();
          if (patch.color)               clean.color = patch.color;
          if (patch.icon)               clean.icon = patch.icon;
          return { edits: { ...s.edits, [id]: { ...s.edits[id], ...clean } } };
        }),

      restoreDefaults: () =>
        set({ customSubjects: [], deletedIds: [], coreOverrides: {}, edits: {} }),
    }),
    { name: 'study-trainer-subjects' }
  )
);

// Resolve the persisted overrides against the built-in defaults into the
// effective core / extended / full lists that the UI renders.
export function useResolvedSubjects() {
  const { customSubjects, deletedIds, coreOverrides, edits } = useSubjects();

  const isCore = (s: SubjectDef) => coreOverrides[s.id] ?? DEFAULT_CORE_IDS.has(s.id);

  const { allSubjects, coreSubjects, extendedSubjects } = useMemo(() => {
    const all = [...ALL_SUBJECTS, ...customSubjects]
      .filter(s => !deletedIds.includes(s.id))
      .map(s => (edits[s.id] ? { ...s, ...edits[s.id] } : s));
    const core = all.filter(isCore);
    const extended = all.filter(s => !isCore(s));
    return { allSubjects: all, coreSubjects: core, extendedSubjects: extended };
  }, [customSubjects, deletedIds, coreOverrides, edits]);

  return { allSubjects, coreSubjects, extendedSubjects, isCore };
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BookmarksStore {
  bookmarks: Record<string, string[]>; // subjectId → cardId[]
  toggle:       (subjectId: string, cardId: string) => void;
  isBookmarked: (subjectId: string, cardId: string) => boolean;
}

export const useBookmarks = create<BookmarksStore>()(
  persist(
    (set, get) => ({
      bookmarks: {},
      toggle: (subjectId, cardId) =>
        set(s => {
          const cur  = s.bookmarks[subjectId] ?? [];
          const next = cur.includes(cardId) ? cur.filter(id => id !== cardId) : [...cur, cardId];
          return { bookmarks: { ...s.bookmarks, [subjectId]: next } };
        }),
      isBookmarked: (subjectId, cardId) =>
        (get().bookmarks[subjectId] ?? []).includes(cardId),
    }),
    { name: 'study-trainer-bookmarks' },
  ),
);

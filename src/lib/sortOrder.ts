// Shared comparator for content lists that support manual drag-to-reorder
// (an optional `order` field) with a fallback comparator for items that have
// never been manually reordered (or predate the `order` field entirely).
// Never-ordered items sort ahead of manually-ordered ones — a freshly
// generated item should stay prominent rather than disappearing into
// whatever position its creation order happens to fall at.
export function withManualOrder<T extends { order?: number }>(
  fallback: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    if (a.order !== undefined) return 1;
    if (b.order !== undefined) return -1;
    return fallback(a, b);
  };
}

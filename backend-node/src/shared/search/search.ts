/** Normalize free-text search query. Empty → null (caller skips filter). */
export function normalizeSearchQuery(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const q = raw.trim().replace(/\s+/g, ' ');
  return q.length === 0 ? null : q;
}

/**
 * Escape SQLite LIKE wildcards so user input is treated literally,
 * then wrap with % for contains matching.
 */
export function toContainsPattern(query: string): string {
  const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `%${escaped}%`;
}

export function buildOrContainsFilters<T extends string>(
  fields: readonly T[],
  query: string | null,
): Array<Record<T, { contains: string }> | null> {
  if (!query) return [];
  return fields.map((field) => ({ [field]: { contains: query } }) as Record<T, { contains: string }>);
}
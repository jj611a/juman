export type SortDirection = 'asc' | 'desc';

export interface SortClause {
  readonly field: string;
  readonly direction: SortDirection;
}

export function normalizeSort(
  field: string | null | undefined,
  direction: string | null | undefined,
  allowedFields: ReadonlySet<string>,
  fallback: SortClause,
): SortClause {
  if (!field) return fallback;
  if (!allowedFields.has(field)) {
    throw new Error(`Sort field not allowed: ${field}`);
  }
  const dir = (direction ?? 'asc').toLowerCase();
  if (dir !== 'asc' && dir !== 'desc') {
    throw new Error(`Sort direction must be asc or desc`);
  }
  return { field, direction: dir };
}

export function sortToOrderBy(clause: SortClause): Record<string, SortDirection> {
  return { [clause.field]: clause.direction };
}
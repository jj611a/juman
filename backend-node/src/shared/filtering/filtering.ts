export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';

export interface FilterClause {
  readonly field: string;
  readonly op: FilterOperator;
  readonly value: unknown;
}

const ALLOWED_OPS = new Set<FilterOperator>([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'contains',
]);

export function assertFilterClause(
  clause: FilterClause,
  allowedFields: ReadonlySet<string>,
): FilterClause {
  if (!allowedFields.has(clause.field)) {
    throw new Error(`Filter field not allowed: ${clause.field}`);
  }
  if (!ALLOWED_OPS.has(clause.op)) {
    throw new Error(`Filter operator not allowed: ${clause.op}`);
  }
  return clause;
}

/** Map filter clauses into a shallow Prisma-like where fragment (AND). */
export function filtersToWhere(
  clauses: readonly FilterClause[],
  allowedFields: ReadonlySet<string>,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const raw of clauses) {
    const clause = assertFilterClause(raw, allowedFields);
    switch (clause.op) {
      case 'eq':
        where[clause.field] = clause.value;
        break;
      case 'neq':
        where[clause.field] = { not: clause.value };
        break;
      case 'gt':
        where[clause.field] = { gt: clause.value };
        break;
      case 'gte':
        where[clause.field] = { gte: clause.value };
        break;
      case 'lt':
        where[clause.field] = { lt: clause.value };
        break;
      case 'lte':
        where[clause.field] = { lte: clause.value };
        break;
      case 'in':
        where[clause.field] = { in: clause.value };
        break;
      case 'contains':
        where[clause.field] = { contains: String(clause.value) };
        break;
    }
  }
  return where;
}
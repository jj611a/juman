import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  PAGINATION_MIN_LIMIT,
} from '../constants/business.constants';
import { BusinessException } from '../errors/business.exception';

export interface PaginationInput {
  readonly offset?: number;
  readonly limit?: number;
}

export interface PaginationParams {
  readonly offset: number;
  readonly limit: number;
}

export interface PaginationMeta extends PaginationParams {
  readonly total: number;
}

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly meta: PaginationMeta;
}

export function normalizePagination(input: PaginationInput = {}): PaginationParams {
  const offset = input.offset ?? 0;
  const limit = input.limit ?? PAGINATION_DEFAULT_LIMIT;
  if (!Number.isInteger(offset) || offset < 0) {
    throw BusinessException.validation('offset must be an integer >= 0');
  }
  if (
    !Number.isInteger(limit) ||
    limit < PAGINATION_MIN_LIMIT ||
    limit > PAGINATION_MAX_LIMIT
  ) {
    throw BusinessException.validation(
      `limit must be between ${PAGINATION_MIN_LIMIT} and ${PAGINATION_MAX_LIMIT}`,
    );
  }
  return { offset, limit };
}

export function paginated<T>(
  items: readonly T[],
  total: number,
  params: PaginationParams,
): Paginated<T> {
  return {
    items,
    meta: { ...params, total },
  };
}
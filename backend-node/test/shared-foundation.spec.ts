import { describe, expect, it } from 'vitest';
import {
  addFils,
  assertFils,
  assertNonNegativeFils,
  filsToMajorString,
  majorToFils,
  subtractFils,
  toFils,
} from '../src/shared/money/money';
import { normalizePagination, paginated } from '../src/shared/pagination/pagination';
import { normalizeSearchQuery, toContainsPattern, buildOrContainsFilters } from '../src/shared/search/search';
import { filtersToWhere } from '../src/shared/filtering/filtering';
import { normalizeSort, sortToOrderBy } from '../src/shared/sorting/sorting';
import { isSoftDeleted, liveWhere, restoreSoftDeleteData, softDeleteData } from '../src/shared/soft-delete/soft-delete';
import { assertUuid, isUuid, newUuid } from '../src/shared/uuid/uuid';
import {
  addUtcDays,
  defaultBusinessTimezone,
  nowUtc,
  parseIsoDate,
  startOfUtcDay,
  toIsoUtc,
} from '../src/shared/datetime/datetime';
import { assertDefined, assertInRange, assertMatch, assertNonEmptyString } from '../src/shared/validation/assert';
import { parseOptionalBoolean } from '../src/shared/validation/parse-boolean';
import { operatorMessage, t } from '../src/shared/localization/messages';
import { err, isErr, isOk, ok, unwrap } from '../src/shared/result/result';
import { BusinessException } from '../src/shared/errors/business.exception';
import { DOMAIN_ERROR_CODE } from '../src/shared/errors/domain.errors';

describe('shared money', () => {
  it('handles fils arithmetic and display', () => {
    const a = toFils(1500);
    const b = assertFils(500);
    expect(addFils(a, b)).toBe(2000);
    expect(subtractFils(a, b)).toBe(1000);
    expect(assertNonNegativeFils(a)).toBe(1500);
    expect(filsToMajorString(a)).toBe('1.500');
    expect(majorToFils('2.250')).toBe(2250);
    expect(majorToFils(1.5)).toBe(1500);
    expect(() => assertFils(1.5)).toThrow(BusinessException);
    expect(() => assertNonNegativeFils(toFils(-1))).toThrow(BusinessException);
    expect(() => majorToFils('')).toThrow(BusinessException);
    expect(() => majorToFils('abc')).toThrow(BusinessException);
    expect(() => majorToFils(Number.NaN)).toThrow(BusinessException);
  });
});

describe('shared pagination/search/filter/sort', () => {
  it('normalizes pagination', () => {
    expect(normalizePagination({})).toEqual({ offset: 0, limit: 50 });
    expect(normalizePagination({ offset: 10, limit: 20 })).toEqual({ offset: 10, limit: 20 });
    expect(() => normalizePagination({ offset: -1 })).toThrow(BusinessException);
    expect(() => normalizePagination({ limit: 999 })).toThrow(BusinessException);
    expect(paginated([1], 1, { offset: 0, limit: 50 }).meta.total).toBe(1);
  });

  it('builds search helpers', () => {
    expect(normalizeSearchQuery('  a  b ')).toBe('a b');
    expect(normalizeSearchQuery('   ')).toBeNull();
    expect(toContainsPattern('a%b_')).toBe('%a\\%b\\_%');
    expect(buildOrContainsFilters(['name', 'code'], null)).toEqual([]);
    expect(buildOrContainsFilters(['name'], 'x')).toEqual([{ name: { contains: 'x' } }]);
  });

  it('maps filters and sorts', () => {
    const allowed = new Set(['price', 'name']);
    expect(
      filtersToWhere(
        [
          { field: 'price', op: 'gte', value: 1 },
          { field: 'name', op: 'contains', value: 'a' },
          { field: 'price', op: 'eq', value: 2 },
          { field: 'price', op: 'neq', value: 3 },
          { field: 'price', op: 'gt', value: 0 },
          { field: 'price', op: 'lt', value: 9 },
          { field: 'price', op: 'lte', value: 8 },
          { field: 'price', op: 'in', value: [1, 2] },
        ],
        allowed,
      ),
    ).toMatchObject({ price: { in: [1, 2] }, name: { contains: 'a' } });
    expect(() => filtersToWhere([{ field: 'x', op: 'eq', value: 1 }], allowed)).toThrow();
    const sort = normalizeSort('name', 'desc', allowed, { field: 'name', direction: 'asc' });
    expect(sortToOrderBy(sort)).toEqual({ name: 'desc' });
    expect(normalizeSort(null, null, allowed, { field: 'name', direction: 'asc' }).field).toBe('name');
    expect(() => normalizeSort('bad', 'asc', allowed, { field: 'name', direction: 'asc' })).toThrow();
    expect(() => normalizeSort('name', 'sideways', allowed, { field: 'name', direction: 'asc' })).toThrow();
  });
});

describe('shared soft-delete uuid datetime validation result i18n', () => {
  it('soft-delete helpers', () => {
    expect(liveWhere({ id: '1' })).toEqual({ id: '1', deletedAt: null });
    expect(isSoftDeleted({ deletedAt: null })).toBe(false);
    expect(isSoftDeleted({ deletedAt: new Date() })).toBe(true);
    expect(softDeleteData().deletedAt).toBeInstanceOf(Date);
    expect(restoreSoftDeleteData()).toEqual({ deletedAt: null });
  });

  it('uuid helpers', () => {
    const id = newUuid();
    expect(isUuid(id)).toBe(true);
    expect(assertUuid(id)).toBe(id);
    expect(() => assertUuid('nope')).toThrow();
  });

  it('datetime helpers', () => {
    const n = nowUtc();
    expect(toIsoUtc(n)).toContain('T');
    expect(parseIsoDate(n.toISOString()).getTime()).toBe(n.getTime());
    expect(() => parseIsoDate('bad')).toThrow();
    expect(startOfUtcDay(n).getUTCHours()).toBe(0);
    expect(addUtcDays(n, 1).getTime()).toBeGreaterThan(n.getTime());
    expect(defaultBusinessTimezone()).toBe('Asia/Baghdad');
  });

  it('validation helpers', () => {
    expect(assertDefined('x', 'missing')).toBe('x');
    expect(() => assertDefined(null, 'missing')).toThrow(BusinessException);
    expect(assertNonEmptyString(' a ', 'f')).toBe('a');
    expect(() => assertNonEmptyString('  ', 'f')).toThrow(BusinessException);
    expect(assertInRange(5, 1, 10, 'n')).toBe(5);
    expect(() => assertInRange(0, 1, 10, 'n')).toThrow(BusinessException);
    expect(assertMatch('AB', /^[A-Z]+$/, 'bad')).toBe('AB');
    expect(() => assertMatch('1', /^[A-Z]+$/, 'bad')).toThrow(BusinessException);
  });

  it('result wrappers and messages', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('e'))).toBe(true);
    expect(unwrap(ok(2))).toBe(2);
    expect(() => unwrap(err('boom'))).toThrow(/boom/);
    expect(t('error.not_found')).toContain('غير');
    expect(t('error.not_found', 'en')).toBe('Not found');
    expect(operatorMessage('barcode.taken')).toBeTruthy();
    expect(t('unknown.key')).toBe('unknown.key');
  });

  it('business exception factories', () => {
    expect(BusinessException.notFound('x').getStatus()).toBe(404);
    expect(BusinessException.conflict('x').getStatus()).toBe(409);
    expect(BusinessException.validation('x').domainCode).toBe(DOMAIN_ERROR_CODE.VALIDATION);
    expect(BusinessException.invariant('x').getStatus()).toBe(422);
  });

  it('parses optional booleans from query forms', () => {
    expect(parseOptionalBoolean(undefined)).toBeUndefined();
    expect(parseOptionalBoolean('')).toBeUndefined();
    expect(parseOptionalBoolean(true)).toBe(true);
    expect(parseOptionalBoolean(false)).toBe(false);
    expect(parseOptionalBoolean(1)).toBe(true);
    expect(parseOptionalBoolean(0)).toBe(false);
    expect(parseOptionalBoolean(2)).toBeUndefined();
    expect(parseOptionalBoolean('true')).toBe(true);
    expect(parseOptionalBoolean('FALSE')).toBe(false);
    expect(parseOptionalBoolean('yes')).toBe(true);
    expect(parseOptionalBoolean('no')).toBe(false);
    expect(parseOptionalBoolean('maybe')).toBeUndefined();
  });

});

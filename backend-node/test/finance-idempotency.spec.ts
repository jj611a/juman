import { describe, expect, it, vi } from 'vitest';
import {
  beginIdempotency,
  completeIdempotency,
  hashIdempotencyPayload,
  IDEMPOTENCY_SCOPE,
} from '../src/finance/idempotency/idempotency';
import { BusinessException } from '../src/shared/errors/business.exception';

function mockTx(store: Map<string, Record<string, unknown>>) {
  return {
    financeIdempotencyKey: {
      findUnique: vi.fn(async ({ where }: { where: { scope_key: { scope: string; key: string } } }) => {
        const k = `${where.scope_key.scope}::${where.scope_key.key}`;
        return store.get(k) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const k = `${data.scope}::${data.key}`;
        store.set(k, { ...data, status: 'processing' });
        return data;
      }),
      update: vi.fn(async ({
        where,
        data,
      }: {
        where: { scope_key: { scope: string; key: string } };
        data: Record<string, unknown>;
      }) => {
        const k = `${where.scope_key.scope}::${where.scope_key.key}`;
        const prev = store.get(k) ?? {};
        const next = { ...prev, ...data };
        store.set(k, next);
        return next;
      }),
    },
  };
}

describe('finance idempotency', () => {
  it('rejects invalid keys and hash reuse conflicts', async () => {
    const store = new Map<string, Record<string, unknown>>();
    const tx = mockTx(store);
    await expect(
      beginIdempotency(tx as never, {
        scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
        key: '',
        requestHash: 'a',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await beginIdempotency(tx as never, {
      scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
      key: 'k1',
      requestHash: 'hash-a',
    });
    await completeIdempotency(tx as never, {
      scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
      key: 'k1',
      response: { ok: true },
    });

    await expect(
      beginIdempotency(tx as never, {
        scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
        key: 'k1',
        requestHash: 'hash-b',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    const replay = await beginIdempotency<{ ok: boolean }>(tx as never, {
      scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
      key: 'k1',
      requestHash: 'hash-a',
    });
    expect(replay.kind).toBe('replay');

    store.set(`${IDEMPOTENCY_SCOPE.FINANCE_CHARGE}::proc`, {
      scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
      key: 'proc',
      requestHash: 'h',
      status: 'processing',
    });
    await expect(
      beginIdempotency(tx as never, {
        scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
        key: 'proc',
        requestHash: 'h',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    store.set(`${IDEMPOTENCY_SCOPE.FINANCE_CHARGE}::bad`, {
      scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
      key: 'bad',
      requestHash: 'h',
      status: 'failed',
    });
    await expect(
      beginIdempotency(tx as never, {
        scope: IDEMPOTENCY_SCOPE.FINANCE_CHARGE,
        key: 'bad',
        requestHash: 'h',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    expect(hashIdempotencyPayload({ z: 1 })).toHaveLength(64);
  });
});

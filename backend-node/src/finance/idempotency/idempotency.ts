import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { BusinessException } from '../../shared/errors/business.exception';

export const IDEMPOTENCY_SCOPE = {
  RENTAL_CHECKOUT: 'rental.checkout',
  SETTLEMENT_PAYMENT: 'settlement.payment',
  FINANCE_CHARGE: 'finance.charge',
  FINANCE_DEPOSIT: 'finance.deposit',
  SALE_CONFIRM: 'sale.confirm',
  SALE_COMPLETE: 'sale.complete',
  SALE_PAYMENT: 'sale.payment',
  SALE_CANCEL: 'sale.cancel',
} as const;

export type IdempotencyScope =
  (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];

export function hashIdempotencyPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export type IdempotencyBeginResult<T> =
  | { kind: 'replay'; response: T }
  | { kind: 'proceed' };

/**
 * Begin idempotent work inside an outer TX.
 * Replay returns prior JSON when the same scope+key completed with matching hash.
 */
export async function beginIdempotency<T>(
  tx: Prisma.TransactionClient,
  input: {
    scope: IdempotencyScope | string;
    key: string;
    requestHash: string;
  },
): Promise<IdempotencyBeginResult<T>> {
  const key = input.key.trim();
  if (!key || key.length > 128) {
    throw BusinessException.validation('Invalid idempotency key');
  }

  const existing = await tx.financeIdempotencyKey.findUnique({
    where: {
      scope_key: { scope: input.scope, key },
    },
  });
  if (!existing) {
    await tx.financeIdempotencyKey.create({
      data: {
        scope: input.scope,
        key,
        requestHash: input.requestHash,
        status: 'processing',
      },
    });
    return { kind: 'proceed' };
  }
  if (
    existing.requestHash &&
    existing.requestHash !== input.requestHash
  ) {
    throw BusinessException.conflict(
      'Idempotency key reused with a different request payload',
    );
  }
  if (existing.status === 'completed' && existing.responseJson) {
    return {
      kind: 'replay',
      response: JSON.parse(existing.responseJson) as T,
    };
  }
  if (existing.status === 'processing') {
    throw BusinessException.conflict(
      'Idempotent request is already in progress',
    );
  }
  throw BusinessException.conflict('Idempotency key is not reusable');
}

export async function completeIdempotency(
  tx: Prisma.TransactionClient,
  input: {
    scope: IdempotencyScope | string;
    key: string;
    resourceType?: string;
    resourceId?: string;
    response: unknown;
  },
): Promise<void> {
  await tx.financeIdempotencyKey.update({
    where: {
      scope_key: { scope: input.scope, key: input.key.trim() },
    },
    data: {
      status: 'completed',
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      responseJson: JSON.stringify(input.response),
    },
  });
}

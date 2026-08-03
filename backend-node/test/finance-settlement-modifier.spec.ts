import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettlementModifierService } from '../src/finance/settlement/settlement-modifier.service';
import { SETTLEMENT_STATUS } from '../src/finance/settlement/settlement.constants';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('SettlementModifierService', () => {
  const live = {
    id: 's1',
    settlementNumber: 'STL-1',
    rentalId: 'r1',
    accountId: 'a1',
    customerId: 'c1',
    chargeFils: 4000,
    depositFils: 0,
    lateFeeFils: 0,
    adjustmentFils: 0,
    discountFils: 0,
    refundFils: 0,
    totalFils: 4000,
    paidFils: 0,
    remainingFils: 4000,
    status: SETTLEMENT_STATUS.OPEN,
    currency: 'IQD',
    notes: null,
    closedAt: null,
    cancelledAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    history: [],
    refunds: [],
    adjustments: [],
    discounts: [],
    lateFees: [],
    rental: { id: 'r1', rentalNumber: 'R1', status: 'active', customerId: 'c1' },
    account: {
      id: 'a1',
      accountNumber: 'FIN-1',
      customerId: 'c1',
      status: 'open',
    },
  };

  const repo = {
    client: {
      $transaction: vi.fn(),
      settlementRefund: { findUnique: vi.fn() },
    },
    nextSequence: vi.fn(),
    lockSettlement: vi.fn(),
    recalculateCas: vi.fn(),
  };
  const finance = { postSettlementModifierInTx: vi.fn() };
  const settings = {
    getString: vi.fn(async (_: string, f: string) => f),
    getInt: vi.fn(async (_: string, f: number) => f),
  };
  let service: SettlementModifierService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SettlementModifierService(
      repo as never,
      finance as never,
      settings as never,
    );
    repo.nextSequence.mockResolvedValue(1);
    repo.client.settlementRefund.findUnique.mockResolvedValue(null);
    repo.lockSettlement.mockResolvedValue(undefined);
  });

  it('rejects closed settlement and empty reasons', async () => {
    await expect(
      service.applyRefund(
        { ...live, status: SETTLEMENT_STATUS.CLOSED } as never,
        { amountFils: 100, reason: 'x' },
      ),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.applyRefund(live as never, { amountFils: 100, reason: '  ' }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.applyAdjustment(live as never, { amountFils: 0, reason: 'x' }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.applyAdjustment(live as never, { amountFils: 10, reason: '' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('rejects incomplete discount and late fee payloads before TX work', async () => {
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          rentalSettlement: {
            findFirst: vi.fn().mockResolvedValue(live),
          },
          settlementDiscount: { create: vi.fn(), update: vi.fn() },
          settlementLateFee: { create: vi.fn(), update: vi.fn() },
          financeIdempotencyKey: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            update: vi.fn(),
          },
        };
        return fn(tx);
      },
    );
    await expect(
      service.applyDiscount(live as never, {
        kind: 'fixed',
        reason: 'promo',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.applyDiscount(live as never, {
        kind: 'percentage',
        reason: 'promo',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.assessLateFee(live as never, {
        kind: 'flat',
        reason: 'late',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.assessLateFee(live as never, {
        kind: 'daily',
        reason: 'late',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.applyDiscount(live as never, {
        kind: 'unknown',
        reason: 'promo',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.assessLateFee(live as never, {
        kind: 'unknown',
        reason: 'late',
      }),
    ).rejects.toBeInstanceOf(BusinessException);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettlementRepository } from '../src/finance/settlement/settlement.repository';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('SettlementRepository', () => {
  const prisma = {
    $transaction: vi.fn(),
    sequenceCounter: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    rentalSettlement: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    settlementHistory: { create: vi.fn() },
  };
  let repo: SettlementRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SettlementRepository(prisma as never);
  });

  it('nextSequence creates and increments', async () => {
    prisma.sequenceCounter.findUnique.mockResolvedValue(null);
    prisma.sequenceCounter.create.mockResolvedValue({});
    expect(await repo.nextSequence('stl', prisma as never)).toBe(1);

    prisma.sequenceCounter.findUnique.mockResolvedValue({
      prefix: 'stl',
      lastValue: 2,
    });
    prisma.sequenceCounter.update.mockResolvedValue({ lastValue: 3 });
    prisma.$transaction.mockImplementation(async (fn: (c: unknown) => unknown) =>
      fn(prisma),
    );
    expect(await repo.nextSequence('stl')).toBe(3);
  });

  it('finds lists creates and CAS payment', async () => {
    prisma.rentalSettlement.findFirst.mockResolvedValue({ id: 's1' });
    expect(await repo.findById('s1')).toEqual({ id: 's1' });
    expect(await repo.findByRentalId('r1')).toEqual({ id: 's1' });
    prisma.rentalSettlement.findUnique.mockResolvedValue(null);
    expect(await repo.findAnyNumber('STL-1')).toBeNull();

    prisma.rentalSettlement.findMany.mockResolvedValue([]);
    prisma.rentalSettlement.count.mockResolvedValue(0);
    await repo.list({
      where: {},
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });

    prisma.rentalSettlement.create.mockResolvedValue({ id: 's1', history: [] });
    await repo.create(
      prisma as never,
      {
        settlementNumber: 'STL-1',
        rentalId: 'r1',
        accountId: 'a1',
        customerId: 'c1',
        totalFils: 100,
        paidFils: 0,
        remainingFils: 100,
        status: 'open',
        currency: 'IQD',
      },
      {
        oldStatus: 'open',
        newStatus: 'open',
        action: 'created',
      },
    );

    prisma.rentalSettlement.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await repo.applyPaymentCas(prisma as never, {
        settlementId: 's1',
        expectedRemaining: 100,
        fromStatus: 'open',
        amountFils: 40,
        newPaid: 40,
        newRemaining: 60,
        newStatus: 'partially_paid',
        paymentId: 'p1',
      }),
    ).toBeNull();

    prisma.rentalSettlement.updateMany.mockResolvedValue({ count: 1 });
    prisma.settlementHistory.create.mockResolvedValue({});
    prisma.rentalSettlement.findUniqueOrThrow.mockResolvedValue({
      id: 's1',
      history: [],
    });
    expect(
      (
        await repo.applyPaymentCas(prisma as never, {
          settlementId: 's1',
          expectedRemaining: 100,
          fromStatus: 'open',
          amountFils: 40,
          newPaid: 40,
          newRemaining: 60,
          newStatus: 'partially_paid',
          paymentId: 'p1',
        })
      )?.id,
    ).toBe('s1');
  });

  it('transitions status and locks', async () => {
    prisma.rentalSettlement.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await repo.transitionStatus(prisma as never, {
        settlementId: 's1',
        from: 'paid',
        to: 'closed',
        action: 'closed',
      }),
    ).toBeNull();

    prisma.rentalSettlement.updateMany.mockResolvedValue({ count: 1 });
    prisma.settlementHistory.create.mockResolvedValue({});
    prisma.rentalSettlement.findUniqueOrThrow.mockResolvedValue({
      id: 's1',
      status: 'closed',
      history: [],
    });
    expect(
      (
        await repo.transitionStatus(prisma as never, {
          settlementId: 's1',
          from: 'paid',
          to: 'closed',
          action: 'closed',
          extra: { closedAt: new Date() },
        })
      )?.status,
    ).toBe('closed');

    prisma.rentalSettlement.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repo.lockSettlement(prisma as never, 's1'),
    ).rejects.toBeInstanceOf(BusinessException);

    prisma.rentalSettlement.updateMany.mockResolvedValue({ count: 1 });
    await repo.lockSettlement(prisma as never, 's1');
    expect(repo.client).toBe(prisma);
  });
});

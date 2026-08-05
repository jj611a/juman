import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesRepository } from '../src/sales/sales.repository';

describe('SalesRepository unit', () => {
  const prisma = {
    sale: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    saleHistory: { create: vi.fn() },
    saleItem: { createMany: vi.fn() },
    sequenceCounter: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };

  let repo: SalesRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SalesRepository(prisma as never);
  });

  it('findById / findByNumber / findAnyNumber / findByIdInTx', async () => {
    prisma.sale.findFirst.mockResolvedValue({ id: 's1' });
    prisma.sale.findUnique.mockResolvedValue({ id: 's1' });
    await repo.findById('s1');
    await repo.findByNumber('SALE-1');
    await repo.findAnyNumber('SALE-1');
    await repo.findByIdInTx(prisma as never, 's1');
    expect(prisma.sale.findFirst).toHaveBeenCalled();
    expect(prisma.sale.findUnique).toHaveBeenCalled();
  });

  it('list and nextSequence create or increment', async () => {
    prisma.sale.findMany.mockResolvedValue([]);
    prisma.sale.count.mockResolvedValue(0);
    await repo.list({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });

    prisma.sequenceCounter.findUnique.mockResolvedValue(null);
    prisma.sequenceCounter.create.mockResolvedValue({ lastValue: 1 });
    await expect(repo.nextSequence('sale:SALE')).resolves.toBe(1);

    prisma.sequenceCounter.findUnique.mockResolvedValue({ lastValue: 3 });
    prisma.sequenceCounter.update.mockResolvedValue({ lastValue: 4 });
    await expect(repo.nextSequence('sale:SALE', prisma as never)).resolves.toBe(
      4,
    );
  });

  it('transitionStatus returns null on CAS miss and row on success', async () => {
    prisma.sale.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repo.transitionStatus(prisma as never, {
        saleId: 's1',
        from: 'draft',
        to: 'confirmed',
        action: 'confirmed',
      }),
    ).resolves.toBeNull();

    prisma.sale.updateMany.mockResolvedValue({ count: 1 });
    prisma.saleHistory.create.mockResolvedValue({});
    prisma.sale.findUniqueOrThrow.mockResolvedValue({
      id: 's1',
      status: 'confirmed',
    });
    await expect(
      repo.transitionStatus(prisma as never, {
        saleId: 's1',
        from: 'draft',
        to: 'confirmed',
        action: 'confirmed',
        extra: { completedAt: new Date() },
      }),
    ).resolves.toMatchObject({ id: 's1' });

    await repo.updateCustomerInTx(prisma as never, 's1', 'c1', 'u1');
    expect(prisma.sale.update).toHaveBeenCalled();
  });

  it('create writes sale + lines + history', async () => {
    prisma.sale.create.mockResolvedValue({ id: 's1' });
    prisma.sale.findUniqueOrThrow.mockResolvedValue({ id: 's1', items: [] });
    const row = await repo.create(
      {
        saleNumber: 'SALE-1',
        customerId: null,
        status: 'draft',
        subtotalFils: 100,
        discountFils: 0,
        taxFils: 0,
        totalFils: 100,
        notes: null,
        createdBy: null,
        updatedBy: null,
      },
      [
        {
          itemId: 'i1',
          priceFils: 100,
          discountFils: 0,
          quantity: 1,
          totalFils: 100,
        },
      ],
      { userId: 'u', username: 'admin' },
    );
    expect(row.id).toBe('s1');
  });
});

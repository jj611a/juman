import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ItemsRepository } from '../src/inventory/items/items.repository';

type SequenceTransaction = {
  sequenceCounter: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
type SequenceCallback = (tx: SequenceTransaction) => Promise<number>;

describe('ItemsRepository', () => {
  it('covers sequence create list taxonomy and relation helpers', async () => {
    const prisma = {
      item: {
        create: vi.fn().mockResolvedValue({ id: 'i1' }),
        update: vi.fn().mockResolvedValue({ id: 'i1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'i1' }),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      itemBarcode: {
        create: vi.fn().mockResolvedValue({ id: 'ib1' }),
      },
      itemMedia: {
        create: vi.fn().mockResolvedValue({ id: 'im1' }),
      },
      category: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      brand: { findFirst: vi.fn().mockResolvedValue(null) },
      color: { findFirst: vi.fn().mockResolvedValue({ id: 'col' }) },
      size: { findFirst: vi.fn().mockResolvedValue({ id: 's' }) },
      $transaction: vi.fn(async (fn: SequenceCallback) =>
        fn({
          sequenceCounter: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ lastValue: 1 }),
            update: vi.fn().mockResolvedValue({ lastValue: 2 }),
          },
        }),
      ),
    };
    const repo = new ItemsRepository(prisma as never);
    await repo.create({ displayName: 'x', internalCode: 'ITM-1' });
    await repo.update('i1', { displayName: 'y' });
    await repo.findById('i1');
    await repo.findById('i1', true);
    await repo.findByCode('ITM-1');
    await repo.findAnyCode('ITM-1');
    await repo.list({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });
    expect(await repo.nextSequence('item:ITM')).toBe(1);
    prisma.$transaction.mockImplementation(async (fn: SequenceCallback) =>
      fn({
        sequenceCounter: {
          findUnique: vi.fn().mockResolvedValue({ lastValue: 3 }),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue({ lastValue: 4 }),
        },
      }),
    );
    expect(await repo.nextSequence('item:ITM')).toBe(4);
    await repo.softDelete('i1', 'u');
    await repo.restore('i1', 'u');
    await repo.findTaxonomy('category', 'c1');
    await repo.findTaxonomy('brand', 'b1');
    await repo.createBarcode('i1', 'b1', true, 'u');
    await repo.createMedia({ itemId: 'i1', mediaFileId: 'm1' });
  });
});

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
        findFirst: vi.fn().mockResolvedValue({ id: 'i1', status: 'active' }),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      itemBarcode: {
        create: vi.fn().mockResolvedValue({ id: 'ib1' }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      barcode: {
        update: vi.fn(),
      },
      mediaReference: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      itemStateHistory: {
        create: vi.fn(),
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

    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    await repo.softDeleteCascade('i1', 'u');
    prisma.item.findFirst.mockResolvedValueOnce({
      id: 'i1',
      status: 'active',
      deletedAt: new Date(),
      statusBeforeDelete: 'active',
    });
    await repo.restoreCascade('i1', 'u');
    await repo.findTaxonomy('category', 'c1');
    await repo.findTaxonomy('brand', 'b1');
    await repo.createBarcode('i1', 'b1', true, 'u');
    await repo.listMediaForItem('i1');
    await repo.listMediaForItems(['i1']);
  });

  it('createAtomic binds barcode media and birth history in one transaction', async () => {
    const created = { id: 'i1', internalCode: 'ITM-1' };
    const prisma = {
      item: {
        create: vi.fn().mockResolvedValue(created),
        findFirst: vi.fn().mockResolvedValue({
          ...created,
          barcodes: [],
          category: null,
          brand: null,
          color: null,
          size: null,
        }),
      },
      barcode: { update: vi.fn() },
      itemBarcode: { create: vi.fn() },
      mediaReference: { create: vi.fn() },
      itemStateHistory: { create: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    const repo = new ItemsRepository(prisma as never);
    await repo.createAtomic({
      item: { displayName: 'x', internalCode: 'ITM-1' } as never,
      barcodeId: 'b1',
      media: [
        {
          mediaFileId: 'm1',
          purpose: 'gallery',
          displayOrder: 0,
          isPrimary: true,
        },
      ],
      actorId: 'u1',
    });
    expect(prisma.barcode.update).toHaveBeenCalled();
    expect(prisma.itemBarcode.create).toHaveBeenCalled();
    expect(prisma.mediaReference.create).toHaveBeenCalled();
    expect(prisma.itemStateHistory.create).toHaveBeenCalled();
  });
});

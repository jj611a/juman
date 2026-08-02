import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BarcodeRepository } from '../src/barcode/barcode.repository';

describe('BarcodeRepository', () => {
  it('covers sequence create update and list operations', async () => {
    const prisma = {
      barcode: {
        findFirst: vi.fn().mockResolvedValue({ id: 'b1' }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'b1' }),
        update: vi.fn().mockResolvedValue({ id: 'b1' }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          sequenceCounter: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 1 }),
            update: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 2 }),
          },
        };
        return fn(tx);
      }),
    };
    const repo = new BarcodeRepository(prisma as never);
    await repo.findById('b1');
    await repo.findByCode('DR-1');
    await repo.findAnyByCode('DR-1');
    await repo.create({
      code: 'DR-1',
      type: 'code128',
      prefix: 'DR',
      status: 'reserved',
    } as never);
    await repo.update('b1', { status: 'activated' });
    await repo.list({ where: {}, orderBy: { createdAt: 'desc' }, offset: 0, limit: 10 });
    expect(await repo.nextSequence('DR')).toBe(1);
    await repo.bumpSequenceAtLeast('DR', 5);
    expect(prisma.barcode.create).toHaveBeenCalled();
  });

  it('increments existing sequence and bumps when below min', async () => {
    const existing = { prefix: 'DR', lastValue: 3 };
    const prisma = {
      barcode: {},
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          sequenceCounter: {
            findUnique: vi.fn().mockResolvedValue(existing),
            create: vi.fn(),
            update: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 4 }),
          },
        };
        return fn(tx);
      }),
    };
    const repo = new BarcodeRepository(prisma as never);
    expect(await repo.nextSequence('DR')).toBe(4);

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        sequenceCounter: {
          findUnique: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 2 }),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 10 }),
        },
      };
      return fn(tx);
    });
    expect(await repo.bumpSequenceAtLeast('DR', 10)).toEqual({ prefix: 'DR', lastValue: 10 });

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const kept = { prefix: 'DR', lastValue: 20 };
      const tx = {
        sequenceCounter: {
          findUnique: vi.fn().mockResolvedValue(kept),
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      return fn(tx);
    });
    expect(await repo.bumpSequenceAtLeast('DR', 5)).toEqual({ prefix: 'DR', lastValue: 20 });
  });
});

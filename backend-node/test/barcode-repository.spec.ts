import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BarcodeRepository } from '../src/barcode/barcode.repository';

describe('BarcodeRepository', () => {
  it('covers sequence and barcode persistence', async () => {
    const tx = {
      sequenceCounter: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ prefix: 'DR', lastValue: 1 })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ prefix: 'DR', lastValue: 5 }),
        create: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 1 }),
        update: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 2 }),
      },
    };
    const prisma = {
      barcode: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'b1' }),
        update: vi.fn().mockResolvedValue({ id: 'b1' }),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const repo = new BarcodeRepository(prisma as never);
    expect(await repo.nextSequence('DR')).toBe(1);
    expect(await repo.nextSequence('DR')).toBe(2);
    await repo.bumpSequenceAtLeast('DR', 10);
    await repo.bumpSequenceAtLeast('DR', 1);
    await repo.findByCode('X');
    await repo.findAnyByCode('X');
    await repo.create({
      code: 'DR-1',
      prefix: 'DR',
      status: 'reserved',
      entityType: null,
      entityId: null,
      reservedAt: new Date(),
      allocatedAt: null,
      createdBy: null,
    });
    await repo.updateStatus('b1', { status: 'allocated' });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
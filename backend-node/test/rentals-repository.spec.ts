import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { RentalsController } from '../src/rentals/rentals.controller';
import { RentalsRepository } from '../src/rentals/rentals.repository';

describe('RentalsController + Repository', () => {
  it('delegates HTTP actions', async () => {
    const rentals = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      checkout: vi.fn(),
      initiateReturn: vi.fn(),
      cancel: vi.fn(),
    };
    const c = new RentalsController(rentals as never);
    const user = { userId: 'u' } as never;
    await c.list({});
    await c.get('id');
    await c.create({} as never, user);
    await c.checkout('id', { reason: 'x' }, user);
    await c.initiateReturn('id', {}, user);
    await c.cancel('id', {}, user);
    expect(rentals.checkout).toHaveBeenCalled();
    expect(rentals.cancel).toHaveBeenCalled();
  });

  it('covers repository helpers', async () => {
    const prisma = {
      rental: {
        create: vi.fn().mockResolvedValue({ id: 'r1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'r1',
          items: [],
          customer: null,
          statusHistory: [],
        }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
      },
      rentalStatusHistory: { create: vi.fn() },
      sequenceCounter: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ lastValue: 2 }),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    const repo = new RentalsRepository(prisma as never);
    await repo.create(
      {
        rentalNumber: 'RENT-1',
        customerId: 'c1',
        rentalDate: new Date(),
        expectedReturnDate: new Date(),
        status: 'draft',
      },
      [{ itemId: 'i1', agreedRentalPrice: 0 }],
      { userId: 'u' },
    );
    await repo.findById('r1');
    await repo.findByNumber('RENT-1');
    await repo.findAnyNumber('RENT-1');
    await repo.list({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });
    expect(await repo.nextSequence('rental:RENT')).toBe(1);
    prisma.sequenceCounter.findUnique.mockResolvedValue({ lastValue: 3 });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    );
    expect(await repo.nextSequence('rental:RENT')).toBe(2);
    await repo.transitionStatus({
      rentalId: 'r1',
      from: 'draft',
      to: 'cancelled',
      userId: 'u',
    });
    await repo.softDelete('r1', 'u');
    await repo.restore('r1', 'u');
    prisma.rental.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await repo.transitionStatus({
        rentalId: 'r1',
        from: 'draft',
        to: 'cancelled',
      }),
    ).toBeNull();
  });
});

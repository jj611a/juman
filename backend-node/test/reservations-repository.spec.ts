import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ReservationsController } from '../src/reservations/reservations.controller';
import { ReservationsRepository } from '../src/reservations/reservations.repository';

describe('ReservationsController + Repository', () => {
  it('delegates HTTP', async () => {
    const reservations = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      checkout: vi.fn(),
      cancel: vi.fn(),
      expireReservation: vi.fn(),
    };
    const c = new ReservationsController(reservations as never);
    const user = { userId: 'u' } as never;
    await c.list({});
    await c.get('id');
    await c.create({} as never, user);
    await c.checkout('id', {}, user);
    await c.cancel('id', {}, user);
    await c.expire('id', {}, user);
    expect(reservations.expireReservation).toHaveBeenCalled();
  });

  it('covers repository helpers', async () => {
    const prisma = {
      reservation: {
        create: vi.fn().mockResolvedValue({ id: 'rs1' }),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: 'rs1' }),
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'rs1',
          items: [],
          customer: null,
          statusHistory: [],
          rental: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reservationStatusHistory: { create: vi.fn() },
      sequenceCounter: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ lastValue: 2 }),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const repo = new ReservationsRepository(prisma as never);
    await repo.createConfirmed({
      data: {
        reservationNumber: 'RSV-1',
        customerId: 'c1',
        startDate: new Date(),
        expectedCheckoutDate: new Date(),
        expectedReturnDate: new Date(),
      },
      items: [{ itemId: 'i1', agreedRentalPrice: 0 }],
      actor: { userId: 'u' },
    });
    await repo.findById('rs1');
    await repo.findAnyNumber('RSV-1');
    await repo.list({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });
    expect(await repo.nextSequence('reservation:RSV')).toBe(1);
    await repo.transitionStatus({
      reservationId: 'rs1',
      from: 'confirmed',
      to: 'cancelled',
    });
    await repo.softDelete('rs1', 'u');
    await repo.restore('rs1', 'u');
    prisma.reservation.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await repo.transitionStatus({
        reservationId: 'rs1',
        from: 'confirmed',
        to: 'cancelled',
      }),
    ).toBeNull();
  });
});

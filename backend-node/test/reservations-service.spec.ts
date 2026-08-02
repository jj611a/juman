import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityService } from '../src/reservations/availability/availability.service';
import { ReservationsService } from '../src/reservations/reservations.service';
import { BusinessException } from '../src/shared/errors/business.exception';
import { RESERVATION_STATUS } from '../src/reservations/reservations.constants';

const itemRow = {
  id: 'i1',
  internalCode: 'ITM-1',
  displayName: 'Dress',
  status: 'active',
  lifecycleState: 'available',
  rentalPrice: 1000,
  deletedAt: null,
  barcodes: [{ id: 'ib1', value: 'DR-1', isPrimary: true }],
};

const confirmed = {
  id: 'rs1',
  reservationNumber: 'RSV-00000001',
  customerId: 'c1',
  startDate: new Date('2026-08-10'),
  expectedCheckoutDate: new Date('2026-08-12'),
  expectedReturnDate: new Date('2026-08-15'),
  status: RESERVATION_STATUS.CONFIRMED,
  notes: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
  deletedBy: null,
  customer: {
    id: 'c1',
    customerNumber: 'CUS-1',
    fullName: 'Ali',
    status: 'active',
  },
  rental: null,
  items: [
    {
      id: 'ri1',
      reservationId: 'rs1',
      itemId: 'i1',
      barcodeValue: 'DR-1',
      agreedRentalPrice: 1000,
      notes: null,
      item: itemRow,
    },
  ],
  statusHistory: [],
};

describe('AvailabilityService', () => {
  it('finds reservation and rental conflicts', async () => {
    const prisma = {
      reservationItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            itemId: 'i1',
            reservation: {
              id: 'rsX',
              reservationNumber: 'RSV-9',
              startDate: new Date('2026-08-11'),
              expectedReturnDate: new Date('2026-08-14'),
              status: 'confirmed',
            },
          },
        ]),
      },
      rentalItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            itemId: 'i1',
            rental: {
              id: 'rX',
              rentalNumber: 'RENT-9',
              rentalDate: new Date('2026-08-20'),
              expectedReturnDate: new Date('2026-08-22'),
              status: 'active',
            },
          },
        ]),
      },
    };
    const svc = new AvailabilityService(prisma as never);
    const conflicts = await svc.findConflicts({
      itemId: 'i1',
      start: new Date('2026-08-10'),
      end: new Date('2026-08-16'),
    });
    expect(conflicts.some((c) => c.kind === 'reservation')).toBe(true);
    await expect(
      svc.assertAvailable({
        itemId: 'i1',
        start: new Date('2026-08-10'),
        end: new Date('2026-08-16'),
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    prisma.reservationItem.findMany.mockResolvedValue([]);
    prisma.rentalItem.findMany.mockResolvedValue([]);
    await svc.assertItemsAvailable(
      ['i1'],
      new Date('2026-09-01'),
      new Date('2026-09-05'),
    );

    expect(
      await svc.findConflicts({
        itemId: 'i1',
        start: new Date('2026-09-01'),
        end: new Date('2026-09-01'),
      }),
    ).toEqual([]);

    prisma.rentalItem.findMany.mockResolvedValue([
      {
        itemId: 'i1',
        rental: {
          id: 'rY',
          rentalNumber: 'RENT-Y',
          rentalDate: new Date('2026-08-10'),
          expectedReturnDate: new Date('2026-08-16'),
          status: 'active',
        },
      },
    ]);
    const rentalConflicts = await svc.findConflicts({
      itemId: 'i1',
      start: new Date('2026-08-11'),
      end: new Date('2026-08-15'),
      excludeReservationId: 'x',
      excludeRentalId: 'skip',
    });
    expect(rentalConflicts.some((c) => c.kind === 'rental')).toBe(true);
  });
});

describe('ReservationsService', () => {
  const repo = {
    createConfirmed: vi.fn(),
    findById: vi.fn(),
    findAnyNumber: vi.fn(),
    nextSequence: vi.fn(),
    list: vi.fn(),
    transitionStatus: vi.fn(),
    client: { $transaction: vi.fn() },
  };
  const availability = {
    assertItemsAvailable: vi.fn(),
    assertAvailable: vi.fn(),
    findConflicts: vi.fn(),
  };
  const customers = { getById: vi.fn() };
  const items = { getById: vi.fn() };
  const barcodes = { findByValue: vi.fn() };
  const rentals = { materializeActiveFromReservation: vi.fn() };
  const settings = {
    getString: vi.fn(async (_: string, f: string) => f),
    getInt: vi.fn(async (_: string, f: number) => f),
  };
  const audit = { recordCreate: vi.fn(), record: vi.fn() };
  let service: ReservationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReservationsService(
      repo as never,
      availability as never,
      customers as never,
      items as never,
      barcodes as never,
      rentals as never,
      settings as never,
      audit as never,
    );
    customers.getById.mockResolvedValue({ id: 'c1', status: 'active' });
    items.getById.mockResolvedValue(itemRow);
    barcodes.findByValue.mockResolvedValue({
      id: 'b1',
      status: 'activated',
      entityId: 'i1',
    });
    repo.nextSequence.mockResolvedValue(1);
    repo.findAnyNumber.mockResolvedValue(null);
    repo.createConfirmed.mockResolvedValue(confirmed);
    repo.findById.mockResolvedValue(confirmed);
    repo.list.mockResolvedValue({ rows: [confirmed], total: 1 });
    availability.assertItemsAvailable.mockResolvedValue(undefined);
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    repo.transitionStatus.mockImplementation(async (input: { to: string }) => ({
      ...confirmed,
      status: input.to,
    }));
    rentals.materializeActiveFromReservation.mockResolvedValue({
      id: 'r1',
      rentalNumber: 'RENT-1',
    });
  });

  it('creates confirmed reservation with audits', async () => {
    const row = await service.create(
      {
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'DR-1' }],
      },
      { userId: 'u1' } as never,
    );
    expect(row.status).toBe('confirmed');
    expect(availability.assertItemsAvailable).toHaveBeenCalled();
    expect(audit.recordCreate).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'confirmed' }),
    );
  });

  it('rejects conflicts inactive customer and bad dates', async () => {
    availability.assertItemsAvailable.mockRejectedValueOnce(
      BusinessException.conflict('conflict'),
    );
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    customers.getById.mockResolvedValue({ id: 'c1', status: 'inactive' });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    customers.getById.mockResolvedValue({ id: 'c1', status: 'active' });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-15T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-16T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('checkouts materializes rental in one transaction', async () => {
    repo.findById.mockImplementation(async () => ({
      ...confirmed,
      status: RESERVATION_STATUS.CHECKED_OUT,
      rental: { id: 'r1', rentalNumber: 'RENT-1', status: 'active' },
    }));
    repo.findById.mockResolvedValueOnce(confirmed);
    const result = await service.checkout('rs1', 'pickup', {
      userId: 'u',
    } as never);
    expect(rentals.materializeActiveFromReservation).toHaveBeenCalled();
    expect(result.status).toBe(RESERVATION_STATUS.CHECKED_OUT);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'checkout' }),
    );
  });

  it('cancels and expires confirmed reservations', async () => {
    repo.findById.mockResolvedValue(confirmed);
    repo.transitionStatus.mockResolvedValue({
      ...confirmed,
      status: RESERVATION_STATUS.CANCELLED,
    });
    await service.cancel('rs1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel' }),
    );

    repo.findById.mockResolvedValue(confirmed);
    repo.transitionStatus.mockResolvedValue({
      ...confirmed,
      status: RESERVATION_STATUS.EXPIRED,
    });
    await service.expireReservation('rs1', 'no-show');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'expired' }),
    );
  });

  it('lists gets and rejects invalid transitions', async () => {
    await service.list({ status: 'confirmed', q: 'Ali' });
    expect((await service.getById('rs1')).id).toBe('rs1');
    repo.findById.mockResolvedValue({
      ...confirmed,
      status: RESERVATION_STATUS.CHECKED_OUT,
    });
    await expect(service.checkout('rs1')).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.cancel('rs1')).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.expireReservation('rs1')).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.list({ status: 'nope' })).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('covers item barcode validation allocate and concurrent failures', async () => {
    await expect(
      service.create({
        customerId: 'c1',
        startDate: 'bad',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-11T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }, { itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    items.getById.mockResolvedValueOnce({ ...itemRow, barcodes: [] });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    items.getById.mockResolvedValue(itemRow);
    barcodes.findByValue.mockResolvedValueOnce({
      id: 'b1',
      status: 'reserved',
      entityId: null,
    });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'DR-1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    barcodes.findByValue.mockResolvedValue({
      id: 'b1',
      status: 'activated',
      entityId: 'other',
    });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'DR-1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    barcodes.findByValue.mockResolvedValue({
      id: 'b1',
      status: 'activated',
      entityId: 'i1',
    });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'WRONG' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    items.getById.mockResolvedValue({
      ...itemRow,
      lifecycleState: 'rented',
    });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    items.getById.mockResolvedValue(itemRow);
    settings.getString.mockImplementation(async (key: string, f: string) => {
      if (key === 'reservations.number.prefix') return 'bad prefix';
      return f;
    });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (_k: string, f: string) => f);
    repo.findAnyNumber.mockResolvedValue({ id: 'taken' });
    await expect(
      service.create({
        customerId: 'c1',
        startDate: '2026-08-10T00:00:00.000Z',
        expectedCheckoutDate: '2026-08-12T00:00:00.000Z',
        expectedReturnDate: '2026-08-15T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findAnyNumber.mockResolvedValue(null);
    repo.findById.mockResolvedValue(confirmed);
    repo.transitionStatus.mockResolvedValueOnce(null);
    await expect(service.checkout('rs1')).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.transitionStatus.mockResolvedValueOnce(null);
    await expect(service.cancel('rs1')).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.transitionStatus.mockResolvedValueOnce(null);
    await expect(service.expireReservation('rs1')).rejects.toBeInstanceOf(
      BusinessException,
    );

    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      BusinessException,
    );

    await service.list({
      reservationNumber: 'RSV',
      customerId: 'c1',
      deleted: 'true',
    });
  });
});

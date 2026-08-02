import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RentalsService } from '../src/rentals/rentals.service';
import { BusinessException } from '../src/shared/errors/business.exception';
import { ITEM_LIFECYCLE } from '../src/inventory/inventory.constants';
import { RENTAL_STATUS } from '../src/rentals/rentals.constants';

const itemRow = {
  id: 'i1',
  internalCode: 'ITM-00000001',
  displayName: 'Dress',
  status: 'active',
  lifecycleState: 'available',
  rentalPrice: 2000,
  deletedAt: null,
  barcodes: [{ id: 'ib1', value: 'DR-00000001', isPrimary: true }],
};

const draftRental = {
  id: 'r1',
  rentalNumber: 'RENT-00000001',
  customerId: 'c1',
  rentalDate: new Date('2026-08-01'),
  expectedReturnDate: new Date('2026-08-03'),
  actualReturnDate: null,
  status: RENTAL_STATUS.DRAFT,
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
  items: [
    {
      id: 'ri1',
      rentalId: 'r1',
      itemId: 'i1',
      barcodeValue: 'DR-00000001',
      agreedRentalPrice: 2000,
      notes: null,
      item: itemRow,
    },
  ],
  statusHistory: [],
};

describe('RentalsService', () => {
  const repo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAnyNumber: vi.fn(),
    nextSequence: vi.fn(),
    list: vi.fn(),
    transitionStatus: vi.fn(),
    client: { $transaction: vi.fn() },
  };
  const customers = { getById: vi.fn() };
  const items = { getById: vi.fn() };
  const lifecycle = { transition: vi.fn() };
  const barcodes = { findByValue: vi.fn() };
  const settings = {
    getString: vi.fn(async (_: string, f: string) => f),
    getInt: vi.fn(async (_: string, f: number) => f),
  };
  const audit = {
    recordCreate: vi.fn(),
    record: vi.fn(),
  };
  let service: RentalsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RentalsService(
      repo as never,
      customers as never,
      items as never,
      lifecycle as never,
      barcodes as never,
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
    repo.create.mockResolvedValue(draftRental);
    repo.findById.mockResolvedValue(draftRental);
    repo.list.mockResolvedValue({ rows: [draftRental], total: 1 });
    repo.client.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    repo.transitionStatus.mockImplementation(async (input: { to: string; from: string }) => ({
      ...draftRental,
      status: input.to,
    }));
    lifecycle.transition.mockResolvedValue({ lifecycleState: ITEM_LIFECYCLE.RENTED });
  });

  it('creates draft rental with validation', async () => {
    const created = await service.create(
      {
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'DR-00000001' }],
      },
      { userId: 'u1', username: 'admin' } as never,
    );
    expect(created.status).toBe('draft');
    expect(repo.create).toHaveBeenCalled();
    expect(audit.recordCreate).toHaveBeenCalled();
  });

  it('rejects inactive customer and non-rentable item', async () => {
    customers.getById.mockResolvedValue({ id: 'c1', status: 'inactive' });
    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    customers.getById.mockResolvedValue({ id: 'c1', status: 'active' });
    items.getById.mockResolvedValue({
      ...itemRow,
      lifecycleState: 'rented',
    });
    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('checkouts through LifecycleService and activates rental', async () => {
    repo.findById.mockImplementation(async () => ({
      ...draftRental,
      status: RENTAL_STATUS.ACTIVE,
    }));
    repo.findById.mockResolvedValueOnce(draftRental);

    const result = await service.checkout('r1', 'walk-in', {
      userId: 'u1',
      username: 'admin',
    } as never);
    expect(lifecycle.transition).toHaveBeenCalled();
    expect(result.status).toBe(RENTAL_STATUS.ACTIVE);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'checkout' }),
    );
  });

  it('rolls back checkout when lifecycle transition fails', async () => {
    lifecycle.transition.mockRejectedValueOnce(
      BusinessException.conflict('Concurrent lifecycle transition rejected'),
    );
    await expect(service.checkout('r1')).rejects.toBeInstanceOf(BusinessException);
    lifecycle.transition.mockResolvedValue({
      lifecycleState: ITEM_LIFECYCLE.RENTED,
    });
  });

  it('initiates return and cancels draft', async () => {
    const active = { ...draftRental, status: RENTAL_STATUS.ACTIVE };
    const pending = { ...active, status: RENTAL_STATUS.RETURN_PENDING };
    repo.findById
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(pending);
    await service.initiateReturn('r1', 'back', { userId: 'u' } as never);
    expect(lifecycle.transition).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ newState: ITEM_LIFECYCLE.RETURN_PENDING }),
      expect.anything(),
      expect.objectContaining({ skipAudit: true }),
    );

    repo.findById
      .mockResolvedValueOnce(draftRental)
      .mockResolvedValueOnce({ ...draftRental, status: RENTAL_STATUS.CANCELLED });
    await service.cancel('r1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel' }),
    );
  });

  it('lists and gets by id', async () => {
    await service.list({ status: 'draft' });
    expect(repo.list).toHaveBeenCalled();
    expect((await service.getById('r1')).id).toBe('r1');
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(BusinessException);
  });

  it('covers validation edges checkout return cancel and allocate', async () => {
    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: 'not-a-date',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: '2026-08-03T00:00:00.000Z',
        expectedReturnDate: '2026-08-01T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1' }, { itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    items.getById.mockResolvedValueOnce({ ...itemRow, barcodes: [] });
    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
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
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'DR-00000001' }],
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
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'DR-00000001' }],
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
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1', barcode: 'WRONG' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({ ...draftRental, status: RENTAL_STATUS.ACTIVE });
    await expect(service.checkout('r1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue(draftRental);
    await expect(service.initiateReturn('r1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({
      ...draftRental,
      status: RENTAL_STATUS.COMPLETED,
    });
    await expect(service.cancel('r1')).rejects.toBeInstanceOf(BusinessException);

    const active = { ...draftRental, status: RENTAL_STATUS.ACTIVE };
    repo.findById.mockImplementation(async () => ({
      ...active,
      status: RENTAL_STATUS.CANCELLED,
    }));
    repo.findById.mockResolvedValueOnce(active);
    await service.cancel('r1', 'abort');
    expect(lifecycle.transition).toHaveBeenCalled();

    repo.findById.mockResolvedValue(draftRental);
    repo.transitionStatus.mockResolvedValueOnce(null);
    await expect(service.checkout('r1')).rejects.toBeInstanceOf(BusinessException);

    repo.transitionStatus.mockImplementation(async (input: { to: string }) => ({
      ...draftRental,
      status: input.to,
    }));

    settings.getString.mockImplementation(async (key: string, f: string) => {
      if (key === 'rentals.number.prefix') return 'bad prefix';
      return f;
    });
    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (_k: string, f: string) => f);
    repo.findAnyNumber.mockResolvedValue({ id: 'taken' });
    await expect(
      service.create({
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-03T00:00:00.000Z',
        items: [{ itemId: 'i1' }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(service.list({ status: 'nope' })).rejects.toBeInstanceOf(
      BusinessException,
    );
    await service.list({ q: 'Ali', rentalNumber: 'RENT', customerId: 'c1' });
  });
});

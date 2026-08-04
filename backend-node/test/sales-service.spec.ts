import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../src/shared/errors/business.exception';
import { SalesService } from '../src/sales/sales.service';
import { SALE_STATUS } from '../src/sales/sales.constants';
import { toSalePublic, toSaleSnapshot } from '../src/sales/sales.mapper';

describe('SalesService unit', () => {
  const repo = {
    client: {
      item: {
        findFirst: vi.fn(),
      },
    },
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    nextSequence: vi.fn(),
    findAnyNumber: vi.fn(),
  };
  const txService = {
    confirm: vi.fn(),
    payment: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
  };
  const customers = {
    getById: vi.fn(),
    ensureWalkInCustomer: vi.fn(),
  };
  const finance = {
    ensureAccountForCustomer: vi.fn(),
  };
  const settings = {
    getString: vi.fn(async (_k: string, fb?: string) => fb ?? 'SALE'),
    getInt: vi.fn(async (_k: string, fb?: number) => fb ?? 8),
  };
  const audit = { record: vi.fn() };
  const logger = { startup: vi.fn() };

  let service: SalesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SalesService(
      repo as never,
      txService as never,
      customers as never,
      finance as never,
      settings as never,
      audit as never,
      logger as never,
    );
  });

  it('onModuleInit seeds walk-in account', async () => {
    customers.ensureWalkInCustomer.mockResolvedValue({
      id: 'w1',
      customerNumber: 'WALK-IN',
    });
    finance.ensureAccountForCustomer.mockResolvedValue({});
    await service.onModuleInit();
    expect(finance.ensureAccountForCustomer).toHaveBeenCalledWith('w1');
  });

  it('lists and gets sales', async () => {
    const row = {
      id: 's1',
      saleNumber: 'SALE-1',
      customerId: null,
      customer: null,
      status: SALE_STATUS.DRAFT,
      subtotalFils: 100,
      discountFils: 0,
      taxFils: 0,
      totalFils: 100,
      notes: null,
      completedAt: null,
      items: [],
      settlement: null,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    };
    repo.list.mockResolvedValue({ rows: [row], total: 1 });
    repo.findById.mockResolvedValue(row);
    const listed = await service.list({ offset: 0, limit: 20 });
    expect(listed.items).toHaveLength(1);
    const one = await service.getById('s1');
    expect(one.saleNumber).toBe('SALE-1');
    const hist = await service.history('s1');
    expect(hist).toEqual([]);
  });

  it('rejects invalid list status and missing sale', async () => {
    await expect(service.list({ status: 'nope' })).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('creates draft with line math and rejects bad quantity/discount', async () => {
    repo.client.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'Dress',
      salePrice: 1000,
      barcodes: [{ barcode: { code: 'BC1' } }],
    });
    repo.nextSequence.mockResolvedValue(1);
    repo.findAnyNumber.mockResolvedValue(null);
    repo.create.mockResolvedValue({
      id: 's1',
      saleNumber: 'SALE-00000001',
      customerId: null,
      customer: null,
      status: SALE_STATUS.DRAFT,
      subtotalFils: 900,
      discountFils: 0,
      taxFils: 0,
      totalFils: 900,
      notes: null,
      completedAt: null,
      items: [],
      settlement: null,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    });

    const created = await service.create({
      items: [{ itemId: 'i1', priceFils: 1000, discountFils: 100 }],
    });
    expect(created.saleNumber).toMatch(/^SALE-/);
    expect(audit.record).toHaveBeenCalled();

    await expect(
      service.create({ items: [{ itemId: 'i1', quantity: 2 }] }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.create({
        items: [{ itemId: 'i1', priceFils: 100, discountFils: 200 }],
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.create({
        items: [
          { itemId: 'i1', priceFils: 100 },
          { itemId: 'i1', priceFils: 100 },
        ],
      }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('delegates confirm/payment/complete/cancel', async () => {
    txService.confirm.mockResolvedValue({ id: 's' });
    txService.payment.mockResolvedValue({ id: 's' });
    txService.complete.mockResolvedValue({ id: 's' });
    txService.cancel.mockResolvedValue({ id: 's' });
    await service.confirm('s', {});
    await service.payment('s', { amountFils: 1 });
    await service.complete('s', {});
    await service.cancel('s', 'x');
    expect(txService.confirm).toHaveBeenCalled();
    expect(txService.payment).toHaveBeenCalled();
    expect(txService.complete).toHaveBeenCalled();
    expect(txService.cancel).toHaveBeenCalled();
  });

  it('mapper snapshots', () => {
    expect(
      toSaleSnapshot({
        id: '1',
        saleNumber: 'S',
        status: 'draft',
        totalFils: 0,
      }).customerId,
    ).toBeNull();
    const pub = toSalePublic({
      id: '1',
      saleNumber: 'S',
      customerId: 'c',
      customer: {
        id: 'c',
        customerNumber: 'CUS-1',
        fullName: 'A',
        phone: '1',
      } as never,
      status: 'draft',
      subtotalFils: 0,
      discountFils: 0,
      taxFils: 0,
      totalFils: 0,
      notes: null,
      completedAt: null,
      items: [
        {
          id: 'li',
          itemId: 'i',
          priceFils: 0,
          discountFils: 0,
          quantity: 1,
          totalFils: 0,
          barcodeSnapshot: null,
          itemNameSnapshot: 'n',
          item: {
            id: 'i',
            internalCode: 'ITM',
            displayName: 'n',
            status: 'active',
            lifecycleState: 'available',
            salePrice: 0,
          },
        },
      ],
      settlement: {
        id: 'st',
        settlementNumber: 'STL',
        status: 'open',
        totalFils: 0,
        paidFils: 0,
        remainingFils: 0,
        customerId: 'c',
        accountId: 'a',
      },
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    } as never);
    expect(pub.customer?.fullName).toBe('A');
    expect(pub.settlement?.id).toBe('st');
  });
});

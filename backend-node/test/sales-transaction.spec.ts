import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../src/shared/errors/business.exception';
import { SalesTransactionService } from '../src/sales/sales-transaction.service';
import { SALE_STATUS } from '../src/sales/sales.constants';

describe('SalesTransactionService unit', () => {
  const repo = {
    client: {},
    findById: vi.fn(),
    findByIdInTx: vi.fn(),
    transitionStatus: vi.fn(),
    updateCustomerInTx: vi.fn(),
  };
  const availability = {
    runExclusive: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        customer: { findFirst: vi.fn(), findUnique: vi.fn() },
        item: { findFirst: vi.fn() },
        rentalSettlement: { findFirst: vi.fn() },
      }),
    ),
  };
  const lifecycle = { transition: vi.fn() };
  const settlements = {
    createForEntityInTx: vi.fn(),
    applySaleCancelPolicyInTx: vi.fn(),
    applyPayment: vi.fn(),
    findBySaleId: vi.fn(),
    reassignCustomerInTx: vi.fn(),
    settlementRepo: { applyPaymentCas: vi.fn() },
  };
  const finance = {
    peekIdempotencyReplay: vi.fn(),
    createChargeInTx: vi.fn(),
    allocatePaymentNumberInTx: vi.fn(),
    registerPaymentInTx: vi.fn(),
  };
  const customers = {
    ensureWalkInCustomer: vi.fn(),
  };
  const audit = { record: vi.fn() };

  let service: SalesTransactionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SalesTransactionService(
      repo as never,
      availability as never,
      lifecycle as never,
      settlements as never,
      finance as never,
      customers as never,
      audit as never,
    );
  });

  it('resolveFinanceCustomerId uses walk-in when null', async () => {
    customers.ensureWalkInCustomer.mockResolvedValue({ id: 'w' });
    await expect(service.resolveFinanceCustomerId(null)).resolves.toBe('w');
    await expect(service.resolveFinanceCustomerId('c1')).resolves.toBe('c1');
  });

  it('rejects confirm/complete/cancel/payment on bad status', async () => {
    const base = {
      id: 's',
      customerId: null,
      items: [],
      history: [],
      saleNumber: 'S',
      subtotalFils: 0,
      discountFils: 0,
      taxFils: 0,
      totalFils: 0,
      notes: null,
      completedAt: null,
      settlement: null,
      customer: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    };
    repo.findById.mockResolvedValue({
      ...base,
      status: SALE_STATUS.COMPLETED,
    });
    finance.peekIdempotencyReplay.mockResolvedValue(null);
    await expect(service.confirm('s', {})).resolves.toMatchObject({
      status: SALE_STATUS.COMPLETED,
    });

    repo.findById.mockResolvedValue({
      ...base,
      status: SALE_STATUS.DRAFT,
    });
    await expect(service.complete('s', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.payment('s', { amountFils: 1 })).rejects.toBeInstanceOf(
      BusinessException,
    );

    repo.findById.mockResolvedValue({
      ...base,
      status: SALE_STATUS.COMPLETED,
    });
    await expect(service.cancel('s')).rejects.toBeInstanceOf(BusinessException);
  });

  it('confirm happy path posts settlement and charge', async () => {
    const saleRow = {
      id: 's1',
      status: SALE_STATUS.DRAFT,
      customerId: null,
      saleNumber: 'SALE-1',
      totalFils: 500,
      subtotalFils: 500,
      discountFils: 0,
      taxFils: 0,
      notes: null,
      completedAt: null,
      settlement: null,
      customer: null,
      history: [],
      items: [{ itemId: 'i1', id: 'li1' }],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    };
    repo.findById.mockResolvedValue(saleRow);
    const tx = {
      customer: {
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: 'w', deletedAt: null }),
      },
      item: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'i1',
          displayName: 'D',
          deletedAt: null,
          status: 'active',
          lifecycleState: 'available',
        }),
      },
      rentalSettlement: { findFirst: vi.fn() },
      financeIdempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    availability.runExclusive.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );
    repo.findByIdInTx.mockResolvedValue({ ...saleRow });
    lifecycle.transition.mockResolvedValue({});
    settlements.createForEntityInTx.mockResolvedValue({ id: 'st1' });
    finance.createChargeInTx.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue({
      ...saleRow,
      status: SALE_STATUS.CONFIRMED,
      settlement: {
        id: 'st1',
        settlementNumber: 'STL',
        status: 'open',
        totalFils: 500,
        paidFils: 0,
        remainingFils: 500,
        customerId: 'w',
        accountId: 'a',
      },
    });

    const result = await service.confirm('s1', { idempotencyKey: 'k1' });
    expect(result.status).toBe(SALE_STATUS.CONFIRMED);
    expect(lifecycle.transition).toHaveBeenCalled();
    expect(settlements.createForEntityInTx).toHaveBeenCalled();
    expect(finance.createChargeInTx).toHaveBeenCalled();
  });

  it('cancel confirmed restores inventory via policy', async () => {
    const saleRow = {
      id: 's1',
      status: SALE_STATUS.CONFIRMED,
      customerId: 'c1',
      saleNumber: 'SALE-1',
      totalFils: 500,
      subtotalFils: 500,
      discountFils: 0,
      taxFils: 0,
      notes: null,
      completedAt: null,
      settlement: { id: 'st' },
      customer: null,
      history: [],
      items: [{ itemId: 'i1' }],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    };
    repo.findById.mockResolvedValue(saleRow);
    const tx = {
      item: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'i1',
          lifecycleState: 'for_sale',
          deletedAt: null,
        }),
      },
      customer: { findFirst: vi.fn(), findUnique: vi.fn() },
      rentalSettlement: { findFirst: vi.fn() },
    };
    availability.runExclusive.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );
    repo.findByIdInTx.mockResolvedValue(saleRow);
    settlements.applySaleCancelPolicyInTx.mockResolvedValue({
      kind: 'cancel_open_unpaid',
    });
    lifecycle.transition.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue({
      ...saleRow,
      status: SALE_STATUS.CANCELLED,
      settlement: null,
    });
    const result = await service.cancel('s1', 'abort');
    expect(result.status).toBe(SALE_STATUS.CANCELLED);
    expect(settlements.applySaleCancelPolicyInTx).toHaveBeenCalled();
    expect(lifecycle.transition).toHaveBeenCalled();
  });

  it('complete sells held items and optional payment', async () => {
    const saleRow = {
      id: 's1',
      status: SALE_STATUS.CONFIRMED,
      customerId: null,
      saleNumber: 'SALE-1',
      totalFils: 500,
      subtotalFils: 500,
      discountFils: 0,
      taxFils: 0,
      notes: null,
      completedAt: null,
      settlement: null,
      customer: null,
      history: [],
      items: [{ itemId: 'i1' }],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    };
    repo.findById.mockResolvedValue(saleRow);
    finance.peekIdempotencyReplay.mockResolvedValue(null);
    const tx = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c2', deletedAt: null }),
        findUnique: vi.fn(),
      },
      item: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'i1',
          displayName: 'D',
          deletedAt: null,
          lifecycleState: 'for_sale',
        }),
      },
      rentalSettlement: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'st1',
          accountId: 'a1',
          remainingFils: 500,
          paidFils: 0,
          status: 'open',
          entityType: 'sale',
        }),
      },
      financeIdempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    availability.runExclusive.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );
    repo.findByIdInTx.mockResolvedValue(saleRow);
    settlements.findBySaleId.mockResolvedValue({ id: 'st1' });
    lifecycle.transition.mockResolvedValue({});
    finance.allocatePaymentNumberInTx.mockResolvedValue('PAY-1');
    finance.registerPaymentInTx.mockResolvedValue({ id: 'p1' });
    settlements.settlementRepo.applyPaymentCas.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue({
      ...saleRow,
      status: SALE_STATUS.COMPLETED,
      completedAt: new Date(),
      customerId: 'c2',
    });
    repo.updateCustomerInTx.mockResolvedValue(undefined);
    settlements.reassignCustomerInTx.mockResolvedValue({});

    const result = await service.complete('s1', {
      customerId: 'c2',
      paymentAmountFils: 500,
      idempotencyKey: 'complete-1',
    });
    expect(result.status).toBe(SALE_STATUS.COMPLETED);
    expect(lifecycle.transition).toHaveBeenCalled();
    expect(finance.registerPaymentInTx).toHaveBeenCalled();
  });
});

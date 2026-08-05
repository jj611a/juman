import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../src/shared/errors/business.exception';
import { SalesTransactionService } from '../src/sales/sales-transaction.service';
import { SALE_STATUS } from '../src/sales/sales.constants';

function baseSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    status: SALE_STATUS.DRAFT,
    customerId: null as string | null,
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
    ...overrides,
  };
}

describe('SalesTransactionService unit (6.7.1)', () => {
  const repo = {
    client: {},
    findById: vi.fn(),
    findByIdInTx: vi.fn(),
    transitionStatus: vi.fn(),
    updateCustomerInTx: vi.fn(),
  };
  const availability = {
    runExclusive: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx()),
    ),
  };
  const lifecycle = { transition: vi.fn() };
  const settlements = {
    createForEntityInTx: vi.fn(),
    applySaleCancelPolicyInTx: vi.fn(),
    applyPayment: vi.fn(),
    applyPaymentInTx: vi.fn(),
    findBySaleId: vi.fn(),
    reassignCustomerInTx: vi.fn(),
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
  let tx: ReturnType<typeof makeTx>;

  function makeTx() {
    return {
      customer: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      item: { findFirst: vi.fn() },
      saleItem: { findFirst: vi.fn() },
      itemStateHistory: { findFirst: vi.fn() },
      rentalSettlement: { findFirst: vi.fn() },
      financeIdempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
    availability.runExclusive.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    );
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

  it('rejects complete/payment/cancel on bad status', async () => {
    repo.findById.mockResolvedValue(baseSale({ status: SALE_STATUS.DRAFT }));
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.payment('s1', { amountFils: 1 })).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.findById.mockResolvedValue(baseSale({ status: SALE_STATUS.COMPLETED }));
    finance.peekIdempotencyReplay.mockResolvedValue(null);
    await expect(service.cancel('s1')).rejects.toBeInstanceOf(BusinessException);
  });

  it('confirm happy path holds available item', async () => {
    const saleRow = baseSale();
    repo.findById.mockResolvedValue(saleRow);
    tx.customer.findUnique.mockResolvedValue({ id: 'w', deletedAt: null });
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
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
  });

  it('confirm rejects foreign for_sale hold', async () => {
    const saleRow = baseSale();
    repo.findById.mockResolvedValue(saleRow);
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'for_sale',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 'other-sale',
    });
    repo.findByIdInTx.mockResolvedValue(saleRow);
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('confirm returns early when already confirmed without replay', async () => {
    repo.findById.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED }),
    );
    finance.peekIdempotencyReplay.mockResolvedValue(null);
    const r = await service.confirm('s1', {});
    expect(r.status).toBe(SALE_STATUS.CONFIRMED);
  });

  it('confirm replays idempotent response', async () => {
    repo.findById.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED }),
    );
    finance.peekIdempotencyReplay.mockResolvedValue({
      id: 's1',
      status: SALE_STATUS.CONFIRMED,
      saleNumber: 'SALE-1',
    });
    const r = await service.confirm('s1', { idempotencyKey: 'k' });
    expect(r.id).toBe('s1');
  });

  it('confirm rejects item already on another confirmed sale', async () => {
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue({ id: 'other' });
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('confirm rejects missing / unsellable / wrong lifecycle item', async () => {
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.item.findFirst.mockResolvedValue(null);
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'rented',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('confirm reuses own for_sale hold', async () => {
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findUnique.mockResolvedValue({ id: 'w', deletedAt: null });
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'for_sale',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 's1',
    });
    settlements.createForEntityInTx.mockResolvedValue({ id: 'st1' });
    finance.createChargeInTx.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED }),
    );
    await service.confirm('s1', {});
    expect(lifecycle.transition).not.toHaveBeenCalled();
  });

  it('confirm creates walk-in inside TX when missing', async () => {
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findUnique.mockResolvedValue(null);
    tx.customer.create.mockResolvedValue({ id: 'w-new' });
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    lifecycle.transition.mockResolvedValue({});
    settlements.createForEntityInTx.mockResolvedValue({ id: 'st1' });
    finance.createChargeInTx.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED }),
    );
    await service.confirm('s1', {});
    expect(tx.customer.create).toHaveBeenCalled();
  });

  it('confirm restores soft-deleted walk-in', async () => {
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findUnique.mockResolvedValue({ id: 'w', deletedAt: new Date() });
    tx.customer.update.mockResolvedValue({});
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    lifecycle.transition.mockResolvedValue({});
    settlements.createForEntityInTx.mockResolvedValue({ id: 'st1' });
    finance.createChargeInTx.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED }),
    );
    await service.confirm('s1', {});
    expect(tx.customer.update).toHaveBeenCalled();
  });

  it('confirm handles walk-in create race', async () => {
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'w-raced', deletedAt: null });
    tx.customer.create.mockRejectedValue(new Error('unique'));
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    lifecycle.transition.mockResolvedValue({});
    settlements.createForEntityInTx.mockResolvedValue({ id: 'st1' });
    finance.createChargeInTx.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED }),
    );
    await service.confirm('s1', {});
    expect(settlements.createForEntityInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ customerId: 'w-raced' }),
      undefined,
    );
  });

  it('confirm with customerId updates sale customer', async () => {
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findFirst.mockResolvedValue({ id: 'c1', status: 'active' });
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    lifecycle.transition.mockResolvedValue({});
    settlements.createForEntityInTx.mockResolvedValue({ id: 'st1' });
    finance.createChargeInTx.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED, customerId: 'c1' }),
    );
    await service.confirm('s1', { customerId: 'c1' });
    expect(repo.updateCustomerInTx).toHaveBeenCalled();
  });

  it('complete happy path marks sold and optional payment', async () => {
    const confirmed = baseSale({ status: SALE_STATUS.CONFIRMED });
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    settlements.findBySaleId.mockResolvedValue({
      id: 'st1',
      status: 'open',
      paidFils: 0,
    });
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      lifecycleState: 'for_sale',
      deletedAt: null,
    });
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 's1',
    });
    finance.allocatePaymentNumberInTx.mockResolvedValue('PAY-1');
    settlements.applyPaymentInTx.mockResolvedValue({});
    lifecycle.transition.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.COMPLETED }),
    );
    const r = await service.complete('s1', { paymentAmountFils: 500 });
    expect(r.status).toBe(SALE_STATUS.COMPLETED);
    expect(settlements.applyPaymentInTx).toHaveBeenCalled();
  });

  it('complete rejects cancelled settlement and wrong lifecycle', async () => {
    const confirmed = baseSale({ status: SALE_STATUS.CONFIRMED });
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    settlements.findBySaleId.mockResolvedValue({
      id: 'st1',
      status: 'cancelled',
    });
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    settlements.findBySaleId.mockResolvedValue({ id: 'st1', status: 'open' });
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      lifecycleState: 'available',
      deletedAt: null,
    });
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 's1',
    });
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('complete reassigns customer when unpaid', async () => {
    const confirmed = baseSale({
      status: SALE_STATUS.CONFIRMED,
      customerId: null,
    });
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    tx.customer.findFirst.mockResolvedValue({ id: 'c2', status: 'active' });
    settlements.findBySaleId.mockResolvedValue({
      id: 'st1',
      status: 'open',
      paidFils: 0,
    });
    settlements.reassignCustomerInTx.mockResolvedValue({});
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      lifecycleState: 'for_sale',
      deletedAt: null,
    });
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 's1',
    });
    lifecycle.transition.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.COMPLETED, customerId: 'c2' }),
    );
    await service.complete('s1', { customerId: 'c2' });
    expect(settlements.reassignCustomerInTx).toHaveBeenCalled();
  });

  it('complete rejects reassignment after payment', async () => {
    const confirmed = baseSale({
      status: SALE_STATUS.CONFIRMED,
      customerId: null,
    });
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    tx.customer.findFirst.mockResolvedValue({ id: 'c2', status: 'active' });
    settlements.findBySaleId.mockResolvedValue({
      id: 'st1',
      status: 'open',
      paidFils: 100,
    });
    settlements.reassignCustomerInTx.mockRejectedValue(
      BusinessException.conflict('Cannot reassign after payment'),
    );
    await expect(
      service.complete('s1', { customerId: 'c2' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('cancel confirmed restores inventory and voids settlement', async () => {
    const confirmed = baseSale({ status: SALE_STATUS.CONFIRMED });
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    settlements.applySaleCancelPolicyInTx.mockResolvedValue({});
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      lifecycleState: 'for_sale',
      deletedAt: null,
    });
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 's1',
    });
    lifecycle.transition.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CANCELLED }),
    );
    const r = await service.cancel('s1', 'nope');
    expect(r.status).toBe(SALE_STATUS.CANCELLED);
    expect(settlements.applySaleCancelPolicyInTx).toHaveBeenCalled();
  });

  it('cancel draft skips settlement policy', async () => {
    repo.findById.mockResolvedValue(baseSale({ status: SALE_STATUS.DRAFT }));
    repo.findByIdInTx.mockResolvedValue(baseSale({ status: SALE_STATUS.DRAFT }));
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CANCELLED }),
    );
    await service.cancel('s1');
    expect(settlements.applySaleCancelPolicyInTx).not.toHaveBeenCalled();
  });

  it('cancel returns early when already cancelled', async () => {
    repo.findById.mockResolvedValue(baseSale({ status: SALE_STATUS.CANCELLED }));
    finance.peekIdempotencyReplay.mockResolvedValue(null);
    const r = await service.cancel('s1');
    expect(r.status).toBe(SALE_STATUS.CANCELLED);
  });

  it('payment happy path and rejects cancelled/closed settlement', async () => {
    const confirmed = baseSale({ status: SALE_STATUS.CONFIRMED });
    repo.findById
      .mockResolvedValueOnce(confirmed)
      .mockResolvedValueOnce(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    settlements.findBySaleId.mockResolvedValue({
      id: 'st1',
      status: 'open',
    });
    finance.allocatePaymentNumberInTx.mockResolvedValue('PAY-1');
    settlements.applyPaymentInTx.mockResolvedValue({});
    await service.payment('s1', { amountFils: 100 });
    expect(settlements.applyPaymentInTx).toHaveBeenCalled();

    settlements.findBySaleId.mockResolvedValue({
      id: 'st1',
      status: 'cancelled',
    });
    await expect(
      service.payment('s1', { amountFils: 50 }),
    ).rejects.toBeInstanceOf(BusinessException);

    settlements.findBySaleId.mockResolvedValue({
      id: 'st1',
      status: 'closed',
    });
    await expect(
      service.payment('s1', { amountFils: 50 }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('confirm rejects cancelled and missing customer', async () => {
    repo.findById.mockResolvedValue(baseSale({ status: SALE_STATUS.CANCELLED }));
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.confirm('s1', { customerId: 'missing' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('confirm/complete/cancel/payment handle in-TX replays and races', async () => {
    const confirmed = baseSale({ status: SALE_STATUS.CONFIRMED });
    // confirm idempotency replay inside exclusive TX
    repo.findById.mockResolvedValue(baseSale());
    tx.financeIdempotencyKey.findUnique.mockResolvedValue({
      requestHash: expect.anything(),
      status: 'completed',
      responseJson: JSON.stringify({
        id: 's1',
        status: SALE_STATUS.CONFIRMED,
        saleNumber: 'SALE-1',
        customerId: null,
        customer: null,
        subtotalFils: 500,
        discountFils: 0,
        taxFils: 0,
        totalFils: 500,
        notes: null,
        completedAt: null,
        items: [],
        settlement: null,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
    // beginIdempotency compares hash — set matching hash via findUnique returning completed
    // Need same hash as computed — easier: mock findUnique to return completed with any hash matching after first create path
    // Use processing→completed with exact approach: return completed with null requestHash (skips mismatch)
    tx.financeIdempotencyKey.findUnique.mockResolvedValue({
      requestHash: null,
      status: 'completed',
      responseJson: JSON.stringify({
        id: 's1',
        saleNumber: 'SALE-1',
        status: SALE_STATUS.CONFIRMED,
        customerId: null,
        customer: null,
        subtotalFils: 0,
        discountFils: 0,
        taxFils: 0,
        totalFils: 0,
        notes: null,
        completedAt: null,
        items: [],
        settlement: null,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
    const replayed = await service.confirm('s1', { idempotencyKey: 'replay-k' });
    expect(replayed.status).toBe(SALE_STATUS.CONFIRMED);

    // confirm: live missing / not draft
    tx.financeIdempotencyKey.findUnique.mockResolvedValue(null);
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(null);
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.findByIdInTx.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CONFIRMED }),
    );
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    // confirm concurrent CAS miss
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findUnique.mockResolvedValue({ id: 'w', deletedAt: null });
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    lifecycle.transition.mockResolvedValue({});
    settlements.createForEntityInTx.mockResolvedValue({ id: 'st1' });
    finance.createChargeInTx.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(null);
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    // complete already completed + peek replay
    repo.findById.mockResolvedValue(
      baseSale({ status: SALE_STATUS.COMPLETED }),
    );
    finance.peekIdempotencyReplay.mockResolvedValue({
      id: 's1',
      status: SALE_STATUS.COMPLETED,
    });
    await expect(
      service.complete('s1', { idempotencyKey: 'c' }),
    ).resolves.toMatchObject({ id: 's1' });

    // complete: no settlement / missing item
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    tx.financeIdempotencyKey.findUnique.mockResolvedValue(null);
    settlements.findBySaleId.mockResolvedValue(null);
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
    settlements.findBySaleId.mockResolvedValue({ id: 'st', status: 'open' });
    tx.item.findFirst.mockResolvedValue(null);
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    // complete CAS miss
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      lifecycleState: 'for_sale',
      deletedAt: null,
    });
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 's1',
    });
    lifecycle.transition.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(null);
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    // complete in-TX not confirmed / missing
    repo.findByIdInTx.mockResolvedValue(null);
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.findByIdInTx.mockResolvedValue(baseSale({ status: SALE_STATUS.DRAFT }));
    await expect(service.complete('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );

    // cancel already cancelled with peek
    repo.findById.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CANCELLED }),
    );
    finance.peekIdempotencyReplay.mockResolvedValue({
      id: 's1',
      status: SALE_STATUS.CANCELLED,
    });
    await expect(service.cancel('s1', undefined, undefined, 'k')).resolves.toMatchObject({
      id: 's1',
    });

    // cancel: missing live / cannot cancel inside TX
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(null);
    tx.financeIdempotencyKey.findUnique.mockResolvedValue(null);
    await expect(service.cancel('s1')).rejects.toBeInstanceOf(BusinessException);
    repo.findByIdInTx.mockResolvedValue(
      baseSale({ status: SALE_STATUS.COMPLETED }),
    );
    await expect(service.cancel('s1')).rejects.toBeInstanceOf(BusinessException);

    // cancel: missing item / foreign hold skipped; CAS miss
    repo.findByIdInTx.mockResolvedValue(confirmed);
    settlements.applySaleCancelPolicyInTx.mockResolvedValue({});
    tx.item.findFirst.mockResolvedValueOnce(null);
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CANCELLED }),
    );
    await service.cancel('s1');

    repo.findByIdInTx.mockResolvedValue(confirmed);
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      lifecycleState: 'for_sale',
      deletedAt: null,
    });
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 'other',
    });
    repo.transitionStatus.mockResolvedValue(
      baseSale({ status: SALE_STATUS.CANCELLED }),
    );
    await service.cancel('s1');

    repo.findByIdInTx.mockResolvedValue(confirmed);
    tx.itemStateHistory.findFirst.mockResolvedValue({
      referenceType: 'sale',
      referenceId: 's1',
    });
    lifecycle.transition.mockResolvedValue({});
    repo.transitionStatus.mockResolvedValue(null);
    await expect(service.cancel('s1')).rejects.toBeInstanceOf(BusinessException);

    // payment replay + cannot pay inside TX
    repo.findById.mockResolvedValue(confirmed);
    tx.financeIdempotencyKey.findUnique.mockResolvedValue({
      requestHash: null,
      status: 'completed',
      responseJson: JSON.stringify({ ok: true }),
    });
    repo.findById.mockResolvedValue(confirmed);
    await service.payment('s1', { amountFils: 1, idempotencyKey: 'pay-r' });

    tx.financeIdempotencyKey.findUnique.mockResolvedValue(null);
    repo.findByIdInTx.mockResolvedValue(
      baseSale({ status: SALE_STATUS.DRAFT }),
    );
    await expect(
      service.payment('s1', { amountFils: 1 }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('reassign rejects missing customer; walk-in race failure', async () => {
    const confirmed = baseSale({
      status: SALE_STATUS.CONFIRMED,
      customerId: null,
    });
    repo.findById.mockResolvedValue(confirmed);
    repo.findByIdInTx.mockResolvedValue(confirmed);
    tx.financeIdempotencyKey.findUnique.mockResolvedValue(null);
    tx.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.complete('s1', { customerId: 'nope' }),
    ).rejects.toBeInstanceOf(BusinessException);

    // walk-in create race with deleted raced row
    repo.findById.mockResolvedValue(baseSale());
    repo.findByIdInTx.mockResolvedValue(baseSale());
    tx.customer.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'w', deletedAt: new Date() });
    tx.customer.create.mockRejectedValue(new Error('unique'));
    tx.item.findFirst.mockResolvedValue({
      id: 'i1',
      displayName: 'D',
      deletedAt: null,
      status: 'active',
      lifecycleState: 'available',
    });
    tx.saleItem.findFirst.mockResolvedValue(null);
    lifecycle.transition.mockResolvedValue({});
    await expect(service.confirm('s1', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('requireLive throws when missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.confirm('missing', {})).rejects.toBeInstanceOf(
      BusinessException,
    );
  });
});

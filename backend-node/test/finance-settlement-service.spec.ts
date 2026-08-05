import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettlementService } from '../src/finance/settlement/settlement.service';
import {
  SETTLEMENT_STATUS,
  SETTLEMENT_STATUS_TRANSITIONS,
} from '../src/finance/settlement/settlement.constants';
import {
  canApplyPayment,
  canCancel,
  canClose,
  canTransitionSettlementStatus,
  isFinanciallyComplete,
  isSettlementStatus,
  statusAfterPayment,
} from '../src/finance/settlement/settlement.rules';
import { toSettlementPublic } from '../src/finance/settlement/settlement.mapper';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('settlement.rules', () => {
  it('validates status graph and payment status derivation', () => {
    expect(isSettlementStatus('open')).toBe(true);
    expect(isSettlementStatus('nope')).toBe(false);
    expect(
      canTransitionSettlementStatus(
        SETTLEMENT_STATUS.OPEN,
        SETTLEMENT_STATUS.PAID,
      ),
    ).toBe(true);
    expect(
      canTransitionSettlementStatus(
        SETTLEMENT_STATUS.CLOSED,
        SETTLEMENT_STATUS.OPEN,
      ),
    ).toBe(false);
    expect(statusAfterPayment(0, 1000)).toBe(SETTLEMENT_STATUS.PAID);
    expect(statusAfterPayment(500, 500)).toBe(SETTLEMENT_STATUS.PARTIALLY_PAID);
    expect(statusAfterPayment(1000, 0)).toBe(SETTLEMENT_STATUS.OPEN);
    expect(canApplyPayment(SETTLEMENT_STATUS.OPEN)).toBe(true);
    expect(canApplyPayment(SETTLEMENT_STATUS.PAID)).toBe(false);
    expect(canClose(SETTLEMENT_STATUS.PAID)).toBe(true);
    expect(canClose(SETTLEMENT_STATUS.OPEN)).toBe(false);
    expect(canCancel(SETTLEMENT_STATUS.OPEN)).toBe(true);
    expect(canCancel(SETTLEMENT_STATUS.PARTIALLY_PAID)).toBe(false);
    expect(canCancel(SETTLEMENT_STATUS.CLOSED)).toBe(false);
    expect(isFinanciallyComplete(SETTLEMENT_STATUS.PAID)).toBe(true);
    expect(isFinanciallyComplete(SETTLEMENT_STATUS.OPEN)).toBe(false);
    expect(Object.keys(SETTLEMENT_STATUS_TRANSITIONS).length).toBe(5);
  });
});

describe('SettlementService', () => {
  const settlementBase = {
    id: 's1',
    settlementNumber: 'STL-00000001',
    rentalId: 'r1',
    accountId: 'a1',
    customerId: 'c1',
    totalFils: 4000,
    paidFils: 0,
    remainingFils: 4000,
    chargeFils: 4000,
    depositFils: 0,
    lateFeeFils: 0,
    adjustmentFils: 0,
    discountFils: 0,
    refundFils: 0,
    status: SETTLEMENT_STATUS.OPEN,
    currency: 'IQD',
    notes: null,
    closedAt: null,
    cancelledAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    history: [],
    refunds: [],
    adjustments: [],
    discounts: [],
    lateFees: [],
    rental: {
      id: 'r1',
      rentalNumber: 'RENT-1',
      status: 'checked_out',
      customerId: 'c1',
    },
    account: {
      id: 'a1',
      accountNumber: 'FIN-1',
      customerId: 'c1',
      status: 'open',
    },
  };

  const repo = {
    client: { $transaction: vi.fn() },
    nextSequence: vi.fn(),
    findById: vi.fn(),
    findByRentalId: vi.fn(),
    findByEntity: vi.fn(),
    findAnyNumber: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    applyPaymentCas: vi.fn(),
    transitionStatus: vi.fn(),
    lockSettlement: vi.fn(),
  };
  const finance = {
    ensureAccountForCustomer: vi.fn(),
    ensureAccountForCustomerInTx: vi.fn(),
    allocatePaymentNumberPublic: vi.fn(),
    registerPaymentInTx: vi.fn(),
    voidSettlementObligationLedgerInTx: vi.fn(),
  };
  const settings = {
    getString: vi.fn(async (_: string, f: string) => f),
    getInt: vi.fn(async (_: string, f: number) => f),
  };
  const audit = { record: vi.fn() };
  let service: SettlementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SettlementService(
      repo as never,
      finance as never,
      { applyRefund: vi.fn(), applyAdjustment: vi.fn(), applyDiscount: vi.fn(), assessLateFee: vi.fn() } as never,
      settings as never,
      audit as never,
    );
    repo.nextSequence.mockResolvedValue(1);
    repo.findAnyNumber.mockResolvedValue(null);
    repo.findByEntity.mockResolvedValue(null);
    repo.lockSettlement.mockResolvedValue(undefined);
    finance.ensureAccountForCustomer.mockResolvedValue({
      id: 'a1',
      accountNumber: 'FIN-1',
    });
    finance.ensureAccountForCustomerInTx.mockResolvedValue({
      id: 'a1',
      accountNumber: 'FIN-1',
    });
    finance.allocatePaymentNumberPublic.mockResolvedValue('PAY-00000001');
    finance.voidSettlementObligationLedgerInTx.mockResolvedValue(0);
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: {
        rentalSettlement: {
          findFirst: ReturnType<typeof vi.fn>;
          findUnique: ReturnType<typeof vi.fn>;
        };
        financeIdempotencyKey: {
          findUnique: ReturnType<typeof vi.fn>;
          create: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        };
      }) => Promise<unknown>) => {
        const tx = {
          rentalSettlement: {
            findFirst: vi.fn().mockResolvedValue(null),
            findUnique: vi.fn().mockResolvedValue(null),
          },
          financeIdempotencyKey: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            update: vi.fn(),
          },
        };
        return fn(tx);
      },
    );
  });

  it('maps public settlement shape', () => {
    const pub = toSettlementPublic(settlementBase as never);
    expect(pub.settlementNumber).toBe('STL-00000001');
    expect(pub.remainingMajor).toBe('4.000');
    expect(pub.history).toEqual([]);
  });

  it('creates settlement idempotently and rejects deposit over charge', async () => {
    repo.findByRentalId.mockResolvedValueOnce(settlementBase);
    const existing = await service.createForRental({
      rentalId: 'r1',
      customerId: 'c1',
      chargeFils: 4000,
      depositFils: 1000,
    });
    expect(existing.id).toBe('s1');
    expect(repo.create).not.toHaveBeenCalled();

    await expect(
      service.createForRental({
        rentalId: 'r2',
        customerId: 'c1',
        chargeFils: 1000,
        depositFils: 2000,
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findByRentalId.mockResolvedValue(null);
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: {
        rentalSettlement: {
          findFirst: ReturnType<typeof vi.fn>;
          findUnique: ReturnType<typeof vi.fn>;
        };
      }) => Promise<unknown>) => {
        const tx = {
          rentalSettlement: {
            findFirst: vi.fn().mockResolvedValue(null),
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      },
    );
    const created = {
      ...settlementBase,
      id: 's2',
      rentalId: 'r2',
      totalFils: 3000,
      remainingFils: 3000,
    };
    repo.create.mockResolvedValue(created);
    const row = await service.createForRental(
      { rentalId: 'r2', customerId: 'c1', chargeFils: 4000, depositFils: 1000 },
      { userId: 'u1', username: 'admin' } as never,
    );
    expect(row.totalFils).toBe(3000);
    expect(audit.record).toHaveBeenCalled();

    // zero remaining → paid
    repo.create.mockResolvedValue({
      ...settlementBase,
      id: 's0',
      totalFils: 0,
      remainingFils: 0,
      status: SETTLEMENT_STATUS.PAID,
    });
    const zero = await service.createForRental({
      rentalId: 'r0',
      customerId: 'c1',
      chargeFils: 1000,
      depositFils: 1000,
    });
    expect(zero.status).toBe(SETTLEMENT_STATUS.PAID);
  });

  it('lists filters and gets by id', async () => {
    repo.list.mockResolvedValue({ rows: [settlementBase], total: 1 });
    const page = await service.list({ status: 'open', customerId: 'c1' });
    expect(page.meta.total).toBe(1);

    await expect(service.list({ status: 'bad' })).rejects.toBeInstanceOf(
      BusinessException,
    );

    repo.findById.mockResolvedValue(settlementBase);
    expect((await service.getById('s1')).id).toBe('s1');
    const out = await service.outstandingOf('s1');
    expect(out.remainingFils).toBe(4000);

    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('applies payment updating balances without editing Payment rows', async () => {
    repo.findById.mockResolvedValue(settlementBase);
    const payment = { id: 'p1', amountFils: 1500 };
    const updated = {
      ...settlementBase,
      paidFils: 1500,
      remainingFils: 2500,
      status: SETTLEMENT_STATUS.PARTIALLY_PAID,
    };
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: {
        rentalSettlement: { findFirst: ReturnType<typeof vi.fn> };
      }) => Promise<unknown>) => {
        const tx = {
          rentalSettlement: {
            findFirst: vi.fn().mockResolvedValue(settlementBase),
          },
        };
        return fn(tx);
      },
    );
    finance.registerPaymentInTx.mockResolvedValue(payment);
    repo.applyPaymentCas.mockResolvedValue(updated);

    const result = await service.applyPayment(
      's1',
      { amountFils: 1500, method: 'cash' },
      { userId: 'u1' } as never,
    );
    expect(result.status).toBe(SETTLEMENT_STATUS.PARTIALLY_PAID);
    expect(finance.registerPaymentInTx).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment_applied' }),
    );

    await expect(
      service.applyPayment('s1', { amountFils: 99999 }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({
      ...settlementBase,
      status: SETTLEMENT_STATUS.CLOSED,
    });
    await expect(
      service.applyPayment('s1', { amountFils: 100 }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('rejects concurrent CAS payment and overpayment inside TX', async () => {
    repo.findById.mockResolvedValue(settlementBase);
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: {
        rentalSettlement: { findFirst: ReturnType<typeof vi.fn> };
      }) => Promise<unknown>) => {
        const tx = {
          rentalSettlement: {
            findFirst: vi.fn().mockResolvedValue(settlementBase),
          },
        };
        return fn(tx);
      },
    );
    finance.registerPaymentInTx.mockResolvedValue({ id: 'p2' });
    repo.applyPaymentCas.mockResolvedValue(null);
    await expect(
      service.applyPayment('s1', { amountFils: 100 }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.client.$transaction.mockImplementation(
      async (fn: (tx: {
        rentalSettlement: { findFirst: ReturnType<typeof vi.fn> };
      }) => Promise<unknown>) => {
        const tx = {
          rentalSettlement: {
            findFirst: vi.fn().mockResolvedValue({
              ...settlementBase,
              remainingFils: 50,
            }),
          },
        };
        return fn(tx);
      },
    );
    await expect(
      service.applyPayment('s1', { amountFils: 100 }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('marks paid closes cancels and asserts financial completion', async () => {
    const paidZero = {
      ...settlementBase,
      paidFils: 0,
      remainingFils: 0,
      totalFils: 0,
      status: SETTLEMENT_STATUS.OPEN,
    };
    repo.findById.mockResolvedValue(paidZero);
    repo.transitionStatus.mockResolvedValue({
      ...paidZero,
      status: SETTLEMENT_STATUS.PAID,
    });
    const marked = await service.markPaid('s1');
    expect(marked.status).toBe(SETTLEMENT_STATUS.PAID);

    repo.findById.mockResolvedValue({
      ...paidZero,
      status: SETTLEMENT_STATUS.PAID,
    });
    expect((await service.markPaid('s1')).status).toBe(SETTLEMENT_STATUS.PAID);

    repo.findById.mockResolvedValue(settlementBase);
    await expect(service.markPaid('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({
      ...settlementBase,
      status: SETTLEMENT_STATUS.PAID,
      remainingFils: 0,
      paidFils: 4000,
    });
    repo.transitionStatus.mockResolvedValue({
      ...settlementBase,
      status: SETTLEMENT_STATUS.CLOSED,
      closedAt: new Date(),
    });
    expect((await service.close('s1', { reason: 'done' })).status).toBe(
      SETTLEMENT_STATUS.CLOSED,
    );

    repo.findById.mockResolvedValue(settlementBase);
    await expect(service.close('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue(settlementBase);
    repo.transitionStatus.mockResolvedValue({
      ...settlementBase,
      status: SETTLEMENT_STATUS.CANCELLED,
    });
    expect((await service.cancel('s1')).status).toBe(SETTLEMENT_STATUS.CANCELLED);

    repo.findById.mockResolvedValue({
      ...settlementBase,
      paidFils: 100,
      status: SETTLEMENT_STATUS.PARTIALLY_PAID,
    });
    await expect(service.cancel('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.findByRentalId.mockResolvedValue({
      ...settlementBase,
      status: SETTLEMENT_STATUS.PAID,
    });
    await service.assertFinanciallyComplete('r1');

    repo.findByRentalId.mockResolvedValue(null);
    await expect(
      service.assertFinanciallyComplete('r1'),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findByRentalId.mockResolvedValue(settlementBase);
    await expect(
      service.assertFinanciallyComplete('r1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('covers allocate number failures and create race', async () => {
    settings.getString.mockImplementation(async (key: string, f: string) => {
      if (key.includes('prefix')) return 'bad prefix';
      return f;
    });
    repo.findByRentalId.mockResolvedValue(null);
    await expect(
      service.createForRental({
        rentalId: 'rx',
        customerId: 'c1',
        chargeFils: 100,
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (_k: string, f: string) => f);
    repo.findByRentalId.mockResolvedValue(null);
    repo.findByEntity.mockResolvedValueOnce(settlementBase);
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
    const raced = await service.createForRental({
      rentalId: 'r1',
      customerId: 'c1',
      chargeFils: 4000,
    });
    expect(raced.id).toBe('s1');
  });

  it('covers mark-paid and transition concurrency edges', async () => {
    repo.findById.mockResolvedValue({
      ...settlementBase,
      remainingFils: 0,
      status: SETTLEMENT_STATUS.CANCELLED,
    });
    await expect(service.markPaid('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({
      ...settlementBase,
      remainingFils: 0,
      status: SETTLEMENT_STATUS.OPEN,
    });
    repo.transitionStatus.mockResolvedValue(null);
    await expect(service.markPaid('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({
      ...settlementBase,
      status: SETTLEMENT_STATUS.PAID,
      remainingFils: 0,
    });
    repo.transitionStatus.mockResolvedValue(null);
    await expect(service.close('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue(settlementBase);
    repo.transitionStatus.mockResolvedValue(null);
    await expect(service.cancel('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({
      ...settlementBase,
      status: SETTLEMENT_STATUS.CLOSED,
    });
    await expect(service.cancel('s1')).rejects.toBeInstanceOf(BusinessException);

    repo.list.mockResolvedValue({ rows: [], total: 0 });
    await service.list({
      q: 'STL',
      rentalId: 'r1',
      accountId: 'a1',
      sortBy: 'remainingFils',
      sortDir: 'asc',
    });
  });
});

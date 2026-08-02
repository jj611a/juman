import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Money } from '../src/finance/money/money.value';
import { FinanceService } from '../src/finance/finance.service';
import {
  computeOutstandingFils,
  toTransactionPublic,
} from '../src/finance/finance.mapper';
import {
  FINANCIAL_TX_TYPE,
  outstandingDeltaFils,
} from '../src/finance/finance.constants';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('Money value object', () => {
  it('adds subtracts and rejects floats', () => {
    const a = Money.ofFils(1500);
    const b = Money.ofNonNegativeFils(500);
    expect(a.add(b).amountFils).toBe(2000);
    expect(a.subtract(b).amountFils).toBe(1000);
    expect(a.toMajorString()).toBe('1.500');
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.ofFils(-1).isNegative()).toBe(true);
    expect(() => Money.ofFils(1.5)).toThrow(BusinessException);
    expect(() => Money.ofNonNegativeFils(-1)).toThrow(BusinessException);
    expect(a.negate().amountFils).toBe(-1500);
    expect(a.equals(Money.ofFils(1500))).toBe(true);
    expect(a.currency).toBe('IQD');
  });

  it('computes outstanding deltas', () => {
    expect(outstandingDeltaFils(FINANCIAL_TX_TYPE.RENTAL_CHARGE, 1000)).toBe(1000);
    expect(outstandingDeltaFils(FINANCIAL_TX_TYPE.PAYMENT, 400)).toBe(-400);
    expect(outstandingDeltaFils(FINANCIAL_TX_TYPE.DEPOSIT, 200)).toBe(-200);
    expect(outstandingDeltaFils(FINANCIAL_TX_TYPE.REFUND, 100)).toBe(100);
    expect(outstandingDeltaFils(FINANCIAL_TX_TYPE.ADJUSTMENT, -50)).toBe(-50);
    expect(outstandingDeltaFils('unknown', 10)).toBe(0);
    expect(
      computeOutstandingFils([
        { type: FINANCIAL_TX_TYPE.RENTAL_CHARGE, amountFils: 5000, status: 'posted' },
        { type: FINANCIAL_TX_TYPE.PAYMENT, amountFils: 2000, status: 'posted' },
        { type: FINANCIAL_TX_TYPE.PAYMENT, amountFils: 1000, status: 'voided' },
      ]),
    ).toBe(3000);
  });
});

describe('FinanceService', () => {
  const repo = {
    client: { $transaction: vi.fn() },
    nextSequence: vi.fn(),
    findAccountById: vi.fn(),
    findAccountByCustomerId: vi.fn(),
    findAnyAccountNumber: vi.fn(),
    findAnyPaymentNumber: vi.fn(),
    createAccount: vi.fn(),
    lockAccount: vi.fn(),
    listAccounts: vi.fn(),
    listTransactions: vi.fn(),
    listPayments: vi.fn(),
    listPostedTransactions: vi.fn(),
    findPostedByReference: vi.fn(),
    createTransaction: vi.fn(),
    createPayment: vi.fn(),
    updatePayment: vi.fn(),
    createMovement: vi.fn(),
    createAudit: vi.fn(),
    countBlockingSettlements: vi.fn(),
    settlementOutstandingFils: vi.fn(),
  };
  const customers = { getById: vi.fn() };
  const settings = {
    getString: vi.fn(async (_: string, f: string) => f),
    getInt: vi.fn(async (_: string, f: number) => f),
  };
  const audit = { record: vi.fn(), recordCreate: vi.fn() };
  let service: FinanceService;

  const account = {
    id: 'a1',
    accountNumber: 'FIN-00000001',
    customerId: 'c1',
    currency: 'IQD',
    status: 'open',
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FinanceService(
      repo as never,
      customers as never,
      settings as never,
      audit as never,
    );
    customers.getById.mockResolvedValue({ id: 'c1', status: 'active' });
    repo.nextSequence.mockResolvedValue(1);
    repo.findAnyAccountNumber.mockResolvedValue(null);
    repo.findAnyPaymentNumber.mockResolvedValue(null);
    repo.findPostedByReference.mockResolvedValue(null);
    repo.listPostedTransactions.mockResolvedValue([]);
    repo.lockAccount.mockResolvedValue(undefined);
    repo.createAudit.mockResolvedValue({});
    repo.createMovement.mockResolvedValue({});
    repo.countBlockingSettlements.mockResolvedValue(0);
    repo.settlementOutstandingFils.mockResolvedValue(null);
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    );
  });

  it('creates charge and registers deposit and payment', async () => {
    repo.createAccount.mockResolvedValue(account);
    const txn = {
      id: 't1',
      accountId: 'a1',
      type: FINANCIAL_TX_TYPE.RENTAL_CHARGE,
      amountFils: 3000,
      status: 'posted',
      referenceType: 'rental',
      referenceId: 'r1',
      description: 'charge',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    };
    repo.createTransaction.mockResolvedValue(txn);

    // ensureAccount finds existing via tx findFirst — mock via createAccount path:
    // ensureAccountInTx uses tx.financialAccount.findFirst — need richer tx mock
    repo.client.$transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        financialAccount: {
          findFirst: vi.fn().mockResolvedValue(account),
        },
      };
      return fn(tx);
    });

    const charge = await service.createCharge(
      {
        customerId: 'c1',
        amountFils: 3000,
        referenceType: 'rental',
        referenceId: 'r1',
      },
      { userId: 'u1', username: 'admin' } as never,
    );
    expect(charge.amountFils).toBe(3000);
    expect(repo.createTransaction).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();

    repo.createTransaction.mockResolvedValue({
      ...txn,
      id: 't2',
      type: FINANCIAL_TX_TYPE.DEPOSIT,
      amountFils: 1000,
    });
    const deposit = await service.registerDeposit({
      customerId: 'c1',
      amountFils: 1000,
      referenceType: 'rental',
      referenceId: 'r1',
    });
    expect(deposit.type).toBe(FINANCIAL_TX_TYPE.DEPOSIT);

    const paymentRow = {
      id: 'p1',
      paymentNumber: 'PAY-00000001',
      accountId: 'a1',
      transactionId: 't3',
      amountFils: 500,
      status: 'completed',
      method: 'cash',
      notes: null,
      completedAt: new Date(),
      cancelledAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      deletedBy: null,
    };
    repo.createPayment.mockResolvedValue({ ...paymentRow, status: 'pending', transactionId: null });
    repo.createTransaction.mockResolvedValue({
      ...txn,
      id: 't3',
      type: FINANCIAL_TX_TYPE.PAYMENT,
      amountFils: 500,
    });
    repo.updatePayment.mockResolvedValue(paymentRow);

    const payment = await service.registerPayment({
      accountId: 'a1',
      amountFils: 500,
      method: 'cash',
    });
    expect(payment.status).toBe('completed');
  });

  it('rejects zero charge and returns idempotent charge', async () => {
    await expect(
      service.createCharge({ customerId: 'c1', amountFils: 0 }),
    ).rejects.toBeInstanceOf(BusinessException);

    const existing = {
      id: 't9',
      accountId: 'a1',
      type: FINANCIAL_TX_TYPE.RENTAL_CHARGE,
      amountFils: 100,
      status: 'posted',
      referenceType: 'rental',
      referenceId: 'r9',
      description: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    };
    repo.findPostedByReference.mockResolvedValueOnce(existing);
    const again = await service.createCharge({
      customerId: 'c1',
      amountFils: 100,
      referenceType: 'rental',
      referenceId: 'r9',
    });
    expect(again.id).toBe('t9');
    expect(toTransactionPublic(existing).outstandingDeltaFils).toBe(100);
  });

  it('lists and outstanding', async () => {
    repo.listAccounts.mockResolvedValue({ rows: [account], total: 1 });
    repo.listPostedTransactions.mockResolvedValue([
      { type: FINANCIAL_TX_TYPE.RENTAL_CHARGE, amountFils: 2000, status: 'posted' },
    ]);
    const accounts = await service.listAccounts({});
    expect(accounts.meta.total).toBe(1);
    expect(accounts.items[0].outstandingFils).toBe(2000);

    repo.listTransactions.mockResolvedValue({ rows: [], total: 0 });
    await service.listTransactions({ accountId: 'a1' });
    repo.listPayments.mockResolvedValue({ rows: [], total: 0 });
    await service.listPayments({ accountId: 'a1' });

    repo.findAccountById.mockResolvedValue(account);
    const out = await service.getOutstanding({ accountId: 'a1' });
    expect(out.outstandingFils).toBe(2000);
    expect(out.balanceSource).toBe('ledger');

    repo.settlementOutstandingFils.mockResolvedValueOnce(1500);
    const fromSettlement = await service.getOutstanding({ accountId: 'a1' });
    expect(fromSettlement.outstandingFils).toBe(1500);
    expect(fromSettlement.balanceSource).toBe('settlement');
  });

  it('rejects standalone payment when open settlement exists', async () => {
    repo.countBlockingSettlements.mockResolvedValueOnce(1);
    await expect(
      service.registerPayment({ accountId: 'a1', amountFils: 100 }),
    ).rejects.toBeInstanceOf(BusinessException);
    expect(repo.createPayment).not.toHaveBeenCalled();
  });

  it('rejects payment on missing account', async () => {
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          financialAccount: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      },
    );
    await expect(
      service.registerPayment({ accountId: 'missing', amountFils: 100 }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('covers validation edges account create and outstanding by customer', async () => {
    await expect(
      service.registerDeposit({ customerId: 'c1', amountFils: 0 }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.registerPayment({ accountId: 'a1', amountFils: 0 }),
    ).rejects.toBeInstanceOf(BusinessException);

    customers.getById.mockResolvedValueOnce({ id: 'c1', status: 'inactive' });
    await expect(
      service.createCharge({ customerId: 'c1', amountFils: 100 }),
    ).rejects.toBeInstanceOf(BusinessException);
    customers.getById.mockResolvedValue({ id: 'c1', status: 'active' });

    repo.client.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          financialAccount: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      },
    );
    repo.createAccount.mockResolvedValue(account);
    repo.createTransaction.mockResolvedValue({
      id: 't-new',
      accountId: 'a1',
      type: FINANCIAL_TX_TYPE.RENTAL_CHARGE,
      amountFils: 100,
      status: 'posted',
      referenceType: null,
      referenceId: null,
      description: 'c',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    });
    await service.createCharge({ customerId: 'c1', amountFils: 100 });
    expect(repo.createAccount).toHaveBeenCalled();

    repo.findAccountByCustomerId.mockResolvedValue(account);
    repo.listPostedTransactions.mockResolvedValue([]);
    const byCustomer = await service.getOutstanding({ customerId: 'c1' });
    expect(byCustomer.accountId).toBe('a1');

    await expect(service.getOutstanding({})).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.findAccountById.mockResolvedValue(null);
    await expect(
      service.getOutstanding({ accountId: 'nope' }),
    ).rejects.toBeInstanceOf(BusinessException);
    repo.findAccountByCustomerId.mockResolvedValue(null);
    await expect(
      service.getOutstanding({ customerId: 'nope' }),
    ).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (key: string, f: string) => {
      if (key.includes('prefix')) return 'bad prefix';
      return f;
    });
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          financialAccount: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      },
    );
    await expect(
      service.createCharge({ customerId: 'c1', amountFils: 50 }),
    ).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (_k: string, f: string) => f);
    repo.findAnyPaymentNumber.mockResolvedValue({ id: 'taken' });
    await expect(
      service.registerPayment({ accountId: 'a1', amountFils: 10 }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('rejects payment on closed account inside TX', async () => {
    repo.client.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          financialAccount: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'a1',
              status: 'closed',
              deletedAt: null,
            }),
          },
        };
        return fn(tx);
      },
    );
    await expect(
      service.registerPayment({ accountId: 'a1', amountFils: 10 }),
    ).rejects.toBeInstanceOf(BusinessException);
  });
});

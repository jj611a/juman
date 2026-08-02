import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceRepository } from '../src/finance/finance.repository';
import { BusinessException } from '../src/shared/errors/business.exception';
import {
  toAccountPublic,
  toPaymentPublic,
} from '../src/finance/finance.mapper';

describe('FinanceRepository', () => {
  const prisma = {
    $transaction: vi.fn(),
    sequenceCounter: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    financialAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    financialTransaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    moneyMovement: { create: vi.fn() },
    financialAudit: { create: vi.fn() },
  };
  let repo: FinanceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FinanceRepository(prisma as never);
  });

  it('nextSequence creates and increments', async () => {
    prisma.sequenceCounter.findUnique.mockResolvedValue(null);
    prisma.sequenceCounter.create.mockResolvedValue({});
    const n = await repo.nextSequence('x', prisma as never);
    expect(n).toBe(1);

    prisma.sequenceCounter.findUnique.mockResolvedValue({
      prefix: 'x',
      lastValue: 3,
    });
    prisma.sequenceCounter.update.mockResolvedValue({ lastValue: 4 });
    prisma.$transaction.mockImplementation(async (fn: (c: unknown) => unknown) =>
      fn(prisma),
    );
    expect(await repo.nextSequence('x')).toBe(4);
  });

  it('lockAccount rejects when not open', async () => {
    prisma.financialAccount.updateMany.mockResolvedValue({ count: 0 });
    await expect(repo.lockAccount(prisma as never, 'a1')).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('lists and creates entities', async () => {
    prisma.financialAccount.findMany.mockResolvedValue([]);
    prisma.financialAccount.count.mockResolvedValue(0);
    await repo.listAccounts({
      where: {},
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });
    prisma.financialTransaction.findMany.mockResolvedValue([]);
    prisma.financialTransaction.count.mockResolvedValue(0);
    await repo.listTransactions({
      where: {},
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(0);
    await repo.listPayments({
      where: {},
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });

    prisma.financialAccount.findFirst.mockResolvedValue(null);
    prisma.financialAccount.findUnique.mockResolvedValue(null);
    prisma.payment.findUnique.mockResolvedValue(null);
    await repo.findAccountById('a');
    await repo.findAccountByCustomerId('c');
    await repo.findAnyAccountNumber('FIN-1');
    await repo.findAnyPaymentNumber('PAY-1');
    await repo.listPostedTransactions('a1');
    await repo.findPostedByReference('rental_charge', 'rental', 'r1');

    prisma.financialAccount.create.mockResolvedValue({ id: 'a1' });
    await repo.createAccount(prisma as never, {
      accountNumber: 'FIN-1',
      customerId: 'c1',
    } as never);
    prisma.financialTransaction.create.mockResolvedValue({ id: 't1' });
    await repo.createTransaction(prisma as never, {
      accountId: 'a1',
      type: 'payment',
      amountFils: 1,
    } as never);
    prisma.payment.create.mockResolvedValue({ id: 'p1' });
    await repo.createPayment(prisma as never, {
      paymentNumber: 'PAY-1',
      accountId: 'a1',
      amountFils: 1,
    } as never);
    prisma.payment.update.mockResolvedValue({ id: 'p1' });
    await repo.updatePayment(prisma as never, 'p1', { status: 'completed' });
    prisma.moneyMovement.create.mockResolvedValue({});
    await repo.createMovement(prisma as never, {
      accountId: 'a1',
      direction: 'in',
      amountFils: 1,
      kind: 'payment',
    } as never);
    prisma.financialAudit.create.mockResolvedValue({});
    await repo.createAudit(undefined, {
      entityType: 'payment',
      entityId: 'p1',
      action: 'payment',
    } as never);
    expect(repo.client).toBe(prisma);
  });
});

describe('finance mappers edge', () => {
  it('maps account without outstanding and payment', () => {
    const pub = toAccountPublic({
      id: 'a1',
      accountNumber: 'FIN-1',
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
      customer: null,
    } as never);
    expect(pub.outstandingFils).toBeNull();
    expect(pub.customer).toBeNull();

    const pay = toPaymentPublic({
      id: 'p1',
      paymentNumber: 'PAY-1',
      accountId: 'a1',
      transactionId: null,
      amountFils: 100,
      status: 'pending',
      method: 'cash',
      notes: null,
      completedAt: null,
      cancelledAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      deletedBy: null,
    });
    expect(pay.amountMajor).toBe('0.100');
  });
});

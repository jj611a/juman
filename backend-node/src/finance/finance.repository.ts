import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BusinessException } from '../shared/errors/business.exception';
import { FINANCIAL_TX_STATUS } from './finance.constants';

export const accountInclude = {
  customer: {
    select: {
      id: true,
      customerNumber: true,
      fullName: true,
      status: true,
    },
  },
} satisfies Prisma.FinancialAccountInclude;

export type AccountWithCustomer = Prisma.FinancialAccountGetPayload<{
  include: typeof accountInclude;
}>;

@Injectable()
export class FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  async nextSequence(
    prefix: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const run = async (client: Prisma.TransactionClient) => {
      const e = await client.sequenceCounter.findUnique({ where: { prefix } });
      if (!e) {
        await client.sequenceCounter.create({ data: { prefix, lastValue: 1 } });
        return 1;
      }
      return (
        await client.sequenceCounter.update({
          where: { prefix },
          data: { lastValue: e.lastValue + 1 },
        })
      ).lastValue;
    };
    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  findAccountById(
    id: string,
    deleted = false,
  ): Promise<AccountWithCustomer | null> {
    return this.prisma.financialAccount.findFirst({
      where: { id, deletedAt: deleted ? { not: null } : null },
      include: accountInclude,
    });
  }

  findAccountByCustomerId(
    customerId: string,
  ): Promise<AccountWithCustomer | null> {
    return this.prisma.financialAccount.findFirst({
      where: { customerId, deletedAt: null },
      include: accountInclude,
    });
  }

  findAnyAccountNumber(accountNumber: string) {
    return this.prisma.financialAccount.findUnique({ where: { accountNumber } });
  }

  findAnyPaymentNumber(paymentNumber: string) {
    return this.prisma.payment.findUnique({ where: { paymentNumber } });
  }

  createAccount(
    tx: Prisma.TransactionClient,
    data: Prisma.FinancialAccountUncheckedCreateInput,
  ): Promise<AccountWithCustomer> {
    return tx.financialAccount.create({
      data,
      include: accountInclude,
    });
  }

  /** Touch row to serialize concurrent balance mutations on SQLite. */
  async lockAccount(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<void> {
    const result = await tx.financialAccount.updateMany({
      where: { id: accountId, deletedAt: null, status: 'open' },
      data: { updatedAt: new Date() },
    });
    if (result.count !== 1) {
      throw BusinessException.conflict('Financial account is not open or missing');
    }
  }

  async listAccounts(input: {
    where: Prisma.FinancialAccountWhereInput;
    orderBy: Prisma.FinancialAccountOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.financialAccount.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        include: accountInclude,
      }),
      this.prisma.financialAccount.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async listTransactions(input: {
    where: Prisma.FinancialTransactionWhereInput;
    orderBy: Prisma.FinancialTransactionOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.financialTransaction.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async listPayments(input: {
    where: Prisma.PaymentWhereInput;
    orderBy: Prisma.PaymentOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.payment.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  listPostedTransactions(accountId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.financialTransaction.findMany({
      where: {
        accountId,
        status: FINANCIAL_TX_STATUS.POSTED,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findPostedByReference(
    type: string,
    referenceType: string,
    referenceId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.financialTransaction.findFirst({
      where: {
        type,
        referenceType,
        referenceId,
        status: FINANCIAL_TX_STATUS.POSTED,
      },
    });
  }

  createTransaction(
    tx: Prisma.TransactionClient,
    data: Prisma.FinancialTransactionUncheckedCreateInput,
  ) {
    return tx.financialTransaction.create({ data });
  }

  createPayment(
    tx: Prisma.TransactionClient,
    data: Prisma.PaymentUncheckedCreateInput,
  ) {
    return tx.payment.create({ data });
  }

  updatePayment(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.PaymentUncheckedUpdateInput,
  ) {
    return tx.payment.update({ where: { id }, data });
  }

  createMovement(
    tx: Prisma.TransactionClient,
    data: Prisma.MoneyMovementUncheckedCreateInput,
  ) {
    return tx.moneyMovement.create({ data });
  }

  createAudit(
    tx: Prisma.TransactionClient | undefined,
    data: Prisma.FinancialAuditUncheckedCreateInput,
  ) {
    const client = tx ?? this.prisma;
    return client.financialAudit.create({ data });
  }

  /**
   * Settlements that still accept payment — block standalone ledger payments.
   */
  async countBlockingSettlements(
    accountId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    // Prefer TX client when it exposes rentalSettlement (real Prisma TX);
    // fall back to root client for unit-test stubs / read-committed peek.
    const client =
      tx &&
      typeof (tx as { rentalSettlement?: unknown }).rentalSettlement ===
        'object'
        ? tx
        : this.prisma;
    return client.rentalSettlement.count({
      where: {
        accountId,
        deletedAt: null,
        status: { in: ['open', 'partially_paid'] },
      },
    });
  }

  /**
   * Settlement-owned outstanding: sum remaining across non-cancelled settlements.
   * Returns null when the account has no settlement obligation (ledger-only legacy).
   */
  async settlementOutstandingFils(
    accountId: string,
  ): Promise<number | null> {
    const rows = await this.prisma.rentalSettlement.findMany({
      where: {
        accountId,
        deletedAt: null,
        status: { not: 'cancelled' },
      },
      select: { remainingFils: true },
    });
    if (rows.length === 0) return null;
    return rows.reduce((sum, row) => sum + row.remainingFils, 0);
  }
}

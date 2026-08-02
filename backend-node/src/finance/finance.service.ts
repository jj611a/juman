import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from '../customers/customers.service';
import { CUSTOMER_STATUS } from '../customers/customers.constants';
import { SettingsService } from '../settings/settings.service';
import { BusinessException } from '../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
} from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import type { AuthPrincipal } from '../shared/types';
import type {
  CreatePaymentDto,
  ListFinanceAccountsDto,
  ListFinancePaymentsDto,
  ListFinanceTransactionsDto,
  OutstandingQueryDto,
} from './dto/finance.dto';
import {
  FINANCE_CURRENCY,
  FINANCE_DEFAULT_ACCOUNT_PREFIX,
  FINANCE_DEFAULT_PADDING,
  FINANCE_DEFAULT_PAYMENT_PREFIX,
  FINANCE_DEFAULT_SEPARATOR,
  FINANCE_ACCOUNT_NUMBER_SETTING,
  FINANCE_ACCOUNT_SORT_FIELDS,
  FINANCE_ENTITY_ACCOUNT,
  FINANCE_ENTITY_PAYMENT,
  FINANCE_ENTITY_TRANSACTION,
  FINANCE_MODULE,
  FINANCE_PAYMENT_NUMBER_SETTING,
  FINANCE_PAYMENT_SORT_FIELDS,
  FINANCE_TX_SORT_FIELDS,
  FINANCIAL_ACCOUNT_STATUS,
  FINANCIAL_TX_STATUS,
  FINANCIAL_TX_TYPE,
  MONEY_MOVEMENT_DIRECTION,
  MONEY_MOVEMENT_KIND,
  PAYMENT_STATUS,
} from './finance.constants';
import {
  computeOutstandingFils,
  toAccountPublic,
  toAccountSnapshot,
  toPaymentPublic,
  toTransactionPublic,
} from './finance.mapper';
import { FinanceRepository } from './finance.repository';
import { Money } from './money/money.value';

export type CreateChargeInput = {
  customerId: string;
  amountFils: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
};

export type RegisterDepositInput = {
  customerId: string;
  amountFils: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
};

/**
 * Sole owner of money mutations. Rentals/inventory must never write balances.
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly customers: CustomersService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async listAccounts(query: ListFinanceAccountsDto) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(FINANCE_ACCOUNT_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const where: Prisma.FinancialAccountWhereInput = { deletedAt: null };
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    const q = normalizeSearchQuery(query.q);
    if (q) {
      where.OR = [
        { accountNumber: { contains: q } },
        { customer: { fullName: { contains: q } } },
        { customer: { customerNumber: { contains: q } } },
      ];
    }
    const { rows, total } = await this.repo.listAccounts({
      where,
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    const items = await Promise.all(
      rows.map(async (row) => {
        const outstanding = await this.outstandingForAccount(row.id);
        return toAccountPublic(row, outstanding);
      }),
    );
    return paginated(items, total, page);
  }

  async listTransactions(query: ListFinanceTransactionsDto) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(FINANCE_TX_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const where: Prisma.FinancialTransactionWhereInput = {};
    if (query.accountId) where.accountId = query.accountId;
    if (query.type) where.type = query.type;
    if (query.referenceType) where.referenceType = query.referenceType;
    if (query.referenceId) where.referenceId = query.referenceId;
    if (query.customerId) {
      where.account = { customerId: query.customerId, deletedAt: null };
    }
    const { rows, total } = await this.repo.listTransactions({
      where,
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toTransactionPublic), total, page);
  }

  async listPayments(query: ListFinancePaymentsDto) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(FINANCE_PAYMENT_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const where: Prisma.PaymentWhereInput = { deletedAt: null };
    if (query.accountId) where.accountId = query.accountId;
    if (query.status) where.status = query.status;
    if (query.customerId) {
      where.account = { customerId: query.customerId, deletedAt: null };
    }
    const { rows, total } = await this.repo.listPayments({
      where,
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toPaymentPublic), total, page);
  }

  async getOutstanding(query: OutstandingQueryDto) {
    const account = await this.resolveAccount(query.accountId, query.customerId);
    const outstandingFils = await this.outstandingForAccount(account.id);
    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      customerId: account.customerId,
      currency: FINANCE_CURRENCY,
      outstandingFils,
      outstandingMajor: Money.ofFils(outstandingFils).toMajorString(),
    };
  }

  /**
   * Create a rental (or other) charge — increases outstanding.
   * Called by RentalsService; never writes rental tables.
   */
  async createCharge(input: CreateChargeInput, actor?: AuthPrincipal) {
    const money = Money.ofNonNegativeFils(input.amountFils);
    if (money.isZero()) {
      throw BusinessException.validation('Charge amount must be greater than zero');
    }
    await this.requireActiveCustomer(input.customerId);

    if (input.referenceType && input.referenceId) {
      const existing = await this.repo.findPostedByReference(
        FINANCIAL_TX_TYPE.RENTAL_CHARGE,
        input.referenceType,
        input.referenceId,
      );
      if (existing) return toTransactionPublic(existing);
    }

    const result = await this.repo.client.$transaction(async (tx) => {
      const account = await this.ensureAccountInTx(
        tx,
        input.customerId,
        actor,
      );
      await this.repo.lockAccount(tx, account.id);

      const txn = await this.repo.createTransaction(tx, {
        accountId: account.id,
        type: FINANCIAL_TX_TYPE.RENTAL_CHARGE,
        amountFils: money.amountFils,
        status: FINANCIAL_TX_STATUS.POSTED,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        description: input.description?.trim() || 'rental_charge',
        createdBy: actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      });

      await this.repo.createMovement(tx, {
        accountId: account.id,
        transactionId: txn.id,
        direction: MONEY_MOVEMENT_DIRECTION.OUT,
        amountFils: money.amountFils,
        currency: FINANCE_CURRENCY,
        kind: MONEY_MOVEMENT_KIND.CHARGE,
        createdBy: actor?.userId ?? null,
      });

      await this.repo.createAudit(tx, {
        entityType: FINANCE_ENTITY_TRANSACTION,
        entityId: txn.id,
        action: 'charge',
        newValues: JSON.stringify(toTransactionPublic(txn)),
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        message: 'create_charge',
      });

      return { account, txn };
    });

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: FINANCE_ENTITY_TRANSACTION,
      entityId: result.txn.id,
      action: 'charge',
      newValues: toTransactionPublic(result.txn),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return toTransactionPublic(result.txn);
  }

  /**
   * Register a deposit credit — decreases outstanding.
   * Called by RentalsService; never writes rental tables.
   */
  async registerDeposit(input: RegisterDepositInput, actor?: AuthPrincipal) {
    const money = Money.ofNonNegativeFils(input.amountFils);
    if (money.isZero()) {
      throw BusinessException.validation('Deposit amount must be greater than zero');
    }
    await this.requireActiveCustomer(input.customerId);

    const result = await this.repo.client.$transaction(async (tx) => {
      const account = await this.ensureAccountInTx(
        tx,
        input.customerId,
        actor,
      );
      await this.repo.lockAccount(tx, account.id);

      const txn = await this.repo.createTransaction(tx, {
        accountId: account.id,
        type: FINANCIAL_TX_TYPE.DEPOSIT,
        amountFils: money.amountFils,
        status: FINANCIAL_TX_STATUS.POSTED,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        description: input.description?.trim() || 'deposit',
        createdBy: actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      });

      await this.repo.createMovement(tx, {
        accountId: account.id,
        transactionId: txn.id,
        direction: MONEY_MOVEMENT_DIRECTION.IN,
        amountFils: money.amountFils,
        currency: FINANCE_CURRENCY,
        kind: MONEY_MOVEMENT_KIND.DEPOSIT,
        createdBy: actor?.userId ?? null,
      });

      await this.repo.createAudit(tx, {
        entityType: FINANCE_ENTITY_TRANSACTION,
        entityId: txn.id,
        action: 'deposit',
        newValues: JSON.stringify(toTransactionPublic(txn)),
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        message: 'register_deposit',
      });

      return txn;
    });

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: FINANCE_ENTITY_TRANSACTION,
      entityId: result.id,
      action: 'deposit',
      newValues: toTransactionPublic(result),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return toTransactionPublic(result);
  }

  /** Register a completed cash (or method) payment against an account. */
  async registerPayment(dto: CreatePaymentDto, actor?: AuthPrincipal) {
    const paymentNumber = await this.allocatePaymentNumber();
    const result = await this.repo.client.$transaction(async (tx) =>
      this.registerPaymentInTx(tx, dto, paymentNumber, actor),
    );

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: FINANCE_ENTITY_PAYMENT,
      entityId: result.id,
      action: 'payment',
      newValues: toPaymentPublic(result),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return toPaymentPublic(result);
  }

  /**
   * Payment registration inside an outer TX (used by SettlementService).
   * Does not write settlement rows — Settlement never edits Payment either.
   */
  async registerPaymentInTx(
    tx: Prisma.TransactionClient,
    dto: CreatePaymentDto,
    paymentNumber: string,
    actor?: AuthPrincipal,
  ) {
    const money = Money.ofNonNegativeFils(dto.amountFils);
    if (money.isZero()) {
      throw BusinessException.validation('Payment amount must be greater than zero');
    }

    const account = await tx.financialAccount.findFirst({
      where: { id: dto.accountId, deletedAt: null },
    });
    if (!account) {
      throw BusinessException.notFound('Financial account not found');
    }
    if (account.status !== FINANCIAL_ACCOUNT_STATUS.OPEN) {
      throw BusinessException.conflict('Financial account is not open');
    }
    await this.repo.lockAccount(tx, account.id);

    const pending = await this.repo.createPayment(tx, {
      paymentNumber,
      accountId: account.id,
      amountFils: money.amountFils,
      status: PAYMENT_STATUS.PENDING,
      method: dto.method?.trim() || 'cash',
      notes: dto.notes?.trim() || null,
      createdBy: actor?.userId ?? null,
      updatedBy: actor?.userId ?? null,
    });

    const txn = await this.repo.createTransaction(tx, {
      accountId: account.id,
      type: FINANCIAL_TX_TYPE.PAYMENT,
      amountFils: money.amountFils,
      status: FINANCIAL_TX_STATUS.POSTED,
      referenceType: 'payment',
      referenceId: pending.id,
      description: 'payment',
      createdBy: actor?.userId ?? null,
      updatedBy: actor?.userId ?? null,
    });

    const completed = await this.repo.updatePayment(tx, pending.id, {
      status: PAYMENT_STATUS.COMPLETED,
      transactionId: txn.id,
      completedAt: new Date(),
      updatedBy: actor?.userId ?? null,
    });

    await this.repo.createMovement(tx, {
      accountId: account.id,
      paymentId: completed.id,
      transactionId: txn.id,
      direction: MONEY_MOVEMENT_DIRECTION.IN,
      amountFils: money.amountFils,
      currency: FINANCE_CURRENCY,
      kind: MONEY_MOVEMENT_KIND.PAYMENT,
      createdBy: actor?.userId ?? null,
    });

    await this.repo.createAudit(tx, {
      entityType: FINANCE_ENTITY_PAYMENT,
      entityId: completed.id,
      action: 'payment',
      newValues: JSON.stringify(toPaymentPublic(completed)),
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      message: 'register_payment',
    });

    return completed;
  }

  /** Ensure customer ledger exists; used by SettlementService on checkout. */
  async ensureAccountForCustomer(customerId: string, actor?: AuthPrincipal) {
    await this.requireActiveCustomer(customerId);
    return this.repo.client.$transaction((tx) =>
      this.ensureAccountInTx(tx, customerId, actor),
    );
  }

  /** Allocate payment number for callers composing outer transactions. */
  async allocatePaymentNumberPublic() {
    return this.allocatePaymentNumber();
  }

  async outstandingForAccount(accountId: string): Promise<number> {
    const rows = await this.repo.listPostedTransactions(accountId);
    return computeOutstandingFils(rows);
  }

  private async resolveAccount(accountId?: string, customerId?: string) {
    if (accountId) {
      const account = await this.repo.findAccountById(accountId);
      if (!account) throw BusinessException.notFound('Financial account not found');
      return account;
    }
    if (customerId) {
      const account = await this.repo.findAccountByCustomerId(customerId);
      if (!account) throw BusinessException.notFound('Financial account not found');
      return account;
    }
    throw BusinessException.validation('accountId or customerId is required');
  }

  private async ensureAccountInTx(
    tx: Prisma.TransactionClient,
    customerId: string,
    actor?: AuthPrincipal,
  ) {
    const existing = await tx.financialAccount.findFirst({
      where: { customerId, deletedAt: null },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            fullName: true,
            status: true,
          },
        },
      },
    });
    if (existing) return existing;

    const accountNumber = await this.allocateAccountNumber(tx);
    const created = await this.repo.createAccount(tx, {
      accountNumber,
      customerId,
      currency: FINANCE_CURRENCY,
      status: FINANCIAL_ACCOUNT_STATUS.OPEN,
      createdBy: actor?.userId ?? null,
      updatedBy: actor?.userId ?? null,
    });

    await this.repo.createAudit(tx, {
      entityType: FINANCE_ENTITY_ACCOUNT,
      entityId: created.id,
      action: 'create',
      newValues: JSON.stringify(toAccountSnapshot(created)),
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      message: 'ensure_account',
    });

    return created;
  }

  private async requireActiveCustomer(customerId: string) {
    const customer = await this.customers.getById(customerId);
    if (customer.status !== CUSTOMER_STATUS.ACTIVE) {
      throw BusinessException.conflict('Customer is not active');
    }
    return customer;
  }

  private async allocateAccountNumber(tx?: Prisma.TransactionClient) {
    return this.allocateNumber(
      FINANCE_ACCOUNT_NUMBER_SETTING.PREFIX,
      FINANCE_DEFAULT_ACCOUNT_PREFIX,
      FINANCE_ACCOUNT_NUMBER_SETTING.SEPARATOR,
      FINANCE_ACCOUNT_NUMBER_SETTING.PADDING,
      (n) => this.repo.findAnyAccountNumber(n),
      tx,
    );
  }

  private async allocatePaymentNumber() {
    return this.allocateNumber(
      FINANCE_PAYMENT_NUMBER_SETTING.PREFIX,
      FINANCE_DEFAULT_PAYMENT_PREFIX,
      FINANCE_PAYMENT_NUMBER_SETTING.SEPARATOR,
      FINANCE_PAYMENT_NUMBER_SETTING.PADDING,
      (n) => this.repo.findAnyPaymentNumber(n),
    );
  }

  private async allocateNumber(
    prefixKey: string,
    defaultPrefix: string,
    sepKey: string,
    padKey: string,
    exists: (n: string) => Promise<unknown>,
    tx?: Prisma.TransactionClient,
  ) {
    const prefix = (
      await this.settings.getString(prefixKey, defaultPrefix)
    )
      .trim()
      .toUpperCase();
    const separator = await this.settings.getString(
      sepKey,
      FINANCE_DEFAULT_SEPARATOR,
    );
    const padding = await this.settings.getInt(
      padKey,
      FINANCE_DEFAULT_PADDING,
    );
    if (
      !/^[A-Z0-9]+$/.test(prefix) ||
      !Number.isInteger(padding) ||
      padding < 1 ||
      padding > 16
    ) {
      throw BusinessException.validation('Invalid finance number settings');
    }
    for (let i = 0; i < 25; i += 1) {
      const seq = await this.repo.nextSequence(`${prefixKey}:${prefix}`, tx);
      const number = `${prefix}${separator}${String(seq).padStart(padding, '0')}`;
      if (!(await exists(number))) return number;
    }
    throw BusinessException.invariant('Unable to allocate finance number');
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { SettingsService } from '../../settings/settings.service';
import { BusinessException } from '../../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
} from '../../shared/pagination/pagination';
import { normalizeSearchQuery } from '../../shared/search/search';
import { normalizeSort } from '../../shared/sorting/sorting';
import type { AuthPrincipal } from '../../shared/types';
import { FINANCE_CURRENCY, FINANCE_MODULE } from '../finance.constants';
import { FinanceService } from '../finance.service';
import { Money } from '../money/money.value';
import type {
  ListSettlementsDto,
  SettlementActionDto,
  SettlementPaymentDto,
} from './dto/settlement.dto';
import {
  SETTLEMENT_ACTION,
  SETTLEMENT_DEFAULT_PADDING,
  SETTLEMENT_DEFAULT_PREFIX,
  SETTLEMENT_DEFAULT_SEPARATOR,
  SETTLEMENT_ENTITY,
  SETTLEMENT_NUMBER_SETTING,
  SETTLEMENT_SORT_FIELDS,
  SETTLEMENT_STATUS,
  type SettlementStatus,
} from './settlement.constants';
import {
  toSettlementPublic,
  toSettlementSnapshot,
} from './settlement.mapper';
import { SettlementRepository } from './settlement.repository';
import {
  canApplyPayment,
  canCancel,
  canClose,
  canTransitionSettlementStatus,
  isFinanciallyComplete,
  isSettlementStatus,
  statusAfterPayment,
} from './settlement.rules';
import { decideRentalCancelFinance } from './rental-cancel.policy';
import { SettlementModifierService } from './settlement-modifier.service';
import { assertSettlementBalanceInvariant } from './settlement.integrity';
import {
  recalculateSettlementBalances,
} from './settlement.formula';
import {
  beginIdempotency,
  completeIdempotency,
  hashIdempotencyPayload,
  IDEMPOTENCY_SCOPE,
} from '../idempotency/idempotency';
import type {
  SettlementAdjustmentDto,
  SettlementDiscountDto,
  SettlementLateFeeDto,
  SettlementRefundDto,
} from './dto/settlement-modifiers.dto';

export type CreateSettlementInput = {
  rentalId: string;
  customerId: string;
  /** Gross charge before deposit. */
  chargeFils: number;
  /** Deposit already registered on the ledger (reduces settlement total). */
  depositFils?: number;
};

/**
 * Sole decider of rental financial completion.
 * Does not edit Payment rows — requests FinanceService to register payments.
 */
@Injectable()
export class SettlementService {
  constructor(
    private readonly repo: SettlementRepository,
    private readonly finance: FinanceService,
    private readonly modifiers: SettlementModifierService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListSettlementsDto) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(SETTLEMENT_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const where: Prisma.RentalSettlementWhereInput = { deletedAt: null };
    if (query.status) {
      if (!isSettlementStatus(query.status)) {
        throw BusinessException.validation('Invalid settlement status');
      }
      where.status = query.status;
    }
    if (query.customerId) where.customerId = query.customerId;
    if (query.rentalId) where.rentalId = query.rentalId;
    if (query.accountId) where.accountId = query.accountId;
    const q = normalizeSearchQuery(query.q);
    if (q) {
      where.OR = [
        { settlementNumber: { contains: q } },
        { rental: { rentalNumber: { contains: q } } },
      ];
    }
    const { rows, total } = await this.repo.list({
      where,
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toSettlementPublic), total, page);
  }

  async getById(id: string) {
    return toSettlementPublic(await this.requireLive(id));
  }

  /**
   * Create settlement after rental checkout charges/deposits.
   * Idempotent per rentalId. Prefer createForRentalInTx inside checkout TX.
   */
  async createForRental(input: CreateSettlementInput, actor?: AuthPrincipal) {
    const existing = await this.repo.findByRentalId(input.rentalId);
    if (existing) return toSettlementPublic(existing);

    const row = await this.repo.client.$transaction(async (tx) =>
      this.createForRentalInTx(tx, input, actor),
    );

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: row.id,
      action: SETTLEMENT_ACTION.CREATED,
      newValues: toSettlementSnapshot(row as never),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return row;
  }

  /**
   * Settlement create inside an outer business TX (checkout).
   * Does not open a nested transaction. Platform AuditService left to caller.
   */
  async createForRentalInTx(
    tx: Prisma.TransactionClient,
    input: CreateSettlementInput,
    actor?: AuthPrincipal,
  ) {
    const existing = await this.repo.findByRentalId(input.rentalId, tx);
    if (existing) return toSettlementPublic(existing);

    const charge = Money.ofNonNegativeFils(input.chargeFils);
    const deposit = Money.ofNonNegativeFils(input.depositFils ?? 0);
    const balances = recalculateSettlementBalances(
      {
        chargeFils: charge.amountFils,
        depositFils: deposit.amountFils,
        lateFeeFils: 0,
        adjustmentFils: 0,
        discountFils: 0,
        refundFils: 0,
      },
      0,
    );
    const account = await this.finance.ensureAccountForCustomerInTx(
      tx,
      input.customerId,
      actor,
    );

    const settlementNumber = await this.allocateNumber(tx);
    const initialStatus = balances.status;

    const row = await this.repo.create(
      tx,
      {
        settlementNumber,
        rentalId: input.rentalId,
        accountId: account.id,
        customerId: input.customerId,
        chargeFils: charge.amountFils,
        depositFils: deposit.amountFils,
        lateFeeFils: 0,
        adjustmentFils: 0,
        discountFils: 0,
        refundFils: 0,
        totalFils: balances.totalFils,
        paidFils: 0,
        remainingFils: balances.remainingFils,
        status: initialStatus,
        currency: FINANCE_CURRENCY,
        createdBy: actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      },
      {
        oldStatus: SETTLEMENT_STATUS.OPEN,
        newStatus: initialStatus,
        action: SETTLEMENT_ACTION.CREATED,
        reason: 'checkout',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
      },
    );

    assertSettlementBalanceInvariant(row);
    return toSettlementPublic(row);
  }

  /**
   * Cancel open unpaid settlement for a rental cancel (same TX as inventory unwind).
   * Voids charge/deposit ledger rows. Rejects partial/paid (refund required).
   */
  async applyRentalCancelPolicyInTx(
    tx: Prisma.TransactionClient,
    rentalId: string,
    actor?: AuthPrincipal,
    reason?: string,
  ) {
    const settlement = await this.repo.findByRentalId(rentalId, tx);
    const decision = decideRentalCancelFinance(
      settlement
        ? {
            id: settlement.id,
            status: settlement.status,
            paidFils: settlement.paidFils,
            totalFils: settlement.totalFils,
          }
        : null,
    );
    if (decision.kind !== 'cancel_open_unpaid') return decision;

    await this.finance.voidSettlementObligationLedgerInTx(
      tx,
      decision.settlementId,
      actor,
    );

    const from = settlement!.status as SettlementStatus;
    const updated = await this.repo.transitionStatus(tx, {
      settlementId: decision.settlementId,
      from,
      to: SETTLEMENT_STATUS.CANCELLED,
      action: SETTLEMENT_ACTION.CANCELLED,
      reason: reason?.trim() || 'rental_cancelled',
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      extra: { cancelledAt: new Date() },
    });
    if (!updated) {
      throw BusinessException.conflict('Concurrent settlement cancel rejected');
    }
    return { kind: 'cancel_open_unpaid' as const, settlement: updated };
  }

  /**
   * Apply payment: FinanceService registers Payment; Settlement updates balances.
   * Settlement never mutates Payment rows.
   */
  async applyPayment(
    id: string,
    dto: SettlementPaymentDto,
    actor?: AuthPrincipal,
  ) {
    const settlement = await this.requireLive(id);
    if (!canApplyPayment(settlement.status)) {
      throw BusinessException.conflict(
        `Cannot apply payment to settlement in status ${settlement.status}`,
      );
    }
    const amount = Money.ofNonNegativeFils(dto.amountFils);
    if (amount.amountFils > settlement.remainingFils) {
      throw BusinessException.validation(
        'Payment exceeds settlement remaining balance',
      );
    }

    const requestHash = hashIdempotencyPayload({
      settlementId: id,
      amountFils: amount.amountFils,
      method: dto.method ?? 'cash',
      notes: dto.notes ?? null,
    });
    const idemKey = dto.idempotencyKey?.trim();

    const paymentNumber = await this.finance.allocatePaymentNumberPublic();

    const result = await this.repo.client.$transaction(async (tx) => {
      if (idemKey) {
        const began = await beginIdempotency<ReturnType<typeof toSettlementPublic>>(
          tx,
          {
            scope: IDEMPOTENCY_SCOPE.SETTLEMENT_PAYMENT,
            key: idemKey,
            requestHash,
          },
        );
        if (began.kind === 'replay') {
          return { replay: began.response as ReturnType<typeof toSettlementPublic> };
        }
      }

      await this.repo.lockSettlement(tx, settlement.id);
      const live = await tx.rentalSettlement.findFirst({
        where: { id: settlement.id, deletedAt: null },
      });
      if (!live || !canApplyPayment(live.status)) {
        throw BusinessException.conflict('Settlement not open for payment');
      }
      if (amount.amountFils > live.remainingFils) {
        throw BusinessException.validation(
          'Payment exceeds settlement remaining balance',
        );
      }

      const payment = await this.finance.registerPaymentInTx(
        tx,
        {
          accountId: live.accountId,
          settlementId: live.id,
          amountFils: amount.amountFils,
          method: dto.method,
          notes: dto.notes,
        },
        paymentNumber,
        actor,
      );

      const newPaid = live.paidFils + amount.amountFils;
      const newRemaining = live.remainingFils - amount.amountFils;
      const newStatus = statusAfterPayment(newRemaining, newPaid);

      const updated = await this.repo.applyPaymentCas(tx, {
        settlementId: live.id,
        expectedRemaining: live.remainingFils,
        fromStatus: live.status,
        amountFils: amount.amountFils,
        newPaid,
        newRemaining,
        newStatus,
        paymentId: payment.id,
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
      });
      if (!updated) {
        throw BusinessException.conflict('Concurrent settlement payment rejected');
      }
      assertSettlementBalanceInvariant(updated);

      const pub = toSettlementPublic(updated);
      if (idemKey) {
        await completeIdempotency(tx, {
          scope: IDEMPOTENCY_SCOPE.SETTLEMENT_PAYMENT,
          key: idemKey,
          resourceType: SETTLEMENT_ENTITY,
          resourceId: updated.id,
          response: pub,
        });
      }
      return { updated, payment, pub };
    });

    if ('replay' in result && result.replay) {
      return result.replay;
    }

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.PAYMENT_APPLIED,
      oldValues: toSettlementSnapshot(settlement),
      newValues: {
        ...toSettlementSnapshot(result.updated!),
        paymentId: result.payment!.id,
      },
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return result.pub!;
  }

  async markPaid(id: string, reason?: string, actor?: AuthPrincipal) {
    const settlement = await this.requireLive(id);
    if (settlement.remainingFils !== 0) {
      throw BusinessException.conflict(
        'Cannot mark paid while remaining balance is non-zero',
      );
    }
    if (settlement.status === SETTLEMENT_STATUS.PAID) {
      return toSettlementPublic(settlement);
    }
    if (settlement.status !== SETTLEMENT_STATUS.PARTIALLY_PAID &&
        settlement.status !== SETTLEMENT_STATUS.OPEN) {
      throw BusinessException.conflict(
        `Cannot mark paid from status ${settlement.status}`,
      );
    }
    const from = settlement.status as SettlementStatus;
    if (!canTransitionSettlementStatus(from, SETTLEMENT_STATUS.PAID)) {
      throw BusinessException.conflict('Invalid settlement transition to paid');
    }

    const updated = await this.repo.client.$transaction(async (tx) => {
      const row = await this.repo.transitionStatus(tx, {
        settlementId: id,
        from,
        to: SETTLEMENT_STATUS.PAID,
        action: SETTLEMENT_ACTION.MARKED_PAID,
        reason: reason?.trim() || 'marked_paid',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
      });
      if (!row) {
        throw BusinessException.conflict('Concurrent settlement mark-paid rejected');
      }
      return row;
    });

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.MARKED_PAID,
      oldValues: toSettlementSnapshot(settlement),
      newValues: toSettlementSnapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toSettlementPublic(updated);
  }

  async close(id: string, body?: SettlementActionDto, actor?: AuthPrincipal) {
    const settlement = await this.requireLive(id);
    if (!canClose(settlement.status)) {
      throw BusinessException.conflict(
        `Cannot close settlement in status ${settlement.status}`,
      );
    }
    const updated = await this.repo.client.$transaction(async (tx) => {
      const row = await this.repo.transitionStatus(tx, {
        settlementId: id,
        from: SETTLEMENT_STATUS.PAID,
        to: SETTLEMENT_STATUS.CLOSED,
        action: SETTLEMENT_ACTION.CLOSED,
        reason: body?.reason?.trim() || 'closed',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        extra: { closedAt: new Date() },
      });
      if (!row) {
        throw BusinessException.conflict('Concurrent settlement close rejected');
      }
      return row;
    });

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.CLOSED,
      oldValues: toSettlementSnapshot(settlement),
      newValues: toSettlementSnapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toSettlementPublic(updated);
  }

  async cancel(id: string, body?: SettlementActionDto, actor?: AuthPrincipal) {
    const settlement = await this.requireLive(id);
    if (!canCancel(settlement.status)) {
      throw BusinessException.conflict(
        `Cannot cancel settlement in status ${settlement.status}`,
      );
    }
    if (settlement.paidFils > 0) {
      throw BusinessException.conflict(
        'Cannot cancel settlement with applied payments',
      );
    }
    const from = settlement.status as SettlementStatus;
    const updated = await this.repo.client.$transaction(async (tx) => {
      const row = await this.repo.transitionStatus(tx, {
        settlementId: id,
        from,
        to: SETTLEMENT_STATUS.CANCELLED,
        action: SETTLEMENT_ACTION.CANCELLED,
        reason: body?.reason?.trim() || 'cancelled',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        extra: { cancelledAt: new Date() },
      });
      if (!row) {
        throw BusinessException.conflict('Concurrent settlement cancel rejected');
      }
      return row;
    });

    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.CANCELLED,
      oldValues: toSettlementSnapshot(settlement),
      newValues: toSettlementSnapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toSettlementPublic(updated);
  }

  /** Credit-note refund — Settlement authority; never mutates Payment. */
  async applyRefund(
    id: string,
    dto: SettlementRefundDto,
    actor?: AuthPrincipal,
  ) {
    const settlement = await this.requireLive(id);
    const result = await this.modifiers.applyRefund(settlement, dto, actor);
    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.REFUND_APPLIED,
      oldValues: toSettlementSnapshot(settlement),
      newValues: result as never,
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return result;
  }

  async applyAdjustment(
    id: string,
    dto: SettlementAdjustmentDto,
    actor?: AuthPrincipal,
  ) {
    const settlement = await this.requireLive(id);
    const result = await this.modifiers.applyAdjustment(settlement, dto, actor);
    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.ADJUSTMENT_APPLIED,
      oldValues: toSettlementSnapshot(settlement),
      newValues: result as never,
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return result;
  }

  async applyDiscount(
    id: string,
    dto: SettlementDiscountDto,
    actor?: AuthPrincipal,
  ) {
    const settlement = await this.requireLive(id);
    const result = await this.modifiers.applyDiscount(settlement, dto, actor);
    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.DISCOUNT_APPLIED,
      oldValues: toSettlementSnapshot(settlement),
      newValues: result as never,
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return result;
  }

  /** Domain-only late fee assessment — no scheduler. */
  async assessLateFee(
    id: string,
    dto: SettlementLateFeeDto,
    actor?: AuthPrincipal,
  ) {
    const settlement = await this.requireLive(id);
    const result = await this.modifiers.assessLateFee(settlement, dto, actor);
    await this.audit.record({
      module: FINANCE_MODULE,
      entityType: SETTLEMENT_ENTITY,
      entityId: id,
      action: SETTLEMENT_ACTION.LATE_FEE_ASSESSED,
      oldValues: toSettlementSnapshot(settlement),
      newValues: result as never,
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return result;
  }

  /** Rental close/complete gate — only SettlementService decides financial completion. */
  async assertFinanciallyComplete(rentalId: string): Promise<void> {
    const settlement = await this.repo.findByRentalId(rentalId);
    if (!settlement) {
      throw BusinessException.conflict(
        'Rental has no settlement — financial completion unknown',
      );
    }
    if (!isFinanciallyComplete(settlement.status)) {
      throw BusinessException.conflict(
        `Settlement ${settlement.settlementNumber} is ${settlement.status}; rental cannot complete`,
      );
    }
  }

  outstandingOf(id: string) {
    return this.getById(id).then((s) => ({
      settlementId: s.id,
      settlementNumber: s.settlementNumber,
      totalFils: s.totalFils,
      paidFils: s.paidFils,
      remainingFils: s.remainingFils,
      status: s.status,
      currency: s.currency,
    }));
  }

  private async requireLive(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Settlement not found');
    return row;
  }

  private async allocateNumber(tx?: Prisma.TransactionClient) {
    const prefix = (
      await this.settings.getString(
        SETTLEMENT_NUMBER_SETTING.PREFIX,
        SETTLEMENT_DEFAULT_PREFIX,
      )
    )
      .trim()
      .toUpperCase();
    const separator = await this.settings.getString(
      SETTLEMENT_NUMBER_SETTING.SEPARATOR,
      SETTLEMENT_DEFAULT_SEPARATOR,
    );
    const padding = await this.settings.getInt(
      SETTLEMENT_NUMBER_SETTING.PADDING,
      SETTLEMENT_DEFAULT_PADDING,
    );
    if (
      !/^[A-Z0-9]+$/.test(prefix) ||
      !Number.isInteger(padding) ||
      padding < 1 ||
      padding > 16
    ) {
      throw BusinessException.validation('Invalid settlement number settings');
    }
    const client = tx ?? this.repo.client;
    for (let i = 0; i < 25; i += 1) {
      const seq = await this.repo.nextSequence(
        `${SETTLEMENT_NUMBER_SETTING.PREFIX}:${prefix}`,
        tx,
      );
      const number = `${prefix}${separator}${String(seq).padStart(padding, '0')}`;
      const taken = await client.rentalSettlement.findUnique({
        where: { settlementNumber: number },
      });
      if (!taken) return number;
    }
    throw BusinessException.invariant('Unable to allocate settlement number');
  }
}

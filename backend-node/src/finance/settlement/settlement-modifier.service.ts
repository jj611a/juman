import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SettingsService } from '../../settings/settings.service';
import { BusinessException } from '../../shared/errors/business.exception';
import type { AuthPrincipal } from '../../shared/types';
import {
  FINANCIAL_TX_TYPE,
  MONEY_MOVEMENT_DIRECTION,
  MONEY_MOVEMENT_KIND,
} from '../finance.constants';
import { FinanceService } from '../finance.service';
import { Money } from '../money/money.value';
import {
  beginIdempotency,
  completeIdempotency,
  hashIdempotencyPayload,
} from '../idempotency/idempotency';
import type {
  SettlementAdjustmentDto,
  SettlementDiscountDto,
  SettlementLateFeeDto,
  SettlementRefundDto,
} from './dto/settlement-modifiers.dto';
import {
  DISCOUNT_BASIS,
  DISCOUNT_KIND,
  LATE_FEE_KIND,
  REFUND_STATUS,
  SETTLEMENT_ACTION,
  SETTLEMENT_DEFAULT_PADDING,
  SETTLEMENT_DEFAULT_SEPARATOR,
  SETTLEMENT_ENTITY,
  SETTLEMENT_MODIFIER_STATUS,
  SETTLEMENT_NUMBER_SETTING,
  SETTLEMENT_STATUS,
} from './settlement.constants';
import {
  computeDailyLateFeeFils,
  computeFixedDiscountFils,
  computeFlatLateFeeFils,
  computePercentageDiscountFils,
  recalculateSettlementBalances,
  type SettlementComponents,
} from './settlement.formula';
import {
  assertAdjustmentConsistency,
  assertDiscountConsistency,
  assertLateFeeConsistency,
  assertRefundConsistency,
  assertSettlementBalanceInvariant,
  assertSettlementComponentsMatchTotal,
} from './settlement.integrity';
import { toSettlementPublic } from './settlement.mapper';
import {
  SettlementRepository,
  settlementInclude,
  type SettlementWithRelations,
} from './settlement.repository';

/**
 * Settlement-owned monetary modifiers (Phase 6.6).
 * Called only through SettlementService — never mutate Payment rows.
 */
@Injectable()
export class SettlementModifierService {
  constructor(
    private readonly repo: SettlementRepository,
    private readonly finance: FinanceService,
    private readonly settings: SettingsService,
  ) {}

  async applyRefund(
    settlement: SettlementWithRelations,
    dto: SettlementRefundDto,
    actor?: AuthPrincipal,
  ) {
    this.assertMutable(settlement);
    const amount = Money.ofNonNegativeFils(dto.amountFils);
    const reason = dto.reason.trim();
    if (!reason) throw BusinessException.validation('Refund reason is required');

    const requestHash = hashIdempotencyPayload({
      settlementId: settlement.id,
      amountFils: amount.amountFils,
      reason,
    });
    const idemKey = dto.idempotencyKey?.trim();
    const refundNumber = await this.allocateRefundNumber();

    const result = await this.repo.client.$transaction(async (tx) => {
      if (idemKey) {
        const began = await beginIdempotency(tx, {
          scope: 'settlement.refund',
          key: idemKey,
          requestHash,
        });
        if (began.kind === 'replay') return { replay: began.response };
      }

      await this.repo.lockSettlement(tx, settlement.id);
      const live = await this.requireLiveInTx(tx, settlement.id);

      const components = this.nextComponents(live, {
        refundFils: live.refundFils + amount.amountFils,
      });
      const balances = recalculateSettlementBalances(components, live.paidFils);

      const refund = await tx.settlementRefund.create({
        data: {
          refundNumber,
          settlementId: live.id,
          amountFils: amount.amountFils,
          reason,
          status: REFUND_STATUS.POSTED,
          createdBy: actor?.userId ?? null,
          updatedBy: actor?.userId ?? null,
          history: {
            create: {
              oldStatus: REFUND_STATUS.POSTED,
              newStatus: REFUND_STATUS.POSTED,
              action: 'created',
              reason,
              userId: actor?.userId ?? null,
              username: actor?.username ?? null,
            },
          },
        },
      });

      const txn = await this.finance.postSettlementModifierInTx(
        tx,
        {
          accountId: live.accountId,
          settlementId: live.id,
          type: FINANCIAL_TX_TYPE.REFUND,
          amountFils: amount.amountFils,
          referenceType: 'settlement_refund',
          referenceId: refund.id,
          description: `refund ${refundNumber}`,
          movementKind: MONEY_MOVEMENT_KIND.REFUND,
          direction: MONEY_MOVEMENT_DIRECTION.IN,
        },
        actor,
      );

      await tx.settlementRefund.update({
        where: { id: refund.id },
        data: { transactionId: txn.id },
      });

      const updated = await this.applyRecalc(tx, live, components, balances, {
        action: SETTLEMENT_ACTION.REFUND_APPLIED,
        amountFils: amount.amountFils,
        reason,
        actor,
      });
      this.assertPostedSums(updated);

      const pub = toSettlementPublic(updated);
      if (idemKey) {
        await completeIdempotency(tx, {
          scope: 'settlement.refund',
          key: idemKey,
          resourceType: SETTLEMENT_ENTITY,
          resourceId: updated.id,
          response: pub,
        });
      }
      return { pub, updated };
    });

    if ('replay' in result && result.replay) return result.replay;
    return result.pub!;
  }

  async applyAdjustment(
    settlement: SettlementWithRelations,
    dto: SettlementAdjustmentDto,
    actor?: AuthPrincipal,
  ) {
    this.assertMutable(settlement);
    const amount = Money.ofFils(dto.amountFils);
    if (amount.isZero()) {
      throw BusinessException.validation('Adjustment amount cannot be zero');
    }
    const reason = dto.reason.trim();
    if (!reason) throw BusinessException.validation('Adjustment reason is required');

    const requestHash = hashIdempotencyPayload({
      settlementId: settlement.id,
      amountFils: amount.amountFils,
      reason,
    });
    const idemKey = dto.idempotencyKey?.trim();

    const result = await this.repo.client.$transaction(async (tx) => {
      if (idemKey) {
        const began = await beginIdempotency(tx, {
          scope: 'settlement.adjustment',
          key: idemKey,
          requestHash,
        });
        if (began.kind === 'replay') return { replay: began.response };
      }

      await this.repo.lockSettlement(tx, settlement.id);
      const live = await this.requireLiveInTx(tx, settlement.id);

      const components = this.nextComponents(live, {
        adjustmentFils: live.adjustmentFils + amount.amountFils,
      });
      const balances = recalculateSettlementBalances(components, live.paidFils);

      const row = await tx.settlementAdjustment.create({
        data: {
          settlementId: live.id,
          amountFils: amount.amountFils,
          reason,
          status: SETTLEMENT_MODIFIER_STATUS.POSTED,
          createdBy: actor?.userId ?? null,
          updatedBy: actor?.userId ?? null,
        },
      });

      const direction =
        amount.amountFils > 0
          ? MONEY_MOVEMENT_DIRECTION.OUT
          : MONEY_MOVEMENT_DIRECTION.IN;

      const txn = await this.finance.postSettlementModifierInTx(
        tx,
        {
          accountId: live.accountId,
          settlementId: live.id,
          type: FINANCIAL_TX_TYPE.ADJUSTMENT,
          amountFils: amount.amountFils,
          referenceType: 'settlement_adjustment',
          referenceId: row.id,
          description: `adjustment ${row.id}`,
          movementKind: MONEY_MOVEMENT_KIND.ADJUSTMENT,
          direction,
        },
        actor,
      );

      await tx.settlementAdjustment.update({
        where: { id: row.id },
        data: { transactionId: txn.id },
      });

      const updated = await this.applyRecalc(tx, live, components, balances, {
        action: SETTLEMENT_ACTION.ADJUSTMENT_APPLIED,
        amountFils: amount.amountFils,
        reason,
        actor,
      });
      this.assertPostedSums(updated);

      const pub = toSettlementPublic(updated);
      if (idemKey) {
        await completeIdempotency(tx, {
          scope: 'settlement.adjustment',
          key: idemKey,
          resourceType: SETTLEMENT_ENTITY,
          resourceId: updated.id,
          response: pub,
        });
      }
      return { pub };
    });

    if ('replay' in result && result.replay) return result.replay;
    return result.pub!;
  }

  async applyDiscount(
    settlement: SettlementWithRelations,
    dto: SettlementDiscountDto,
    actor?: AuthPrincipal,
  ) {
    this.assertMutable(settlement);
    const reason = dto.reason.trim();
    if (!reason) throw BusinessException.validation('Discount reason is required');
    const basis = dto.basis ?? DISCOUNT_BASIS.SETTLEMENT;

    const requestHash = hashIdempotencyPayload({
      settlementId: settlement.id,
      kind: dto.kind,
      basis,
      percentBps: dto.percentBps ?? null,
      amountFils: dto.amountFils ?? null,
      reason,
    });
    const idemKey = dto.idempotencyKey?.trim();

    const result = await this.repo.client.$transaction(async (tx) => {
      if (idemKey) {
        const began = await beginIdempotency(tx, {
          scope: 'settlement.discount',
          key: idemKey,
          requestHash,
        });
        if (began.kind === 'replay') return { replay: began.response };
      }

      await this.repo.lockSettlement(tx, settlement.id);
      const live = await this.requireLiveInTx(tx, settlement.id);

      const basisFils =
        basis === DISCOUNT_BASIS.RENTAL
          ? live.chargeFils - live.depositFils
          : live.totalFils;

      let computedFils = 0;
      if (dto.kind === DISCOUNT_KIND.FIXED) {
        if (dto.amountFils == null) {
          throw BusinessException.validation('Fixed discount requires amountFils');
        }
        computedFils = computeFixedDiscountFils(dto.amountFils);
      } else if (dto.kind === DISCOUNT_KIND.PERCENTAGE) {
        if (dto.percentBps == null) {
          throw BusinessException.validation(
            'Percentage discount requires percentBps',
          );
        }
        computedFils = computePercentageDiscountFils(basisFils, dto.percentBps);
      } else {
        throw BusinessException.validation('Invalid discount kind');
      }
      if (computedFils <= 0) {
        throw BusinessException.validation('Computed discount must be greater than zero');
      }

      const components = this.nextComponents(live, {
        discountFils: live.discountFils + computedFils,
      });
      const balances = recalculateSettlementBalances(components, live.paidFils);

      const row = await tx.settlementDiscount.create({
        data: {
          settlementId: live.id,
          kind: dto.kind,
          basis,
          percentBps: dto.percentBps ?? null,
          amountFils: dto.amountFils ?? null,
          computedFils,
          reason,
          status: SETTLEMENT_MODIFIER_STATUS.POSTED,
          createdBy: actor?.userId ?? null,
          updatedBy: actor?.userId ?? null,
        },
      });

      const txn = await this.finance.postSettlementModifierInTx(
        tx,
        {
          accountId: live.accountId,
          settlementId: live.id,
          type: FINANCIAL_TX_TYPE.DISCOUNT,
          amountFils: computedFils,
          referenceType: 'settlement_discount',
          referenceId: row.id,
          description: `discount ${row.id}`,
          movementKind: MONEY_MOVEMENT_KIND.DISCOUNT,
          direction: MONEY_MOVEMENT_DIRECTION.IN,
        },
        actor,
      );

      await tx.settlementDiscount.update({
        where: { id: row.id },
        data: { transactionId: txn.id },
      });

      const updated = await this.applyRecalc(tx, live, components, balances, {
        action: SETTLEMENT_ACTION.DISCOUNT_APPLIED,
        amountFils: computedFils,
        reason,
        actor,
      });
      this.assertPostedSums(updated);

      const pub = toSettlementPublic(updated);
      if (idemKey) {
        await completeIdempotency(tx, {
          scope: 'settlement.discount',
          key: idemKey,
          resourceType: SETTLEMENT_ENTITY,
          resourceId: updated.id,
          response: pub,
        });
      }
      return { pub };
    });

    if ('replay' in result && result.replay) return result.replay;
    return result.pub!;
  }

  async assessLateFee(
    settlement: SettlementWithRelations,
    dto: SettlementLateFeeDto,
    actor?: AuthPrincipal,
  ) {
    this.assertMutable(settlement);
    const reason = dto.reason.trim();
    if (!reason) throw BusinessException.validation('Late fee reason is required');

    const requestHash = hashIdempotencyPayload({
      settlementId: settlement.id,
      kind: dto.kind,
      flatFils: dto.flatFils ?? null,
      dailyFils: dto.dailyFils ?? null,
      daysCharged: dto.daysCharged ?? null,
      maxFils: dto.maxFils ?? null,
      reason,
    });
    const idemKey = dto.idempotencyKey?.trim();

    const result = await this.repo.client.$transaction(async (tx) => {
      if (idemKey) {
        const began = await beginIdempotency(tx, {
          scope: 'settlement.late_fee',
          key: idemKey,
          requestHash,
        });
        if (began.kind === 'replay') return { replay: began.response };
      }

      await this.repo.lockSettlement(tx, settlement.id);
      const live = await this.requireLiveInTx(tx, settlement.id);

      let computedFils = 0;
      if (dto.kind === LATE_FEE_KIND.FLAT) {
        if (dto.flatFils == null) {
          throw BusinessException.validation('Flat late fee requires flatFils');
        }
        computedFils = computeFlatLateFeeFils(dto.flatFils, dto.maxFils);
      } else if (dto.kind === LATE_FEE_KIND.DAILY) {
        if (dto.dailyFils == null || dto.daysCharged == null) {
          throw BusinessException.validation(
            'Daily late fee requires dailyFils and daysCharged',
          );
        }
        computedFils = computeDailyLateFeeFils({
          dailyFils: dto.dailyFils,
          daysCharged: dto.daysCharged,
          maxFils: dto.maxFils,
        });
      } else {
        throw BusinessException.validation('Invalid late fee kind');
      }

      const components = this.nextComponents(live, {
        lateFeeFils: live.lateFeeFils + computedFils,
      });
      const balances = recalculateSettlementBalances(components, live.paidFils);

      const row = await tx.settlementLateFee.create({
        data: {
          settlementId: live.id,
          kind: dto.kind,
          flatFils: dto.flatFils ?? null,
          dailyFils: dto.dailyFils ?? null,
          maxFils: dto.maxFils ?? null,
          daysCharged: dto.daysCharged ?? null,
          computedFils,
          reason,
          status: SETTLEMENT_MODIFIER_STATUS.POSTED,
          createdBy: actor?.userId ?? null,
          updatedBy: actor?.userId ?? null,
        },
      });

      const txn = await this.finance.postSettlementModifierInTx(
        tx,
        {
          accountId: live.accountId,
          settlementId: live.id,
          type: FINANCIAL_TX_TYPE.LATE_FEE,
          amountFils: computedFils,
          referenceType: 'settlement_late_fee',
          referenceId: row.id,
          description: `late_fee ${row.id}`,
          movementKind: MONEY_MOVEMENT_KIND.LATE_FEE,
          direction: MONEY_MOVEMENT_DIRECTION.OUT,
        },
        actor,
      );

      await tx.settlementLateFee.update({
        where: { id: row.id },
        data: { transactionId: txn.id },
      });

      const updated = await this.applyRecalc(tx, live, components, balances, {
        action: SETTLEMENT_ACTION.LATE_FEE_ASSESSED,
        amountFils: computedFils,
        reason,
        actor,
      });
      this.assertPostedSums(updated);

      const pub = toSettlementPublic(updated);
      if (idemKey) {
        await completeIdempotency(tx, {
          scope: 'settlement.late_fee',
          key: idemKey,
          resourceType: SETTLEMENT_ENTITY,
          resourceId: updated.id,
          response: pub,
        });
      }
      return { pub };
    });

    if ('replay' in result && result.replay) return result.replay;
    return result.pub!;
  }

  private assertMutable(settlement: SettlementWithRelations) {
    if (
      settlement.status === SETTLEMENT_STATUS.CANCELLED ||
      settlement.status === SETTLEMENT_STATUS.CLOSED
    ) {
      throw BusinessException.conflict(
        `Cannot modify settlement in status ${settlement.status}`,
      );
    }
  }

  private nextComponents(
    live: SettlementWithRelations,
    patch: Partial<SettlementComponents>,
  ): SettlementComponents {
    return {
      chargeFils: patch.chargeFils ?? live.chargeFils,
      depositFils: patch.depositFils ?? live.depositFils,
      lateFeeFils: patch.lateFeeFils ?? live.lateFeeFils,
      adjustmentFils: patch.adjustmentFils ?? live.adjustmentFils,
      discountFils: patch.discountFils ?? live.discountFils,
      refundFils: patch.refundFils ?? live.refundFils,
    };
  }

  private async applyRecalc(
    tx: Prisma.TransactionClient,
    live: SettlementWithRelations,
    components: SettlementComponents,
    balances: ReturnType<typeof recalculateSettlementBalances>,
    meta: {
      action: string;
      amountFils: number;
      reason: string;
      actor?: AuthPrincipal;
    },
  ) {
    // Status may move paid ↔ open/partial when total changes vs paid.
    const updated = await this.repo.recalculateCas(tx, {
      settlementId: live.id,
      expectedTotal: live.totalFils,
      expectedPaid: live.paidFils,
      expectedRemaining: live.remainingFils,
      fromStatus: live.status,
      ...components,
      totalFils: balances.totalFils,
      remainingFils: balances.remainingFils,
      newStatus: balances.status,
      action: meta.action,
      amountFils: meta.amountFils,
      reason: meta.reason,
      userId: meta.actor?.userId ?? null,
      username: meta.actor?.username ?? null,
    });
    if (!updated) {
      throw BusinessException.conflict('Concurrent settlement modification rejected');
    }
    assertSettlementBalanceInvariant(updated);
    assertSettlementComponentsMatchTotal(components, updated.totalFils);
    return updated;
  }

  private assertPostedSums(row: SettlementWithRelations) {
    assertRefundConsistency({
      refundFils: row.refundFils,
      postedRefundSumFils: (row.refunds ?? []).reduce((s, r) => s + r.amountFils, 0),
    });
    assertAdjustmentConsistency({
      adjustmentFils: row.adjustmentFils,
      postedAdjustmentSumFils: (row.adjustments ?? []).reduce(
        (s, r) => s + r.amountFils,
        0,
      ),
    });
    assertDiscountConsistency({
      discountFils: row.discountFils,
      postedDiscountSumFils: (row.discounts ?? []).reduce(
        (s, r) => s + r.computedFils,
        0,
      ),
    });
    assertLateFeeConsistency({
      lateFeeFils: row.lateFeeFils,
      postedLateFeeSumFils: (row.lateFees ?? []).reduce(
        (s, r) => s + r.computedFils,
        0,
      ),
    });
  }

  private async requireLiveInTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<SettlementWithRelations> {
    const live = await tx.rentalSettlement.findFirst({
      where: { id, deletedAt: null },
      include: settlementInclude,
    });
    if (!live) throw BusinessException.notFound('Settlement not found');
    this.assertMutable(live);
    return live;
  }

  private async allocateRefundNumber() {
    const prefix = (
      await this.settings.getString(
        'finance.refund.number.prefix',
        'REF',
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
      throw BusinessException.validation('Invalid refund number settings');
    }
    for (let i = 0; i < 25; i += 1) {
      const seq = await this.repo.nextSequence(`finance.refund.number.prefix:${prefix}`);
      const number = `${prefix}${separator}${String(seq).padStart(padding, '0')}`;
      const taken = await this.repo.client.settlementRefund.findUnique({
        where: { refundNumber: number },
      });
      if (!taken) return number;
    }
    throw BusinessException.invariant('Unable to allocate refund number');
  }
}

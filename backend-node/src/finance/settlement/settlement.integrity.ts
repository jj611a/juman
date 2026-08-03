import { BusinessException } from '../../shared/errors/business.exception';
import { SETTLEMENT_STATUS } from './settlement.constants';
import { canApplyPayment, canTransitionSettlementStatus } from './settlement.rules';
import {
  computeSettlementTotalFils,
  type SettlementComponents,
} from './settlement.formula';

/** Settlement balance invariant: paid + remaining === total. */
export function assertSettlementBalanceInvariant(row: {
  totalFils: number;
  paidFils: number;
  remainingFils: number;
}): void {
  if (row.paidFils + row.remainingFils !== row.totalFils) {
    throw BusinessException.invariant(
      `Settlement balance broken: paid(${row.paidFils})+remaining(${row.remainingFils})≠total(${row.totalFils})`,
    );
  }
  if (row.paidFils < 0 || row.remainingFils < 0 || row.totalFils < 0) {
    throw BusinessException.invariant('Settlement amounts must be non-negative');
  }
}

/** Paid/closed settlements must never accept payments or regress to partially_paid. */
export function assertSettlementStatusIntegrity(status: string): void {
  if (status === SETTLEMENT_STATUS.PAID || status === SETTLEMENT_STATUS.CLOSED) {
    if (canApplyPayment(status)) {
      throw BusinessException.invariant(
        `Paid/closed settlement must not accept payments (status=${status})`,
      );
    }
    if (
      canTransitionSettlementStatus(
        status as 'paid' | 'closed',
        SETTLEMENT_STATUS.PARTIALLY_PAID,
      )
    ) {
      throw BusinessException.invariant(
        'Paid settlement must never become partially_paid',
      );
    }
  }
  if (status === SETTLEMENT_STATUS.CANCELLED && canApplyPayment(status)) {
    throw BusinessException.invariant('Cancelled settlement must reject payments');
  }
}

/** Components must recompute to stored total. */
export function assertSettlementComponentsMatchTotal(
  components: SettlementComponents,
  totalFils: number,
): void {
  const expected = computeSettlementTotalFils(components);
  if (expected !== totalFils) {
    throw BusinessException.invariant(
      `Settlement total ${totalFils} ≠ formula ${expected}`,
    );
  }
}

/**
 * Ledger reconstruction at checkout (charge − deposit model):
 * settlement.total should equal charge − deposit when no modifiers yet.
 */
export function assertLedgerMatchesSettlement(input: {
  chargeFils: number;
  depositFils: number;
  settlementTotalFils: number;
  settlementPaidFils: number;
  settlementRemainingFils: number;
  appliedPaymentFils: number;
  lateFeeFils?: number;
  adjustmentFils?: number;
  discountFils?: number;
  refundFils?: number;
}): void {
  const expectedTotal = computeSettlementTotalFils({
    chargeFils: input.chargeFils,
    depositFils: input.depositFils,
    lateFeeFils: input.lateFeeFils ?? 0,
    adjustmentFils: input.adjustmentFils ?? 0,
    discountFils: input.discountFils ?? 0,
    refundFils: input.refundFils ?? 0,
  });
  if (input.settlementTotalFils !== expectedTotal) {
    throw BusinessException.invariant(
      `Settlement total ${input.settlementTotalFils} ≠ formula ${expectedTotal}`,
    );
  }
  if (input.settlementPaidFils !== input.appliedPaymentFils) {
    throw BusinessException.invariant(
      `Settlement paid ${input.settlementPaidFils} ≠ applied payments ${input.appliedPaymentFils}`,
    );
  }
  assertSettlementBalanceInvariant({
    totalFils: input.settlementTotalFils,
    paidFils: input.settlementPaidFils,
    remainingFils: input.settlementRemainingFils,
  });
}

export function assertRefundConsistency(input: {
  refundFils: number;
  postedRefundSumFils: number;
}): void {
  if (input.refundFils !== input.postedRefundSumFils) {
    throw BusinessException.invariant(
      `Settlement refundFils ${input.refundFils} ≠ posted refunds ${input.postedRefundSumFils}`,
    );
  }
}

export function assertAdjustmentConsistency(input: {
  adjustmentFils: number;
  postedAdjustmentSumFils: number;
}): void {
  if (input.adjustmentFils !== input.postedAdjustmentSumFils) {
    throw BusinessException.invariant(
      `Settlement adjustmentFils ${input.adjustmentFils} ≠ posted adjustments ${input.postedAdjustmentSumFils}`,
    );
  }
}

export function assertDiscountConsistency(input: {
  discountFils: number;
  postedDiscountSumFils: number;
}): void {
  if (input.discountFils !== input.postedDiscountSumFils) {
    throw BusinessException.invariant(
      `Settlement discountFils ${input.discountFils} ≠ posted discounts ${input.postedDiscountSumFils}`,
    );
  }
}

export function assertLateFeeConsistency(input: {
  lateFeeFils: number;
  postedLateFeeSumFils: number;
}): void {
  if (input.lateFeeFils !== input.postedLateFeeSumFils) {
    throw BusinessException.invariant(
      `Settlement lateFeeFils ${input.lateFeeFils} ≠ posted late fees ${input.postedLateFeeSumFils}`,
    );
  }
}

/** @deprecated Use assertSettlementComponentsMatchTotal — kept for callers expecting old name. */
export function assertSettlementObligationFormula(input: {
  chargeFils: number;
  discountFils?: number;
  lateFeeFils?: number;
  refundFils?: number;
  settlementTotalFils: number;
  settlementPaidFils: number;
  settlementRemainingFils: number;
  depositFils?: number;
  adjustmentFils?: number;
}): void {
  assertSettlementComponentsMatchTotal(
    {
      chargeFils: input.chargeFils,
      depositFils: input.depositFils ?? 0,
      lateFeeFils: input.lateFeeFils ?? 0,
      adjustmentFils: input.adjustmentFils ?? 0,
      discountFils: input.discountFils ?? 0,
      refundFils: input.refundFils ?? 0,
    },
    input.settlementTotalFils,
  );
  assertSettlementBalanceInvariant({
    totalFils: input.settlementTotalFils,
    paidFils: input.settlementPaidFils,
    remainingFils: input.settlementRemainingFils,
  });
}

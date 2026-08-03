import { BusinessException } from '../../shared/errors/business.exception';
import { Money } from '../money/money.value';
import { SETTLEMENT_STATUS, type SettlementStatus } from './settlement.constants';

/**
 * Authoritative settlement money formula (Phase 6.6).
 *
 * Settlement Total =
 *   Charges (gross charge − deposit)
 * + Late Fees
 * + Adjustments (signed)
 * − Discounts
 * − Refunds
 *
 * Outstanding / remaining = Settlement Total − Payments (paidFils)
 *
 * Deposit is a checkout reduction of Charges — not a Payment and not a Discount.
 * All engines must use these helpers; do not duplicate arithmetic elsewhere.
 */

export type SettlementComponents = {
  chargeFils: number;
  depositFils: number;
  lateFeeFils: number;
  /** Signed net adjustments. */
  adjustmentFils: number;
  discountFils: number;
  refundFils: number;
};

export type SettlementBalances = {
  totalFils: number;
  paidFils: number;
  remainingFils: number;
  status: SettlementStatus;
};

/** Effective charges after deposit. */
export function effectiveChargesFils(input: {
  chargeFils: number;
  depositFils: number;
}): number {
  const charge = Money.ofNonNegativeFils(input.chargeFils);
  const deposit = Money.ofNonNegativeFils(input.depositFils);
  if (deposit.amountFils > charge.amountFils) {
    throw BusinessException.validation(
      'Deposit cannot exceed rental charge for settlement',
    );
  }
  return charge.subtract(deposit).amountFils;
}

/**
 * Settlement Total = Charges + Late Fees + Adjustments − Discounts − Refunds
 * where Charges = chargeFils − depositFils.
 */
export function computeSettlementTotalFils(c: SettlementComponents): number {
  const charges = effectiveChargesFils({
    chargeFils: c.chargeFils,
    depositFils: c.depositFils,
  });
  const late = Money.ofNonNegativeFils(c.lateFeeFils).amountFils;
  const adj = Money.ofFils(c.adjustmentFils).amountFils;
  const discount = Money.ofNonNegativeFils(c.discountFils).amountFils;
  const refund = Money.ofNonNegativeFils(c.refundFils).amountFils;

  const total = charges + late + adj - discount - refund;
  if (total < 0) {
    throw BusinessException.validation(
      'Settlement total cannot be negative after modifiers',
    );
  }
  return total;
}

export function computeOutstandingFils(totalFils: number, paidFils: number): number {
  const total = Money.ofNonNegativeFils(totalFils).amountFils;
  const paid = Money.ofNonNegativeFils(paidFils).amountFils;
  if (paid > total) {
    throw BusinessException.validation(
      'Paid amount exceeds settlement total — reduce payments via refund credit-note limits',
    );
  }
  return total - paid;
}

export function deriveSettlementStatus(
  remainingFils: number,
  paidFils: number,
): SettlementStatus {
  if (remainingFils <= 0) return SETTLEMENT_STATUS.PAID;
  if (paidFils > 0) return SETTLEMENT_STATUS.PARTIALLY_PAID;
  return SETTLEMENT_STATUS.OPEN;
}

/** Full recalculation from components + paid. */
export function recalculateSettlementBalances(
  components: SettlementComponents,
  paidFils: number,
): SettlementBalances {
  const totalFils = computeSettlementTotalFils(components);
  const remainingFils = computeOutstandingFils(totalFils, paidFils);
  const status = deriveSettlementStatus(remainingFils, paidFils);
  return { totalFils, paidFils, remainingFils, status };
}

/** Fixed discount in fils. */
export function computeFixedDiscountFils(amountFils: number): number {
  return Money.ofNonNegativeFils(amountFils).amountFils;
}

/**
 * Percentage discount in basis points (10000 = 100%).
 * Basis amount is typically effective charges or current total before this discount.
 */
export function computePercentageDiscountFils(
  basisFils: number,
  percentBps: number,
): number {
  const basis = Money.ofNonNegativeFils(basisFils).amountFils;
  if (!Number.isInteger(percentBps) || percentBps < 1 || percentBps > 10000) {
    throw BusinessException.validation(
      'Discount percentBps must be an integer from 1 to 10000 (100%)',
    );
  }
  return Math.floor((basis * percentBps) / 10000);
}

/** Flat late fee. */
export function computeFlatLateFeeFils(flatFils: number, maxFils?: number | null): number {
  let fee = Money.ofNonNegativeFils(flatFils).amountFils;
  if (maxFils != null) {
    const max = Money.ofNonNegativeFils(maxFils).amountFils;
    if (fee > max) fee = max;
  }
  if (fee <= 0) {
    throw BusinessException.validation('Late fee must be greater than zero');
  }
  return fee;
}

/** Daily late fee × days, capped by max. */
export function computeDailyLateFeeFils(input: {
  dailyFils: number;
  daysCharged: number;
  maxFils?: number | null;
}): number {
  const daily = Money.ofNonNegativeFils(input.dailyFils).amountFils;
  if (!Number.isInteger(input.daysCharged) || input.daysCharged < 1) {
    throw BusinessException.validation('daysCharged must be a positive integer');
  }
  let fee = daily * input.daysCharged;
  if (input.maxFils != null) {
    const max = Money.ofNonNegativeFils(input.maxFils).amountFils;
    if (fee > max) fee = max;
  }
  if (fee <= 0) {
    throw BusinessException.validation('Late fee must be greater than zero');
  }
  return fee;
}

import { BusinessException } from '../../shared/errors/business.exception';
import { SETTLEMENT_STATUS } from './settlement.constants';
import { canApplyPayment, canTransitionSettlementStatus } from './settlement.rules';

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

/**
 * Ledger reconstruction for a rental settlement:
 * charge − deposit − settlement-applied payments should equal remaining,
 * and settlement.total should equal charge − deposit.
 */
export function assertLedgerMatchesSettlement(input: {
  chargeFils: number;
  depositFils: number;
  settlementTotalFils: number;
  settlementPaidFils: number;
  settlementRemainingFils: number;
  appliedPaymentFils: number;
}): void {
  const expectedTotal = input.chargeFils - input.depositFils;
  if (input.settlementTotalFils !== expectedTotal) {
    throw BusinessException.invariant(
      `Settlement total ${input.settlementTotalFils} ≠ charge-deposit ${expectedTotal}`,
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
  const expectedRemaining = expectedTotal - input.appliedPaymentFils;
  if (input.settlementRemainingFils !== expectedRemaining) {
    throw BusinessException.invariant(
      `Remaining ${input.settlementRemainingFils} ≠ charge-deposit-payments ${expectedRemaining}`,
    );
  }
}

import {
  SETTLEMENT_STATUS,
  SETTLEMENT_STATUS_TRANSITIONS,
  SETTLEMENT_STATUS_VALUES,
  type SettlementStatus,
} from './settlement.constants';

export function isSettlementStatus(value: string): value is SettlementStatus {
  return (SETTLEMENT_STATUS_VALUES as string[]).includes(value);
}

export function canTransitionSettlementStatus(
  from: SettlementStatus,
  to: SettlementStatus,
): boolean {
  return SETTLEMENT_STATUS_TRANSITIONS[from].includes(to);
}

export function statusAfterPayment(
  remainingFils: number,
  paidFils: number,
): SettlementStatus {
  if (remainingFils <= 0) return SETTLEMENT_STATUS.PAID;
  if (paidFils > 0) return SETTLEMENT_STATUS.PARTIALLY_PAID;
  return SETTLEMENT_STATUS.OPEN;
}

export function canApplyPayment(status: string): boolean {
  return (
    status === SETTLEMENT_STATUS.OPEN ||
    status === SETTLEMENT_STATUS.PARTIALLY_PAID
  );
}

export function canClose(status: string): boolean {
  return status === SETTLEMENT_STATUS.PAID;
}

/** Only unpaid open settlements may cancel; partial requires refund. */
export function canCancel(status: string): boolean {
  return status === SETTLEMENT_STATUS.OPEN;
}

export function isFinanciallyComplete(status: string): boolean {
  return (
    status === SETTLEMENT_STATUS.PAID || status === SETTLEMENT_STATUS.CLOSED
  );
}

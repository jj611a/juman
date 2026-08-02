import { BusinessException } from '../../shared/errors/business.exception';
import { SETTLEMENT_STATUS } from './settlement.constants';

/**
 * Authoritative rental ↔ settlement cancel policy (Phase 6.5).
 *
 * | Rental / settlement state                         | Action                                      |
 * |---------------------------------------------------|---------------------------------------------|
 * | Draft rental, no settlement                       | Cancel rental only                          |
 * | Open settlement, paidFils === 0                   | Void charge/deposit ledger + cancel settlement + cancel rental (one TX) |
 * | Paid with totalFils === 0 (free / full deposit)   | Same as open unpaid (void + cancel settlement)                          |
 * | Partially paid                                    | REJECT — refund required (not implemented)  |
 * | Paid (total > 0) / closed                         | REJECT                                      |
 * | Settlement already cancelled                      | Cancel rental only (inventory unwind)       |
 *
 * "Reverse charge" for unpaid open settlements = void posted charge/deposit
 * rows (status → voided). This is not a customer refund product path.
 */
export type CancelSettlementDecision =
  | { kind: 'none' }
  | { kind: 'cancel_open_unpaid'; settlementId: string }
  | { kind: 'already_cancelled' };

export function decideRentalCancelFinance(settlement: {
  id: string;
  status: string;
  paidFils: number;
  totalFils?: number;
} | null): CancelSettlementDecision {
  if (!settlement) return { kind: 'none' };
  if (settlement.status === SETTLEMENT_STATUS.CANCELLED) {
    return { kind: 'already_cancelled' };
  }
  const totalFils = settlement.totalFils ?? -1;
  // Zero-obligation "paid" (free rental / full deposit) may cancel with void.
  if (
    settlement.status === SETTLEMENT_STATUS.PAID &&
    settlement.paidFils === 0 &&
    totalFils === 0
  ) {
    return { kind: 'cancel_open_unpaid', settlementId: settlement.id };
  }
  if (
    settlement.status === SETTLEMENT_STATUS.PAID ||
    settlement.status === SETTLEMENT_STATUS.CLOSED
  ) {
    throw BusinessException.conflict(
      'Cannot cancel rental: settlement is paid — reverse via refund workflow (not available)',
    );
  }
  if (
    settlement.status === SETTLEMENT_STATUS.PARTIALLY_PAID ||
    settlement.paidFils > 0
  ) {
    throw BusinessException.conflict(
      'Cannot cancel rental: settlement is partially paid — refund required before cancel',
    );
  }
  if (settlement.status === SETTLEMENT_STATUS.OPEN) {
    return { kind: 'cancel_open_unpaid', settlementId: settlement.id };
  }
  throw BusinessException.conflict(
    `Cannot cancel rental: settlement status ${settlement.status} is not cancellable`,
  );
}

import { BusinessException } from '../../shared/errors/business.exception';
import { SETTLEMENT_STATUS } from './settlement.constants';
import type { CancelSettlementDecision } from './rental-cancel.policy';

/**
 * Sale ↔ settlement cancel policy (Phase 6.7).
 * Same unpaid-void rules as rentals; Arabic messages scoped to sales.
 */
export function decideSaleCancelFinance(settlement: {
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
      'لا يمكن إلغاء البيع: التسوية مدفوعة — يلزم مسار الاسترداد أولاً',
    );
  }
  if (
    settlement.status === SETTLEMENT_STATUS.PARTIALLY_PAID ||
    settlement.paidFils > 0
  ) {
    throw BusinessException.conflict(
      'لا يمكن إلغاء البيع: توجد دفعات محصّلة — يلزم استردادها قبل الإلغاء',
    );
  }
  if (settlement.status === SETTLEMENT_STATUS.OPEN) {
    return { kind: 'cancel_open_unpaid', settlementId: settlement.id };
  }
  throw BusinessException.conflict(
    `لا يمكن إلغاء البيع: حالة التسوية «${settlement.status}» غير قابلة للإلغاء`,
  );
}

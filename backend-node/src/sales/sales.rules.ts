import { BusinessException } from '../shared/errors/business.exception';
import { SALE_STATUS, SALE_STATUS_TRANSITIONS, type SaleStatus } from './sales.constants';

export function isSaleStatus(value: string): value is SaleStatus {
  return (Object.values(SALE_STATUS) as string[]).includes(value);
}

export function canTransitionSaleStatus(from: SaleStatus, to: SaleStatus): boolean {
  return SALE_STATUS_TRANSITIONS[from].includes(to);
}

export function canConfirm(status: string): boolean {
  return status === SALE_STATUS.DRAFT;
}

export function canComplete(status: string): boolean {
  return status === SALE_STATUS.CONFIRMED;
}

export function canCancel(status: string): boolean {
  return status === SALE_STATUS.DRAFT || status === SALE_STATUS.CONFIRMED;
}

export function canPay(status: string): boolean {
  return status === SALE_STATUS.CONFIRMED;
}

/** Phase 6.7: one physical Item per line. */
export function assertSaleQuantity(quantity: number): void {
  if (quantity !== 1) {
    throw BusinessException.validation(
      'Sale item quantity must be 1 until multi-qty inventory exists',
    );
  }
}

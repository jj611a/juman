import { describe, expect, it } from 'vitest';
import {
  assertSaleQuantity,
  canCancel,
  canComplete,
  canConfirm,
  canPay,
  canSoftDeleteSale,
  canTransitionSaleStatus,
  isLiveSaleSettlementStatus,
  isSaleStatus,
} from '../src/sales/sales.rules';
import { SALE_STATUS } from '../src/sales/sales.constants';

describe('sales.rules', () => {
  it('validates status helpers', () => {
    expect(isSaleStatus('draft')).toBe(true);
    expect(isSaleStatus('bogus')).toBe(false);
    expect(canConfirm(SALE_STATUS.DRAFT)).toBe(true);
    expect(canConfirm(SALE_STATUS.CONFIRMED)).toBe(false);
    expect(canComplete(SALE_STATUS.CONFIRMED)).toBe(true);
    expect(canPay(SALE_STATUS.CONFIRMED)).toBe(true);
    expect(canCancel(SALE_STATUS.DRAFT)).toBe(true);
    expect(canCancel(SALE_STATUS.COMPLETED)).toBe(false);
  });

  it('enforces transitions', () => {
    expect(canTransitionSaleStatus(SALE_STATUS.DRAFT, SALE_STATUS.CONFIRMED)).toBe(
      true,
    );
    expect(
      canTransitionSaleStatus(SALE_STATUS.COMPLETED, SALE_STATUS.CANCELLED),
    ).toBe(false);
  });

  it('enforces quantity = 1', () => {
    expect(() => assertSaleQuantity(1)).not.toThrow();
    expect(() => assertSaleQuantity(2)).toThrow();
  });

  it('enforces soft-delete and live settlement helpers', () => {
    expect(canSoftDeleteSale(SALE_STATUS.DRAFT)).toBe(true);
    expect(canSoftDeleteSale(SALE_STATUS.CANCELLED)).toBe(true);
    expect(canSoftDeleteSale(SALE_STATUS.CONFIRMED)).toBe(false);
    expect(canSoftDeleteSale(SALE_STATUS.COMPLETED)).toBe(false);
    expect(isLiveSaleSettlementStatus('open')).toBe(true);
    expect(isLiveSaleSettlementStatus('partially_paid')).toBe(true);
    expect(isLiveSaleSettlementStatus('paid')).toBe(true);
    expect(isLiveSaleSettlementStatus('cancelled')).toBe(false);
  });
});

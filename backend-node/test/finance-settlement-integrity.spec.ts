import { describe, expect, it } from 'vitest';
import { BusinessException } from '../src/shared/errors/business.exception';
import { SETTLEMENT_STATUS } from '../src/finance/settlement/settlement.constants';
import {
  assertLedgerMatchesSettlement,
  assertSettlementBalanceInvariant,
  assertSettlementStatusIntegrity,
} from '../src/finance/settlement/settlement.integrity';
import {
  canApplyPayment,
  canTransitionSettlementStatus,
} from '../src/finance/settlement/settlement.rules';

describe('settlement integrity invariants', () => {
  it('enforces paid + remaining === total', () => {
    expect(() =>
      assertSettlementBalanceInvariant({
        totalFils: 4000,
        paidFils: 1500,
        remainingFils: 2500,
      }),
    ).not.toThrow();
    expect(() =>
      assertSettlementBalanceInvariant({
        totalFils: 4000,
        paidFils: 1000,
        remainingFils: 2500,
      }),
    ).toThrow(BusinessException);
    expect(() =>
      assertSettlementBalanceInvariant({
        totalFils: 100,
        paidFils: -1,
        remainingFils: 101,
      }),
    ).toThrow(BusinessException);
  });

  it('paid settlement never becomes partially_paid; closed/cancelled reject payments', () => {
    expect(
      canTransitionSettlementStatus(
        SETTLEMENT_STATUS.PAID,
        SETTLEMENT_STATUS.PARTIALLY_PAID,
      ),
    ).toBe(false);
    expect(canApplyPayment(SETTLEMENT_STATUS.PAID)).toBe(false);
    expect(canApplyPayment(SETTLEMENT_STATUS.CLOSED)).toBe(false);
    expect(canApplyPayment(SETTLEMENT_STATUS.CANCELLED)).toBe(false);

    expect(() =>
      assertSettlementStatusIntegrity(SETTLEMENT_STATUS.PAID),
    ).not.toThrow();
    expect(() =>
      assertSettlementStatusIntegrity(SETTLEMENT_STATUS.CLOSED),
    ).not.toThrow();
    expect(() =>
      assertSettlementStatusIntegrity(SETTLEMENT_STATUS.CANCELLED),
    ).not.toThrow();
  });

  it('ledger totals match settlement (charge - deposit - payments)', () => {
    expect(() =>
      assertLedgerMatchesSettlement({
        chargeFils: 5000,
        depositFils: 1000,
        settlementTotalFils: 4000,
        settlementPaidFils: 1500,
        settlementRemainingFils: 2500,
        appliedPaymentFils: 1500,
      }),
    ).not.toThrow();

    expect(() =>
      assertLedgerMatchesSettlement({
        chargeFils: 5000,
        depositFils: 1000,
        settlementTotalFils: 3000,
        settlementPaidFils: 0,
        settlementRemainingFils: 3000,
        appliedPaymentFils: 0,
      }),
    ).toThrow(BusinessException);

    expect(() =>
      assertLedgerMatchesSettlement({
        chargeFils: 5000,
        depositFils: 1000,
        settlementTotalFils: 4000,
        settlementPaidFils: 1000,
        settlementRemainingFils: 3000,
        appliedPaymentFils: 1500,
      }),
    ).toThrow(BusinessException);
  });
});

import { describe, expect, it } from 'vitest';
import { BusinessException } from '../src/shared/errors/business.exception';
import {
  computeDailyLateFeeFils,
  computeFixedDiscountFils,
  computeFlatLateFeeFils,
  computePercentageDiscountFils,
  computeSettlementTotalFils,
  effectiveChargesFils,
  recalculateSettlementBalances,
} from '../src/finance/settlement/settlement.formula';
import {
  assertAdjustmentConsistency,
  assertDiscountConsistency,
  assertLateFeeConsistency,
  assertRefundConsistency,
  assertSettlementComponentsMatchTotal,
} from '../src/finance/settlement/settlement.integrity';

describe('settlement.formula (Phase 6.6)', () => {
  it('computes total = charges + late + adj − discount − refund', () => {
    expect(
      computeSettlementTotalFils({
        chargeFils: 5000,
        depositFils: 1000,
        lateFeeFils: 200,
        adjustmentFils: 100,
        discountFils: 300,
        refundFils: 100,
      }),
    ).toBe(3900);

    expect(effectiveChargesFils({ chargeFils: 5000, depositFils: 1000 })).toBe(4000);
    expect(() =>
      effectiveChargesFils({ chargeFils: 100, depositFils: 200 }),
    ).toThrow(BusinessException);
  });

  it('recalculates balances and rejects paid > total', () => {
    const bal = recalculateSettlementBalances(
      {
        chargeFils: 4000,
        depositFils: 0,
        lateFeeFils: 0,
        adjustmentFils: 0,
        discountFils: 0,
        refundFils: 0,
      },
      1500,
    );
    expect(bal).toEqual({
      totalFils: 4000,
      paidFils: 1500,
      remainingFils: 2500,
      status: 'partially_paid',
    });

    expect(() =>
      recalculateSettlementBalances(
        {
          chargeFils: 1000,
          depositFils: 0,
          lateFeeFils: 0,
          adjustmentFils: 0,
          discountFils: 500,
          refundFils: 0,
        },
        800,
      ),
    ).toThrow(BusinessException);
  });

  it('computes discount and late fee helpers', () => {
    expect(computeFixedDiscountFils(500)).toBe(500);
    expect(computePercentageDiscountFils(10000, 2500)).toBe(2500);
    expect(() => computePercentageDiscountFils(1000, 0)).toThrow(BusinessException);
    expect(computeFlatLateFeeFils(1000, 800)).toBe(800);
    expect(
      computeDailyLateFeeFils({ dailyFils: 100, daysCharged: 5, maxFils: 350 }),
    ).toBe(350);
  });

  it('rejects invalid late fee and negative totals', () => {
    expect(() => computeFlatLateFeeFils(0)).toThrow(BusinessException);
    expect(() =>
      computeDailyLateFeeFils({ dailyFils: 100, daysCharged: 0 }),
    ).toThrow(BusinessException);
    expect(() =>
      computeDailyLateFeeFils({ dailyFils: 0, daysCharged: 1 }),
    ).toThrow(BusinessException);
    expect(() =>
      computeSettlementTotalFils({
        chargeFils: 100,
        depositFils: 0,
        lateFeeFils: 0,
        adjustmentFils: -50,
        discountFils: 100,
        refundFils: 0,
      }),
    ).toThrow(BusinessException);
  });

  it('asserts component and modifier consistency', () => {
    assertSettlementComponentsMatchTotal(
      {
        chargeFils: 4000,
        depositFils: 0,
        lateFeeFils: 0,
        adjustmentFils: 0,
        discountFils: 0,
        refundFils: 0,
      },
      4000,
    );
    expect(() =>
      assertSettlementComponentsMatchTotal(
        {
          chargeFils: 4000,
          depositFils: 0,
          lateFeeFils: 0,
          adjustmentFils: 0,
          discountFils: 0,
          refundFils: 0,
        },
        3000,
      ),
    ).toThrow(BusinessException);
    assertRefundConsistency({ refundFils: 100, postedRefundSumFils: 100 });
    assertAdjustmentConsistency({
      adjustmentFils: -50,
      postedAdjustmentSumFils: -50,
    });
    assertDiscountConsistency({ discountFils: 200, postedDiscountSumFils: 200 });
    assertLateFeeConsistency({ lateFeeFils: 75, postedLateFeeSumFils: 75 });
    expect(() =>
      assertRefundConsistency({ refundFils: 1, postedRefundSumFils: 2 }),
    ).toThrow(BusinessException);
    expect(() =>
      assertAdjustmentConsistency({
        adjustmentFils: 1,
        postedAdjustmentSumFils: 2,
      }),
    ).toThrow(BusinessException);
    expect(() =>
      assertDiscountConsistency({
        discountFils: 1,
        postedDiscountSumFils: 2,
      }),
    ).toThrow(BusinessException);
    expect(() =>
      assertLateFeeConsistency({
        lateFeeFils: 1,
        postedLateFeeSumFils: 2,
      }),
    ).toThrow(BusinessException);
  });
});

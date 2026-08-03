export const SETTLEMENT_MODULE = 'settlement';
export const SETTLEMENT_ENTITY = 'rental_settlement';

export const SETTLEMENT_PERMISSION = {
  VIEW: 'finance.settlement.view',
  MANAGE: 'finance.settlement.manage',
} as const;

/** SettlementStatus — closed status set for rental financial completion. */
export const SETTLEMENT_STATUS = {
  OPEN: 'open',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
} as const;

export type SettlementStatus =
  (typeof SETTLEMENT_STATUS)[keyof typeof SETTLEMENT_STATUS];

export const SETTLEMENT_STATUS_VALUES = Object.values(SETTLEMENT_STATUS);

export const SETTLEMENT_STATUS_TRANSITIONS: Readonly<
  Record<SettlementStatus, readonly SettlementStatus[]>
> = {
  [SETTLEMENT_STATUS.OPEN]: [
    SETTLEMENT_STATUS.PARTIALLY_PAID,
    SETTLEMENT_STATUS.PAID,
    SETTLEMENT_STATUS.CANCELLED,
  ],
  [SETTLEMENT_STATUS.PARTIALLY_PAID]: [
    SETTLEMENT_STATUS.PARTIALLY_PAID,
    SETTLEMENT_STATUS.PAID,
    // Cancel blocked — refund required (Phase 6.5 policy).
  ],
  [SETTLEMENT_STATUS.PAID]: [
    SETTLEMENT_STATUS.CLOSED,
    // Zero-obligation cancel only (enforced in rental-cancel.policy — not via HTTP canCancel).
    SETTLEMENT_STATUS.CANCELLED,
  ],
  [SETTLEMENT_STATUS.CANCELLED]: [],
  [SETTLEMENT_STATUS.CLOSED]: [],
};

export const SETTLEMENT_ACTION = {
  CREATED: 'created',
  PAYMENT_APPLIED: 'payment_applied',
  MARKED_PAID: 'marked_paid',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  REFUND_APPLIED: 'refund_applied',
  ADJUSTMENT_APPLIED: 'adjustment_applied',
  DISCOUNT_APPLIED: 'discount_applied',
  LATE_FEE_ASSESSED: 'late_fee_assessed',
} as const;

export const REFUND_STATUS = {
  POSTED: 'posted',
  VOIDED: 'voided',
} as const;

export const DISCOUNT_KIND = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const;

export const DISCOUNT_BASIS = {
  RENTAL: 'rental',
  SETTLEMENT: 'settlement',
} as const;

export const LATE_FEE_KIND = {
  FLAT: 'flat',
  DAILY: 'daily',
} as const;

export const SETTLEMENT_MODIFIER_STATUS = {
  POSTED: 'posted',
  VOIDED: 'voided',
} as const;

export const SETTLEMENT_NUMBER_SETTING = {
  PREFIX: 'finance.settlement.number.prefix',
  SEPARATOR: 'finance.settlement.number.separator',
  PADDING: 'finance.settlement.number.padding',
} as const;

export const SETTLEMENT_DEFAULT_PREFIX = 'STL';
export const SETTLEMENT_DEFAULT_SEPARATOR = '-';
export const SETTLEMENT_DEFAULT_PADDING = 8;

export const SETTLEMENT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'settlementNumber',
  'status',
  'remainingFils',
  'totalFils',
] as const;

/** Statuses that mean financial obligations for the rental are satisfied. */
export const SETTLEMENT_FINANCIALLY_COMPLETE: readonly string[] = [
  SETTLEMENT_STATUS.PAID,
  SETTLEMENT_STATUS.CLOSED,
];

export const FINANCE_MODULE = 'finance';
export const FINANCE_ENTITY_ACCOUNT = 'financial_account';
export const FINANCE_ENTITY_TRANSACTION = 'financial_transaction';
export const FINANCE_ENTITY_PAYMENT = 'payment';

export const FINANCE_PERMISSION = {
  VIEW: 'finance.view',
  PAYMENT: 'finance.payment',
  ADJUSTMENT: 'finance.adjustment',
} as const;

export const FINANCE_CURRENCY = 'IQD' as const;

export const FINANCIAL_ACCOUNT_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export const FINANCIAL_TX_TYPE = {
  RENTAL_CHARGE: 'rental_charge',
  DEPOSIT: 'deposit',
  PAYMENT: 'payment',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
  DISCOUNT: 'discount',
  LATE_FEE: 'late_fee',
  SALE_CHARGE: 'sale_charge',
  SALE_PAYMENT: 'sale_payment',
  SALE_DISCOUNT: 'sale_discount',
  SALE_ADJUSTMENT: 'sale_adjustment',
  SALE_REFUND: 'sale_refund',
} as const;

export type FinancialTxType =
  (typeof FINANCIAL_TX_TYPE)[keyof typeof FINANCIAL_TX_TYPE];

export const FINANCIAL_TX_STATUS = {
  PENDING: 'pending',
  POSTED: 'posted',
  VOIDED: 'voided',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const MONEY_MOVEMENT_DIRECTION = {
  IN: 'in',
  OUT: 'out',
} as const;

export const MONEY_MOVEMENT_KIND = {
  CHARGE: 'charge',
  DEPOSIT: 'deposit',
  PAYMENT: 'payment',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
  DISCOUNT: 'discount',
  LATE_FEE: 'late_fee',
} as const;

export const FINANCE_ACCOUNT_NUMBER_SETTING = {
  PREFIX: 'finance.account.number.prefix',
  SEPARATOR: 'finance.account.number.separator',
  PADDING: 'finance.account.number.padding',
} as const;

export const FINANCE_PAYMENT_NUMBER_SETTING = {
  PREFIX: 'finance.payment.number.prefix',
  SEPARATOR: 'finance.payment.number.separator',
  PADDING: 'finance.payment.number.padding',
} as const;

export const FINANCE_DEFAULT_ACCOUNT_PREFIX = 'FIN';
export const FINANCE_DEFAULT_PAYMENT_PREFIX = 'PAY';
export const FINANCE_DEFAULT_SEPARATOR = '-';
export const FINANCE_DEFAULT_PADDING = 8;

export const FINANCE_REFERENCE_RENTAL = 'rental';
export const FINANCE_REFERENCE_SALE = 'sale';

export const SETTLEMENT_ENTITY_TYPE = {
  RENTAL: 'rental',
  SALE: 'sale',
} as const;

export type SettlementEntityType =
  (typeof SETTLEMENT_ENTITY_TYPE)[keyof typeof SETTLEMENT_ENTITY_TYPE];

export const FINANCE_ACCOUNT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'accountNumber',
  'status',
] as const;

export const FINANCE_TX_SORT_FIELDS = [
  'createdAt',
  'amountFils',
  'type',
  'status',
] as const;

export const FINANCE_PAYMENT_SORT_FIELDS = [
  'createdAt',
  'amountFils',
  'status',
  'paymentNumber',
] as const;

/**
 * Effect of a posted transaction on customer outstanding balance (fils).
 * Positive = customer owes more; negative = customer owes less.
 * Must stay aligned with settlement.formula (Phase 6.6).
 */
export function outstandingDeltaFils(
  type: string,
  amountFils: number,
): number {
  switch (type) {
    case FINANCIAL_TX_TYPE.RENTAL_CHARGE:
    case FINANCIAL_TX_TYPE.SALE_CHARGE:
    case FINANCIAL_TX_TYPE.LATE_FEE:
    case FINANCIAL_TX_TYPE.SALE_ADJUSTMENT:
      return amountFils;
    case FINANCIAL_TX_TYPE.DEPOSIT:
    case FINANCIAL_TX_TYPE.PAYMENT:
    case FINANCIAL_TX_TYPE.SALE_PAYMENT:
    case FINANCIAL_TX_TYPE.REFUND:
    case FINANCIAL_TX_TYPE.SALE_REFUND:
    case FINANCIAL_TX_TYPE.DISCOUNT:
    case FINANCIAL_TX_TYPE.SALE_DISCOUNT:
      return -amountFils;
    case FINANCIAL_TX_TYPE.ADJUSTMENT:
      return amountFils; // signed amount already
    default:
      return 0;
  }
}

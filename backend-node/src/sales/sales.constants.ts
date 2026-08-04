export const SALE_MODULE = 'sales';
export const SALE_ENTITY = 'sale';

export const SALE_PERMISSION = {
  VIEW: 'sales.view',
  CREATE: 'sales.create',
  COMPLETE: 'sales.complete',
  CANCEL: 'sales.cancel',
  PAYMENT: 'sales.payment',
} as const;

/** Legacy singular aliases (permission.seeds) — controllers use SALE_PERMISSION. */
export const SALE_PERMISSION_LEGACY = {
  VIEW: 'sale.view',
  CREATE: 'sale.create',
  UPDATE: 'sale.update',
  CANCEL: 'sale.cancel',
} as const;

export const SALE_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type SaleStatus = (typeof SALE_STATUS)[keyof typeof SALE_STATUS];

export const SALE_STATUS_VALUES = Object.values(SALE_STATUS);

export const SALE_STATUS_TRANSITIONS: Readonly<
  Record<SaleStatus, readonly SaleStatus[]>
> = {
  [SALE_STATUS.DRAFT]: [SALE_STATUS.CONFIRMED, SALE_STATUS.CANCELLED],
  [SALE_STATUS.CONFIRMED]: [SALE_STATUS.COMPLETED, SALE_STATUS.CANCELLED],
  [SALE_STATUS.COMPLETED]: [],
  [SALE_STATUS.CANCELLED]: [],
};

export const SALE_HISTORY_ACTION = {
  CREATED: 'created',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export const SALE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'saleNumber',
  'status',
  'completedAt',
  'totalFils',
] as const;

export const SALE_NUMBER_SETTING = {
  PREFIX: 'sales.number.prefix',
  SEPARATOR: 'sales.number.separator',
  PADDING: 'sales.number.padding',
} as const;

export const SALE_DEFAULT_PREFIX = 'SALE';
export const SALE_DEFAULT_SEPARATOR = '-';
export const SALE_DEFAULT_PADDING = 8;

export const SALE_REFERENCE_TYPE = 'sale';

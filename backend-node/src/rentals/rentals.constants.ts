import { ITEM_LIFECYCLE } from '../inventory/inventory.constants';

export const RENTAL_MODULE = 'rentals';
export const RENTAL_ENTITY = 'rental';

export const RENTAL_PERMISSION = {
  VIEW: 'rentals.view',
  CREATE: 'rentals.create',
  CHECKOUT: 'rentals.checkout',
  RETURN: 'rentals.return',
  CANCEL: 'rentals.cancel',
} as const;

export const RENTAL_STATUS = {
  DRAFT: 'draft',
  CHECKED_OUT: 'checked_out',
  ACTIVE: 'active',
  RETURN_PENDING: 'return_pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
} as const;

export type RentalStatus = (typeof RENTAL_STATUS)[keyof typeof RENTAL_STATUS];

export const RENTAL_STATUS_VALUES = Object.values(RENTAL_STATUS);

export const RENTAL_STATUS_TRANSITIONS: Readonly<
  Record<RentalStatus, readonly RentalStatus[]>
> = {
  [RENTAL_STATUS.DRAFT]: [RENTAL_STATUS.CHECKED_OUT, RENTAL_STATUS.CANCELLED],
  [RENTAL_STATUS.CHECKED_OUT]: [
    RENTAL_STATUS.ACTIVE,
    RENTAL_STATUS.RETURN_PENDING,
    RENTAL_STATUS.CANCELLED,
  ],
  [RENTAL_STATUS.ACTIVE]: [
    RENTAL_STATUS.RETURN_PENDING,
    RENTAL_STATUS.OVERDUE,
    RENTAL_STATUS.CANCELLED,
  ],
  [RENTAL_STATUS.OVERDUE]: [
    RENTAL_STATUS.RETURN_PENDING,
    RENTAL_STATUS.CANCELLED,
  ],
  [RENTAL_STATUS.RETURN_PENDING]: [RENTAL_STATUS.COMPLETED],
  [RENTAL_STATUS.COMPLETED]: [],
  [RENTAL_STATUS.CANCELLED]: [],
};

/** Inventory path used on checkout (LifecycleService owns mutations). */
export const RENTAL_CHECKOUT_ITEM_PATH = [
  ITEM_LIFECYCLE.RESERVED,
  ITEM_LIFECYCLE.RENTED,
] as const;

/** Inventory path used when cancelling an out-bound rental. */
export const RENTAL_CANCEL_ITEM_PATH = [
  ITEM_LIFECYCLE.RETURN_PENDING,
  ITEM_LIFECYCLE.INSPECTION,
  ITEM_LIFECYCLE.AVAILABLE,
] as const;

export const RENTAL_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'rentalDate',
  'expectedReturnDate',
  'rentalNumber',
  'status',
] as const;

export const RENTAL_NUMBER_SETTING = {
  PREFIX: 'rentals.number.prefix',
  SEPARATOR: 'rentals.number.separator',
  PADDING: 'rentals.number.padding',
} as const;

export const RENTAL_DEFAULT_PREFIX = 'RENT';
export const RENTAL_DEFAULT_SEPARATOR = '-';
export const RENTAL_DEFAULT_PADDING = 8;

export const RENTAL_REFERENCE_TYPE = 'rental';

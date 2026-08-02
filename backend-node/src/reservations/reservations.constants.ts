export const RESERVATION_MODULE = 'reservations';
export const RESERVATION_ENTITY = 'reservation';

export const RESERVATION_PERMISSION = {
  VIEW: 'reservations.view',
  CREATE: 'reservations.create',
  CHECKOUT: 'reservations.checkout',
  CANCEL: 'reservations.cancel',
  EXPIRE: 'reservations.expire',
} as const;

export const RESERVATION_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  COMPLETED: 'completed',
} as const;

export type ReservationStatus =
  (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

export const RESERVATION_STATUS_VALUES = Object.values(RESERVATION_STATUS);

export const RESERVATION_STATUS_TRANSITIONS: Readonly<
  Record<ReservationStatus, readonly ReservationStatus[]>
> = {
  [RESERVATION_STATUS.DRAFT]: [
    RESERVATION_STATUS.CONFIRMED,
    RESERVATION_STATUS.CANCELLED,
    RESERVATION_STATUS.EXPIRED,
  ],
  [RESERVATION_STATUS.CONFIRMED]: [
    RESERVATION_STATUS.CHECKED_OUT,
    RESERVATION_STATUS.CANCELLED,
    RESERVATION_STATUS.EXPIRED,
  ],
  [RESERVATION_STATUS.CHECKED_OUT]: [RESERVATION_STATUS.COMPLETED],
  [RESERVATION_STATUS.CANCELLED]: [],
  [RESERVATION_STATUS.EXPIRED]: [],
  [RESERVATION_STATUS.COMPLETED]: [],
};

export const RESERVATION_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'startDate',
  'expectedCheckoutDate',
  'expectedReturnDate',
  'reservationNumber',
  'status',
] as const;

export const RESERVATION_NUMBER_SETTING = {
  PREFIX: 'reservations.number.prefix',
  SEPARATOR: 'reservations.number.separator',
  PADDING: 'reservations.number.padding',
} as const;

export const RESERVATION_DEFAULT_PREFIX = 'RSV';
export const RESERVATION_DEFAULT_SEPARATOR = '-';
export const RESERVATION_DEFAULT_PADDING = 8;

export const RESERVATION_REFERENCE_TYPE = 'reservation';

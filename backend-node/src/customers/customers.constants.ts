export const CUSTOMER_MODULE = 'customers';
export const CUSTOMER_ENTITY = 'customer';

export const CUSTOMER_PERMISSION = {
  VIEW: 'customer.view',
  CREATE: 'customer.create',
  UPDATE: 'customer.update',
  DELETE: 'customer.delete',
  RESTORE: 'customer.restore',
} as const;

export const CUSTOMER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type CustomerStatus = (typeof CUSTOMER_STATUS)[keyof typeof CUSTOMER_STATUS];

export const CUSTOMER_GENDER = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;

export type CustomerGender = (typeof CUSTOMER_GENDER)[keyof typeof CUSTOMER_GENDER];

export const CUSTOMER_SORT_FIELDS = [
  'fullName',
  'createdAt',
  'updatedAt',
  'phone',
  'customerNumber',
] as const;

export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export const CUSTOMER_NUMBER_SETTING = {
  PREFIX: 'customers.number.prefix',
  SEPARATOR: 'customers.number.separator',
  PADDING: 'customers.number.padding',
} as const;

export const CUSTOMER_DEFAULT_PREFIX = 'CUS';
export const CUSTOMER_DEFAULT_SEPARATOR = '-';
export const CUSTOMER_DEFAULT_PADDING = 8;

/** System Walk-in customer (Phase 6.7) — anonymous sales settle here. */
export const WALK_IN_CUSTOMER_NUMBER = 'WALK-IN';
export const WALK_IN_CUSTOMER_PHONE = '07000000000';
export const WALK_IN_CUSTOMER_NAME = 'عميل نقدي (Walk-in)';

export const CUSTOMER_NAME_MAX = 200;
export const CUSTOMER_PHONE_MAX = 50;
export const CUSTOMER_ADDRESS_MAX = 500;
export const CUSTOMER_CITY_MAX = 100;
export const CUSTOMER_NOTES_MAX = 2000;
export const CUSTOMER_NATIONAL_ID_MIN = 8;
export const CUSTOMER_NATIONAL_ID_MAX = 20;
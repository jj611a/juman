/** Shared business constants for all domain modules. */
export const MONEY_MINOR_UNITS_PER_IQD = 1000;
export const DEFAULT_CURRENCY_CODE = 'IQD';
export const DEFAULT_CURRENCY_SYMBOL = 'د.ع';
export const DEFAULT_TIMEZONE = 'Asia/Baghdad';
export const DEFAULT_LOCALE = 'ar-IQ';

export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 200;
export const PAGINATION_MIN_LIMIT = 1;

export const BARCODE_DEFAULT_PREFIX = 'DR';
export const BARCODE_DEFAULT_SEPARATOR = '-';
export const BARCODE_DEFAULT_PADDING = 8;
export const BARCODE_PREFIX_PATTERN = /^[A-Z0-9]+$/;

export const BARCODE_STATUS = {
  RESERVED: 'reserved',
  ALLOCATED: 'allocated',
  RELEASED: 'released',
} as const;

export type BarcodeStatus = (typeof BARCODE_STATUS)[keyof typeof BARCODE_STATUS];

export const MEDIA_KIND = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  OTHER: 'other',
} as const;

export type MediaKind = (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND];

export const MEDIA_STORAGE_PROVIDER = {
  LOCAL: 'local',
} as const;

export const SETTING_VALUE_TYPE = {
  STRING: 'string',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  JSON: 'json',
} as const;

export type SettingValueType = (typeof SETTING_VALUE_TYPE)[keyof typeof SETTING_VALUE_TYPE];

export const AUDIT_ACTION = {
  CREATE: 'create',
  UPDATE: 'update',
  SOFT_DELETE: 'soft_delete',
  HARD_DELETE: 'hard_delete',
  RESTORE: 'restore',
  ALLOCATE: 'allocate',
  RESERVE: 'reserve',
  RELEASE: 'release',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
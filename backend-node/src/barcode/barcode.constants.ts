export const BARCODE_MODULE = 'barcode';
export const BARCODE_ENTITY = 'barcode';

export const BARCODE_PERMISSION = {
  VIEW: 'barcode.view',
  GENERATE: 'barcode.generate',
  RESERVE: 'barcode.reserve',
  RELEASE: 'barcode.release',
  RETIRE: 'barcode.retire',
} as const;

export const BARCODE_TYPE = {
  CODE128: 'code128',
  CODE39: 'code39',
  EAN13: 'ean13',
  EAN8: 'ean8',
  UPC_A: 'upc_a',
  QR: 'qr',
} as const;

export type BarcodeType = (typeof BARCODE_TYPE)[keyof typeof BARCODE_TYPE];

export const BARCODE_TYPES = Object.values(BARCODE_TYPE);

export const BARCODE_SETTING = {
  PREFIX: 'barcode.prefix',
  SEPARATOR: 'barcode.separator',
  PADDING: 'barcode.padding',
  DEFAULT_TYPE: 'barcode.default_type',
} as const;

export const BARCODE_SORT_FIELDS = ['createdAt', 'updatedAt', 'code', 'status'] as const;
export type BarcodeSortField = (typeof BARCODE_SORT_FIELDS)[number];

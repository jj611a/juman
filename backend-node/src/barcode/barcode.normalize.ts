import { BARCODE_TYPE, type BarcodeType } from './barcode.constants';

/** Normalize barcode value for storage/lookup. */
export function normalizeBarcodeValue(raw: string, type: BarcodeType = BARCODE_TYPE.CODE128): string {
  let value = raw.trim().replace(/\s+/g, '');
  if (type === BARCODE_TYPE.QR) {
    return value;
  }
  // Linear symbologies: uppercase; strip common separators for GTIN family
  if (type === BARCODE_TYPE.EAN13 || type === BARCODE_TYPE.EAN8 || type === BARCODE_TYPE.UPC_A) {
    value = value.replace(/[^0-9]/g, '');
  } else {
    value = value.toUpperCase();
  }
  return value;
}

import { describe, expect, it } from 'vitest';
import { assertValidSymbology, isBarcodeType } from '../src/barcode/barcode.symbology';
import { normalizeBarcodeValue } from '../src/barcode/barcode.normalize';
import { BARCODE_TYPE } from '../src/barcode/barcode.constants';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('barcode symbology', () => {
  it('validates code128 code39 and gtin checksums', () => {
    assertValidSymbology('DR-00000001', BARCODE_TYPE.CODE128);
    assertValidSymbology('ABC-123', BARCODE_TYPE.CODE39);
    assertValidSymbology('4006381333931', BARCODE_TYPE.EAN13);
    expect(() => assertValidSymbology('4006381333930', BARCODE_TYPE.EAN13)).toThrow(
      BusinessException,
    );
    assertValidSymbology('96385074', BARCODE_TYPE.EAN8);
    assertValidSymbology('042100005264', BARCODE_TYPE.UPC_A);
    assertValidSymbology('https://juman.local/x', BARCODE_TYPE.QR);
    expect(normalizeBarcodeValue('  abc  ', BARCODE_TYPE.CODE39)).toBe('ABC');
    expect(normalizeBarcodeValue('  keep Case  ', BARCODE_TYPE.QR)).toBe('keepCase');
    expect(normalizeBarcodeValue('4-006-381-333-931', BARCODE_TYPE.EAN13)).toBe('4006381333931');
  });

  it('rejects invalid lengths charset and checksums', () => {
    expect(() => assertValidSymbology('', BARCODE_TYPE.CODE128)).toThrow(BusinessException);
    expect(() => assertValidSymbology('abc!', BARCODE_TYPE.CODE39)).toThrow(BusinessException);
    expect(() => assertValidSymbology('123', BARCODE_TYPE.EAN13)).toThrow(BusinessException);
    expect(() => assertValidSymbology('1234567', BARCODE_TYPE.EAN8)).toThrow(BusinessException);
    expect(() => assertValidSymbology('12345678901', BARCODE_TYPE.UPC_A)).toThrow(BusinessException);
    expect(() => assertValidSymbology('96385075', BARCODE_TYPE.EAN8)).toThrow(BusinessException);
    expect(() => assertValidSymbology('042100005265', BARCODE_TYPE.UPC_A)).toThrow(BusinessException);
    expect(() => assertValidSymbology('', BARCODE_TYPE.QR)).toThrow(BusinessException);
    expect(() => assertValidSymbology('x', 'nope' as never)).toThrow(BusinessException);
    expect(isBarcodeType('code128')).toBe(true);
    expect(isBarcodeType('nope')).toBe(false);
  });
});

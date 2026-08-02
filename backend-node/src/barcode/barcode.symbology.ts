import { BusinessException } from '../shared/errors/business.exception';
import { DOMAIN_ERROR_CODE } from '../shared/errors/domain.errors';
import { operatorMessage } from '../shared/localization/messages';
import { BARCODE_TYPE, type BarcodeType } from './barcode.constants';

const CODE39_CHARS = /^[0-9A-Z\-. $/+%]+$/;
const CODE128_CHARS = /^[\x20-\x7E]+$/;

function gtinChecksum(digits: string): number {
  let sum = 0;
  const len = digits.length;
  for (let i = 0; i < len; i += 1) {
    const n = Number(digits[len - 1 - i]);
    // GS1: rightmost body digit weight 3, then alternate 1,3,...
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

export function assertValidSymbology(value: string, type: BarcodeType): void {
  switch (type) {
    case BARCODE_TYPE.CODE128:
      if (value.length < 1 || value.length > 48 || !CODE128_CHARS.test(value)) {
        throw invalid();
      }
      return;
    case BARCODE_TYPE.CODE39:
      if (value.length < 1 || value.length > 43 || !CODE39_CHARS.test(value)) {
        throw invalid();
      }
      return;
    case BARCODE_TYPE.EAN13: {
      if (!/^\d{13}$/.test(value)) throw invalid();
      const body = value.slice(0, 12);
      const check = Number(value[12]);
      if (gtinChecksum(body) !== check) throw invalid();
      return;
    }
    case BARCODE_TYPE.EAN8: {
      if (!/^\d{8}$/.test(value)) throw invalid();
      const body = value.slice(0, 7);
      const check = Number(value[7]);
      if (gtinChecksum(body) !== check) throw invalid();
      return;
    }
    case BARCODE_TYPE.UPC_A: {
      if (!/^\d{12}$/.test(value)) throw invalid();
      const body = value.slice(0, 11);
      const check = Number(value[11]);
      if (gtinChecksum(body) !== check) throw invalid();
      return;
    }
    case BARCODE_TYPE.QR:
      if (value.length < 1 || value.length > 2048) throw invalid();
      return;
    default:
      throw BusinessException.validation(`Unsupported barcode type: ${type}`);
  }
}

function invalid(): BusinessException {
  return new BusinessException(DOMAIN_ERROR_CODE.BARCODE_INVALID, operatorMessage('barcode.invalid'));
}

export function isBarcodeType(value: string): value is BarcodeType {
  return (Object.values(BARCODE_TYPE) as string[]).includes(value);
}

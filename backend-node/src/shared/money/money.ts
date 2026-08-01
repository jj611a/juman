import { MONEY_MINOR_UNITS_PER_IQD } from '../constants/business.constants';
import { DOMAIN_ERROR_CODE } from '../errors/domain.errors';
import { BusinessException } from '../errors/business.exception';

/** Branded integer fils amount (1000 fils = 1 IQD). Never use floats for money. */
export type Fils = number & { readonly __brand: 'Fils' };

export function assertFils(value: unknown, field = 'amount'): Fils {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isSafeInteger(value)) {
    throw new BusinessException(DOMAIN_ERROR_CODE.MONEY_INVALID, `${field} must be a safe integer (fils)`, {
      details: [String(value)],
    });
  }
  return value as Fils;
}

export function toFils(value: number): Fils {
  return assertFils(value);
}

export function addFils(a: Fils, b: Fils): Fils {
  return assertFils(a + b);
}

export function subtractFils(a: Fils, b: Fils): Fils {
  return assertFils(a - b);
}

export function assertNonNegativeFils(value: Fils, field = 'amount'): Fils {
  if (value < 0) {
    throw new BusinessException(DOMAIN_ERROR_CODE.MONEY_INVALID, `${field} must be non-negative`, {
      details: [String(value)],
    });
  }
  return value;
}

/** Convert major IQD display units to fils using integer math after digit parse. */
export function majorToFils(major: string | number, minorUnits = MONEY_MINOR_UNITS_PER_IQD): Fils {
  if (typeof major === 'number') {
    if (!Number.isFinite(major)) {
      throw new BusinessException(DOMAIN_ERROR_CODE.MONEY_INVALID, 'Invalid major amount');
    }
    return assertFils(Math.round(major * minorUnits));
  }
  const trimmed = major.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.') {
    throw new BusinessException(DOMAIN_ERROR_CODE.MONEY_INVALID, 'Empty major amount');
  }
  const negative = trimmed.startsWith('-');
  const body = negative ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d+)?$/.test(body)) {
    throw new BusinessException(DOMAIN_ERROR_CODE.MONEY_INVALID, 'Invalid major amount format');
  }
  const [wholeRaw, fracRaw = ''] = body.split('.');
  const decimals = String(minorUnits).length - 1;
  const frac = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  const fils = Number(wholeRaw) * minorUnits + Number(frac || '0');
  return assertFils(negative ? -fils : fils);
}

export function filsToMajorString(fils: Fils, minorUnits = MONEY_MINOR_UNITS_PER_IQD): string {
  const decimals = String(minorUnits).length - 1;
  const sign = fils < 0 ? '-' : '';
  const abs = Math.abs(fils);
  const major = Math.floor(abs / minorUnits);
  const frac = abs % minorUnits;
  return `${sign}${major}.${String(frac).padStart(decimals, '0')}`;
}
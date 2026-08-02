import { describe, expect, it } from 'vitest';
import {
  formatPhoneDisplay,
  normalizePhone,
  optionalNormalizePhone,
  phonesMatchNormalized,
} from '../src/shared/phone/phone';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('phone normalize', () => {
  it('normalizes Iraqi local and E.164', () => {
    expect(normalizePhone('07701234567').normalized).toBe('9647701234567');
    expect(normalizePhone('7701234567').normalized).toBe('9647701234567');
    expect(normalizePhone('+964 770 123 4567').normalized).toBe('9647701234567');
    expect(normalizePhone('+9647701234567').display).toContain('964');
    expect(optionalNormalizePhone('')).toBeNull();
    expect(optionalNormalizePhone(null)).toBeNull();
    expect(optionalNormalizePhone(undefined)).toBeNull();
    expect(formatPhoneDisplay('9647701234567')).toBe('+9647701234567');
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay('9647701234567', ' 0770 ')).toBe('0770');
    expect(phonesMatchNormalized('1', '1')).toBe(true);
    expect(() => normalizePhone('123')).toThrow(BusinessException);
    expect(() => normalizePhone('not-a-phone')).toThrow(BusinessException);
    expect(() => normalizePhone('1-2-3-4')).toThrow(BusinessException);
    expect(() => normalizePhone('+1234567890123456')).toThrow(BusinessException);
  });
});

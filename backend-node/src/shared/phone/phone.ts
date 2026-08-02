import { BusinessException } from '../errors/business.exception';

/** Loose display validation (international + local digits / separators). */
export const PHONE_DISPLAY_PATTERN = /^\+?[0-9][0-9\s\-()]{6,20}$/;

export interface NormalizedPhone {
  /** Operator-facing formatting preserved when valid. */
  readonly display: string;
  /** Digits-only (country code included, no +) for search and uniqueness. */
  readonly normalized: string;
}

/**
 * Normalize a phone for storage/search.
 * Preserves display formatting; maps Iraqi local 07XXXXXXXXX → 9647XXXXXXXXX.
 */
export function normalizePhone(raw: string): NormalizedPhone {
  const display = raw.trim().replace(/\s+/g, ' ');
  if (!PHONE_DISPLAY_PATTERN.test(display)) {
    throw BusinessException.validation('Invalid phone number');
  }
  let digits = display.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');
  if (/^07\d{9}$/.test(digits)) {
    digits = `964${digits.slice(1)}`;
  } else if (/^7\d{9}$/.test(digits)) {
    digits = `964${digits}`;
  }
  if (digits.length < 7 || digits.length > 15) {
    throw BusinessException.validation('Invalid phone number length');
  }
  return { display, normalized: digits };
}

export function optionalNormalizePhone(raw: string | null | undefined): NormalizedPhone | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return normalizePhone(trimmed);
}

/** Format normalized digits for display when no preferred display exists. */
export function formatPhoneDisplay(normalized: string, preferred?: string | null): string {
  if (preferred?.trim()) return preferred.trim();
  if (!normalized) return '';
  return `+${normalized}`;
}

export function phonesMatchNormalized(a: string, b: string): boolean {
  return a === b;
}
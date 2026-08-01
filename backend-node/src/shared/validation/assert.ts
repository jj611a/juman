import { BusinessException } from '../errors/business.exception';

export function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw BusinessException.validation(message);
  }
  return value;
}

export function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw BusinessException.validation(`${field} is required`);
  }
  return value.trim();
}

export function assertInRange(
  value: number,
  min: number,
  max: number,
  field: string,
): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw BusinessException.validation(`${field} must be between ${min} and ${max}`);
  }
  return value;
}

export function assertMatch(value: string, pattern: RegExp, message: string): string {
  if (!pattern.test(value)) {
    throw BusinessException.validation(message);
  }
  return value;
}
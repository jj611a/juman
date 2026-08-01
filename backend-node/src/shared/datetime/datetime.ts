import { DEFAULT_TIMEZONE } from '../constants/business.constants';

export function nowUtc(): Date {
  return new Date();
}

export function toIsoUtc(date: Date): string {
  return date.toISOString();
}

export function parseIsoDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return d;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function defaultBusinessTimezone(): string {
  return DEFAULT_TIMEZONE;
}
/**
 * Shared money / finance formatting helpers.
 * Backend currency is IQD (1000 fils = 1 د.ع). All amounts are integer fils.
 * Values are ALWAYS formatted for display only — never recomputed as authority.
 */

/** IQD currency label (backend constant FINANCE_CURRENCY = 'IQD'). */
export const IQD_LABEL = 'د.ع'

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  bank_transfer: 'تحويل',
}

export const PAYMENT_METHOD_VALUES = ['cash', 'card', 'bank_transfer'] as const

export function formatIQD(fils: number | null | undefined): string {
  if (fils === null || fils === undefined || Number.isNaN(fils)) return '—'
  return `${(fils / 1000).toLocaleString('ar-IQ-u-nu-latn', { maximumFractionDigits: 2 })} ${IQD_LABEL}`
}

/** Plain number formatter (no currency label) for compact tables. */
export function formatIQDNumber(fils: number | null | undefined): string {
  if (fils === null || fils === undefined || Number.isNaN(fils)) return '—'
  return (fils / 1000).toLocaleString('ar-IQ-u-nu-latn', { maximumFractionDigits: 2 })
}

/** Convert a display amount (د.ع / IQD) to integer fils for backend payloads. */
export function toFils(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  return Math.round(Number(value) * 1000)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric' })
}

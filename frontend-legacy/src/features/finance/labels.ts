import type { StatusMap } from '@/components/ui'

/** Nest financial transaction types → Arabic (operator-facing). */
export const FINANCE_TX_TYPE_LABELS: Record<string, string> = {
  rental_charge: 'رسوم الإيجار',
  deposit: 'دفعة أولية',
  payment: 'دفعة تحصيل',
  refund: 'استرداد',
  adjustment: 'تعديل',
  discount: 'خصم',
  late_fee: 'غرامة تأخير'
}

export const FINANCE_TX_STATUS_MAP: StatusMap = {
  POSTED: { tone: 'success', label: 'فعّال' },
  PENDING: { tone: 'warning', label: 'معلّق' },
  VOIDED: { tone: 'danger', label: 'ملغى' }
}

export const FINANCE_ACCOUNT_STATUS_MAP: StatusMap = {
  OPEN: { tone: 'success', label: 'مفتوح' },
  CLOSED: { tone: 'neutral', label: 'مغلق' }
}

export const FINANCE_PAYMENT_STATUS_MAP: StatusMap = {
  PENDING: { tone: 'warning', label: 'معلّق' },
  COMPLETED: { tone: 'success', label: 'مكتمل' },
  CANCELLED: { tone: 'danger', label: 'ملغى' },
  FAILED: { tone: 'danger', label: 'فشل' }
}

export const FINANCE_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً',
  card: 'بطاقة',
  transfer: 'تحويل',
  CASH: 'نقداً',
  CARD: 'بطاقة',
  TRANSFER: 'تحويل'
}

/** Normalize Nest lowercase / mixed status for StatusMap keys. */
export function financeStatusKey(status: string | null | undefined): string {
  return String(status ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
}

export function financeTxTypeLabel(type: string | null | undefined): string {
  const key = String(type ?? '')
    .trim()
    .toLowerCase()
  return FINANCE_TX_TYPE_LABELS[key] ?? (type || 'معاملة')
}

/**
 * Localize Nest English descriptions when possible.
 * Examples: "Rental charge RENT-…" → "رسوم إيجار RENT-…"
 */
export function financeTxDescription(
  description: string | null | undefined,
  type?: string | null
): string {
  const raw = (description ?? '').trim()
  if (!raw) return '—'

  const charge = /^Rental charge\s+(.+)$/i.exec(raw)
  if (charge) return `رسوم إيجار ${charge[1]}`

  const deposit = /^Rental deposit\s+(.+)$/i.exec(raw)
  if (deposit) return `دفعة أولية ${deposit[1]}`

  if (/^rental_charge$/i.test(raw)) return financeTxTypeLabel('rental_charge')
  if (/^deposit$/i.test(raw)) return financeTxTypeLabel('deposit')

  // Already Arabic or custom
  if (/[\u0600-\u06FF]/.test(raw)) return raw

  return raw || financeTxTypeLabel(type)
}

import type { StatusMap } from '@/components/ui'

export const SETTLEMENT_STATUS_MAP: StatusMap = {
  OPEN: { tone: 'warning', label: 'مفتوحة' },
  PARTIALLY_PAID: { tone: 'info', label: 'مدفوعة جزئياً' },
  PAID: { tone: 'success', label: 'مدفوعة' },
  VOIDED: { tone: 'neutral', label: 'ملغاة' }
}

import type { StatusMap } from '@/components/ui'

export const SALE_STATUS_MAP: StatusMap = {
  COMPLETED: { tone: 'success', label: 'مكتمل' },
  VOIDED: { tone: 'danger', label: 'ملغى' }
}

export const SALE_ORIGIN_MAP: StatusMap = {
  NORMAL_SALE: { tone: 'info', label: 'بيع عادي' },
  MANDATORY_DAMAGE_PURCHASE: { tone: 'warning', label: 'شراء ضرر إلزامي' }
}

export const SALE_PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقد',
  CARD: 'بطاقة',
  BANK_TRANSFER: 'تحويل بنكي',
  OTHER: 'أخرى'
}

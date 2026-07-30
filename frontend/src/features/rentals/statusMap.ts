import type { StatusMap } from '@/components/ui'

export const RENTAL_STATUS_MAP: StatusMap = {
  DRAFT: { tone: 'neutral', label: 'مسودة' },
  ACTIVE: { tone: 'success', label: 'نشط' },
  RETURN_PENDING: { tone: 'warning', label: 'بانتظار الإرجاع' },
  COMPLETED: { tone: 'info', label: 'مكتمل' },
  CANCELLED: { tone: 'danger', label: 'ملغى' }
}

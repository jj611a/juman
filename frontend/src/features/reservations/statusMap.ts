import type { StatusMap } from '@/components/ui'

export const RESERVATION_STATUS_MAP: StatusMap = {
  DRAFT: { tone: 'neutral', label: 'مسودة' },
  CONFIRMED: { tone: 'success', label: 'مؤكد' },
  CANCELLED: { tone: 'danger', label: 'ملغى' },
  EXPIRED: { tone: 'warning', label: 'منتهٍ' },
  CONVERTED_TO_RENTAL: { tone: 'info', label: 'محوّل لتأجير' }
}

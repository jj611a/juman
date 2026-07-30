import type { StatusMap } from '@/components/ui'

export const INSPECTION_STATUS_MAP: StatusMap = {
  PENDING: { tone: 'warning', label: 'قيد الفحص' },
  COMPLETED: { tone: 'success', label: 'مكتمل' }
}

export const PROCESSING_STATUS_MAP: StatusMap = {
  PENDING: { tone: 'warning', label: 'بانتظار البدء' },
  IN_PROCESS: { tone: 'info', label: 'قيد المعالجة' },
  COMPLETED: { tone: 'success', label: 'جاهز' },
  CANCELLED: { tone: 'danger', label: 'ملغى' }
}

export const DRESS_CONDITION_MAP: StatusMap = {
  GOOD: { tone: 'success', label: 'سليم' },
  MINOR_DAMAGE: { tone: 'warning', label: 'ضرر بسيط' },
  MAJOR_DAMAGE: { tone: 'danger', label: 'ضرر كبير' }
}

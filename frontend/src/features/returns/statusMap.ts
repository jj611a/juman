import type { StatusMap } from '@/components/ui'

export const RETURN_STATUS_MAP: StatusMap = {
  PENDING_INSPECTION: { tone: 'warning', label: 'بانتظار الفحص' },
  INSPECTION_COMPLETED: { tone: 'info', label: 'اكتمل الفحص' },
  COMPLETED: { tone: 'success', label: 'مكتمل' }
}
import type { SaleDto } from '@/features/pos/api/salesApi'
import { formatIQD, formatDateTime } from '@/shared/utils/money'

export const SALE_STATUS_LABELS: Record<SaleDto['status'], string> = {
  draft: 'مسودة',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

export const SALE_STATUS_BADGE: Record<SaleDto['status'], string> = {
  draft: 'badge-ghost',
  confirmed: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-error',
}

export function formatFils(fils: number | null | undefined): string {
  return formatIQD(fils)
}

export { formatDateTime }
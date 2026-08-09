import { formatIQD, formatDateTime } from '@/shared/utils/money'

export function formatFils(fils: number | null | undefined): string {
  return formatIQD(fils)
}

export { formatDateTime }

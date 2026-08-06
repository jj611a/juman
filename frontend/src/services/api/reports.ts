import { apiInvoke } from '@/ipc/api'

export interface DashboardSummaryDto {
  activeRentals: number
  todaysCheckouts: number
  todaysReturns: number
  openSettlements: number
  outstandingBalanceFils: number
  revenueTodayFils: number
  revenueThisMonthFils: number
  inventoryCount: number
  reservedItems: number
  availableItems: number
  asOf: string
}

export function fetchDashboardSummary(): Promise<DashboardSummaryDto> {
  return apiInvoke({ method: 'GET', path: '/reports/dashboard' })
}

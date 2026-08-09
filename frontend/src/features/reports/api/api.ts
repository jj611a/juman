import { apiInvoke } from '@/ipc/api'

export interface FinancialReportDto {
  revenueFils: number
  paymentsCount: number
  outstandingFils: number
  openSettlementsCount: number
  refundsFils: number
  refundsCount: number
  discountsFils: number
  discountsCount: number
  lateFeesFils: number
  lateFeesCount: number
  adjustmentsFils: number
  adjustmentsCount: number
  depositsFils: number
  depositsCount: number
  chargesFils: number
  chargesCount: number
}

export interface InventoryValueDto {
  itemCount: number
  rentalPriceSumFils: number
  purchasePriceSumFils: number
  salePriceSumFils: number
}

export interface InventoryAvailabilityRow {
  lifecycleState: string
  count: number
}

export interface TaxonomyGroupRow {
  label: string
  count: number
  rentalPriceSumFils: number
}

export interface PaginatedReport<T> {
  items: T[]
  meta: { total: number; offset: number; limit: number }
}

export const REPORT_KINDS = [
  'dashboard',
  'financial',
  'rentals.current',
  'rentals.overdue',
  'rentals.returns',
  'rentals.reservations',
  'rentals.history',
  'inventory.value',
  'inventory.availability',
  'inventory.category',
  'inventory.brand',
  'inventory.color',
  'inventory.size',
  'inventory.lifecycle',
  'inventory.retired',
  'inventory.maintenance',
] as const

export type ReportKind = (typeof REPORT_KINDS)[number]

export interface ReportQuery {
  from?: string
  to?: string
  status?: string
  offset?: number
  limit?: number
}

export interface RentalReportRow {
  id: string
  rentalNumber: string
  customer?: { id: string; fullName: string; phone: string } | null
  rentalDate: string
  expectedReturnDate: string
  actualReturnDate?: string | null
  status: string
  totalFils?: number
}

export interface CustomerReportRow {
  id: string
  customerNumber: string
  fullName: string
  phone: string
  status: string
  createdAt: string
}

/**
 * Reports API — REAL Nest endpoints only. Backend exposes NO sales
 * aggregation report (documented gap). CSV/JSON export is implemented in Nest;
 * PDF/Excel adapters throw (unsupported) — the UI reflects that.
 */
export const reportsApi = {
  financial(query?: { from?: string; to?: string }): Promise<FinancialReportDto> {
    return apiInvoke({ method: 'GET', path: '/reports/financial', query: query as Record<string, unknown> | undefined })
  },

  inventoryValue(): Promise<InventoryValueDto> {
    return apiInvoke({ method: 'GET', path: '/reports/inventory/value' })
  },

  inventoryAvailability(): Promise<InventoryAvailabilityRow[]> {
    return apiInvoke({ method: 'GET', path: '/reports/inventory/availability' })
  },

  inventoryGroupBy(kind: 'category' | 'brand' | 'color' | 'size'): Promise<TaxonomyGroupRow[]> {
    return apiInvoke({ method: 'GET', path: `/reports/inventory/${kind}` })
  },

  rentalsCurrent(query?: ReportQuery): Promise<PaginatedReport<RentalReportRow>> {
    return apiInvoke({ method: 'GET', path: '/reports/rentals/current', query: query as Record<string, unknown> | undefined })
  },

  rentalsOverdue(query?: ReportQuery): Promise<PaginatedReport<RentalReportRow>> {
    return apiInvoke({ method: 'GET', path: '/reports/rentals/overdue', query: query as Record<string, unknown> | undefined })
  },

  rentalsReturns(query?: ReportQuery): Promise<PaginatedReport<RentalReportRow>> {
    return apiInvoke({ method: 'GET', path: '/reports/rentals/returns', query: query as Record<string, unknown> | undefined })
  },

  rentalsReservations(query?: ReportQuery): Promise<PaginatedReport<RentalReportRow>> {
    return apiInvoke({ method: 'GET', path: '/reports/rentals/reservations', query: query as Record<string, unknown> | undefined })
  },

  inventoryRetired(query?: ReportQuery): Promise<PaginatedReport<RentalReportRow>> {
    return apiInvoke({ method: 'GET', path: '/reports/inventory/retired', query: query as Record<string, unknown> | undefined })
  },

  inventoryMaintenance(query?: ReportQuery): Promise<PaginatedReport<RentalReportRow>> {
    return apiInvoke({ method: 'GET', path: '/reports/inventory/maintenance', query: query as Record<string, unknown> | undefined })
  },
}

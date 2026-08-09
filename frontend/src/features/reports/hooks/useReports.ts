import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/api'

export const reportKeys = {
  all: ['reports'] as const,
  financial: (q?: { from?: string; to?: string }) => ['reports', 'financial', q ?? {}] as const,
  inventoryValue: ['reports', 'inventory', 'value'] as const,
  inventoryAvailability: ['reports', 'inventory', 'availability'] as const,
  inventoryGroup: (kind: string) => ['reports', 'inventory', kind] as const,
  rentals: (name: string, q?: Record<string, unknown>) => ['reports', 'rentals', name, q ?? {}] as const,
}

export function useFinancialReport(query?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: reportKeys.financial(query),
    queryFn: () => reportsApi.financial(query),
  })
}

export function useInventoryValueReport() {
  return useQuery({
    queryKey: reportKeys.inventoryValue,
    queryFn: () => reportsApi.inventoryValue(),
  })
}

export function useInventoryAvailabilityReport() {
  return useQuery({
    queryKey: reportKeys.inventoryAvailability,
    queryFn: () => reportsApi.inventoryAvailability(),
  })
}

export function useInventoryGroupReport(kind: 'category' | 'brand' | 'color' | 'size') {
  return useQuery({
    queryKey: reportKeys.inventoryGroup(kind),
    queryFn: () => reportsApi.inventoryGroupBy(kind),
  })
}

export function useRentalsReport(name: 'current' | 'overdue' | 'returns' | 'reservations', query?: { limit?: number }) {
  const fn = {
    current: reportsApi.rentalsCurrent,
    overdue: reportsApi.rentalsOverdue,
    returns: reportsApi.rentalsReturns,
    reservations: reportsApi.rentalsReservations,
  }[name]
  return useQuery({
    queryKey: reportKeys.rentals(name, query ?? {}),
    queryFn: () => fn(query),
  })
}

import { apiClient } from '@/services/apiClient'
import type {
  CustomersTopParams,
  NeverRentedListParams,
  ReportDateRangeParams,
  RentalsDetailsParams,
  SalesDetailsParams
} from '@/services/domainTypes'

export const reportKeys = {
  all: ['reports'] as const,
  dashboard: () => [...reportKeys.all, 'dashboard'] as const,
  inventorySummary: () => [...reportKeys.all, 'inventory', 'summary'] as const,
  neverRented: (params: NeverRentedListParams) =>
    [...reportKeys.all, 'inventory', 'never-rented', params] as const,
  rentalsSummary: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'rentals', 'summary', params] as const,
  rentalsDetails: (params: RentalsDetailsParams) =>
    [...reportKeys.all, 'rentals', 'details', params] as const,
  reservationsSummary: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'reservations', 'summary', params] as const,
  customersSummary: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'customers', 'summary', params] as const,
  customersTop: (params: CustomersTopParams) =>
    [...reportKeys.all, 'customers', 'top', params] as const,
  inspectionsSummary: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'inspections', 'summary', params] as const,
  processingSummary: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'processing', 'summary', params] as const,
  salesSummary: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'sales', 'summary', params] as const,
  salesDetails: (params: SalesDetailsParams) =>
    [...reportKeys.all, 'sales', 'details', params] as const,
  financialSummary: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'financial', 'summary', params] as const,
  financialDaily: (params: ReportDateRangeParams) =>
    [...reportKeys.all, 'financial', 'daily', params] as const
}

export const reportsApi = {
  dashboard: () => apiClient.reports.dashboard(),
  inventorySummary: () => apiClient.reports.inventorySummary(),
  neverRented: (params?: NeverRentedListParams) => apiClient.reports.inventoryNeverRented(params),
  rentalsSummary: (params: ReportDateRangeParams) => apiClient.reports.rentalsSummary(params),
  rentalsDetails: (params: RentalsDetailsParams) => apiClient.reports.rentalsDetails(params),
  reservationsSummary: (params: ReportDateRangeParams) => apiClient.reports.reservationsSummary(params),
  customersSummary: (params: ReportDateRangeParams) => apiClient.reports.customersSummary(params),
  customersTop: (params?: CustomersTopParams) => apiClient.reports.customersTop(params),
  inspectionsSummary: (params: ReportDateRangeParams) => apiClient.reports.inspectionsSummary(params),
  processingSummary: (params: ReportDateRangeParams) => apiClient.reports.processingSummary(params),
  salesSummary: (params: ReportDateRangeParams) => apiClient.reports.salesSummary(params),
  salesDetails: (params: SalesDetailsParams) => apiClient.reports.salesDetails(params),
  financialSummary: (params: ReportDateRangeParams) => apiClient.reports.financialSummary(params),
  financialDaily: (params: ReportDateRangeParams) => apiClient.reports.financialDaily(params)
}

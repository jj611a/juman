import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
  CustomersTopParams,
  NeverRentedListParams,
  ReportDateRangeParams,
  RentalsDetailsParams,
  SalesDetailsParams
} from '@/services/domainTypes'
import { reportKeys, reportsApi } from './api'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Inclusive UI date → `YYYY-MM-DD`. */
export function toReportDateParam(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseReportDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : startOfDay(d)
}

/** Default inclusive range: last 30 calendar days ending today. */
export function defaultReportDateRange(): { from: Date; to: Date } {
  const to = startOfDay(new Date())
  const from = addDays(to, -29)
  return { from, to }
}

/** Backend half-open `[date_from, date_to)` from inclusive UI pickers. */
export function toReportQueryRange(fromInclusive: Date, toInclusive: Date): ReportDateRangeParams {
  return {
    date_from: toReportDateParam(fromInclusive),
    date_to: toReportDateParam(addDays(toInclusive, 1))
  }
}

export function useReportDateRange(initial?: { from: Date; to: Date }) {
  const defaults = React.useMemo(() => defaultReportDateRange(), [])
  const [from, setFrom] = React.useState<Date>(initial?.from ?? defaults.from)
  const [to, setTo] = React.useState<Date>(initial?.to ?? defaults.to)
  const params = React.useMemo(() => toReportQueryRange(from, to), [from, to])
  const isValid = from.getTime() <= to.getTime()
  return { from, to, setFrom, setTo, params, isValid }
}

export function useDashboardReport(enabled = true) {
  return useQuery({
    queryKey: reportKeys.dashboard(),
    queryFn: () => reportsApi.dashboard(),
    enabled
  })
}

export function useInventorySummaryReport(enabled = true) {
  return useQuery({
    queryKey: reportKeys.inventorySummary(),
    queryFn: () => reportsApi.inventorySummary(),
    enabled
  })
}

export function useNeverRentedReport(params: NeverRentedListParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.neverRented(params),
    queryFn: () => reportsApi.neverRented(params),
    enabled
  })
}

export function useRentalsSummaryReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.rentalsSummary(params),
    queryFn: () => reportsApi.rentalsSummary(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useRentalsDetailsReport(params: RentalsDetailsParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.rentalsDetails(params),
    queryFn: () => reportsApi.rentalsDetails(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useReservationsSummaryReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.reservationsSummary(params),
    queryFn: () => reportsApi.reservationsSummary(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useCustomersSummaryReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.customersSummary(params),
    queryFn: () => reportsApi.customersSummary(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useCustomersTopReport(params: CustomersTopParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.customersTop(params),
    queryFn: () => reportsApi.customersTop(params),
    enabled
  })
}

export function useInspectionsSummaryReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.inspectionsSummary(params),
    queryFn: () => reportsApi.inspectionsSummary(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useProcessingSummaryReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.processingSummary(params),
    queryFn: () => reportsApi.processingSummary(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useSalesSummaryReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.salesSummary(params),
    queryFn: () => reportsApi.salesSummary(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useSalesDetailsReport(params: SalesDetailsParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.salesDetails(params),
    queryFn: () => reportsApi.salesDetails(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useFinancialSummaryReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.financialSummary(params),
    queryFn: () => reportsApi.financialSummary(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

export function useFinancialDailyReport(params: ReportDateRangeParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.financialDaily(params),
    queryFn: () => reportsApi.financialDaily(params),
    enabled: enabled && Boolean(params.date_from && params.date_to)
  })
}

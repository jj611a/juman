/** Extracted Settlement* + Report* DTOs from domainTypes.ts (no apiClient). */

export type SettlementStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED'

export type SettlementPaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'

export type SettlementSortField =
  | 'settlement_number'
  | 'status'
  | 'created_at'
  | 'settled_at'

export interface SettlementChargeDto {
  id: string
  settlement_id: string
  charge_type: string
  amount: number
  rental_item_id: string | null
  inspection_item_id: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface SettlementPaymentDto {
  id: string
  settlement_id: string
  amount: number
  payment_method: string
  received_at: string
  received_by: string | null
  reference_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SettlementAdjustmentDto {
  id: string
  settlement_id: string
  amount: number
  reason: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface SettlementDto {
  id: string
  settlement_number: string
  rental_id: string
  return_id: string
  status: SettlementStatus
  rental_charge_amount: number
  initial_payment_credit: number
  late_penalty_amount: number
  minor_damage_penalty_amount: number
  manual_adjustment_amount: number
  gross_total: number
  total_due: number
  total_paid: number
  remaining_balance: number
  settled_at: string | null
  settled_by: string | null
  notes: string | null
  charges: SettlementChargeDto[]
  payments: SettlementPaymentDto[]
  adjustments: SettlementAdjustmentDto[]
  created_at: string
  updated_at: string
}

export interface SettlementListParams {
  offset?: number
  limit?: number
  status?: string
  rental_id?: string
  sort_by?: SettlementSortField
  sort_dir?: 'asc' | 'desc'
}

export interface SettlementCreateBody {
  rental_id: string
  notes?: string | null
}

export interface SettlementPaymentCreateBody {
  amount: number
  payment_method: SettlementPaymentMethod
  reference_number?: string | null
  notes?: string | null
  received_at?: string | null
}

export interface SettlementAdjustmentCreateBody {
  amount: number
  reason: string
}

// --- Reports (raw DTOs — no envelope) ---

export interface PaginationMeta {
  offset: number
  limit: number
  total: number
}

export interface CountByKeyDto {
  key: string
  count: number
}

export type CustomerTopMetric = 'rental_count' | 'rental_gross' | 'sale_value'
export type NeverRentedSortField = 'created_at' | 'barcode' | 'name_ar'
export type RentalDetailSortField = 'rental_at' | 'rental_number' | 'status' | 'created_at'
export type SaleDetailSortField = 'sold_at' | 'sale_number' | 'total_amount' | 'created_at'

export interface DashboardReportDto {
  timezone: string
  as_of: string
  today_from: string
  today_to: string
  dresses_total: number
  dresses_active: number
  dresses_by_status: Record<string, number>
  rentals_active: number
  rentals_due_today: number
  rentals_overdue: number
  reservations_today: number
  reservations_upcoming: number
  processing_batches_in_process: number
  dresses_in_processing: number
}

export interface InventorySummaryReportDto {
  dresses_total: number
  dresses_by_status: Record<string, number>
  by_category: CountByKeyDto[]
  by_size: CountByKeyDto[]
  by_colour: CountByKeyDto[]
  by_brand: CountByKeyDto[]
}

export interface NeverRentedDressRowDto {
  id: string
  barcode: string
  name_ar: string
  category_id: string
  size: string
  colour: string
  brand: string | null
  status: string
  created_at: string
}

export interface NeverRentedListResponseDto {
  items: NeverRentedDressRowDto[]
  meta: PaginationMeta
}

export interface NeverRentedListParams {
  offset?: number
  limit?: number
  sort_by?: NeverRentedSortField
  sort_dir?: 'asc' | 'desc'
}

export interface MostRentedRowDto {
  dress_id: string
  barcode: string
  name_ar: string
  rental_count: number
}

export interface RentalsSummaryReportDto {
  date_from: string
  date_to: string
  created_in_range_by_status: Record<string, number>
  created_in_range_total: number
  active_now: number
  overdue_now: number
  completed_settled_in_range: number
  most_rented: MostRentedRowDto[]
}

export interface RentalDetailRowDto {
  id: string
  rental_number: string
  customer_id: string
  status: string
  rental_at: string
  expected_return_at: string
  estimated_total: number
  duration_seconds?: number | null
}

export interface RentalsDetailsResponseDto {
  items: RentalDetailRowDto[]
  meta: PaginationMeta
}

export interface RentalsDetailsParams {
  date_from: string
  date_to: string
  status?: string
  offset?: number
  limit?: number
  sort_by?: RentalDetailSortField
  sort_dir?: 'asc' | 'desc'
}

export interface ReportDateRangeParams {
  date_from: string
  date_to: string
}

export interface ReservationsSummaryReportDto {
  date_from: string
  date_to: string
  created_in_range_by_status: Record<string, number>
  created_in_range_total: number
  upcoming_confirmed: number
  by_customer: Array<{
    customer_id: string
    customer_number: string
    full_name: string
    count: number
  }>
  by_cashier: Array<{ cashier_id: string; count: number }>
}

export interface CustomersSummaryReportDto {
  date_from: string
  date_to: string
  total_customers: number
  new_in_range: number
  with_active_rentals: number
  with_overdue_rentals: number
}

export interface CustomerTopRowDto {
  id: string
  customer_number: string
  full_name: string
  metric: string
  value: number
}

export interface CustomersTopResponseDto {
  items: CustomerTopRowDto[]
}

export interface CustomersTopParams {
  metric?: CustomerTopMetric
  limit?: number
}

export interface InspectionsSummaryReportDto {
  date_from: string
  date_to: string
  inspections_completed: number
  items_by_condition: Record<string, number>
  minor_repair_penalties_total: number
  damage_by_dress: Array<{ dress_id: string; count: number }>
  damage_by_customer: Array<{ customer_id: string; count: number }>
  repeated_damage_dresses: Array<{ dress_id: string; count: number }>
}

export interface ProcessingSummaryReportDto {
  date_from: string
  date_to: string
  batches_in_process: number
  dresses_in_processing: number
  started_in_range: number
  completed_in_range: number
  optional_extra_day_count: number
  avg_duration_seconds: number | null
  long_running_batches: number
}

export interface SalesSummaryReportDto {
  date_from: string
  date_to: string
  sales_count: number
  sale_revenue: number
  sale_revenue_normal: number
  sale_revenue_mandatory: number
  average_sale_value: number | null
  override_line_count: number
  by_cashier: Array<{ cashier_id: string; count: number; total_amount: number }>
  by_category: Array<{ category: string; count: number; total_amount: number }>
}

export interface SaleDetailRowDto {
  id: string
  sale_number: string
  origin: string
  status: string
  customer_id: string | null
  total_amount: number
  sold_at: string
  sold_by: string | null
}

export interface SalesDetailsResponseDto {
  items: SaleDetailRowDto[]
  meta: PaginationMeta
}

export interface SalesDetailsParams extends ReportDateRangeParams {
  origin?: string
  offset?: number
  limit?: number
  sort_by?: SaleDetailSortField
  sort_dir?: 'asc' | 'desc'
}

export interface FinancialSummaryReportDto {
  date_from: string
  date_to: string
  rental_charges_gross: number
  rental_charges_rental: number
  rental_charges_late: number
  rental_charges_minor_damage: number
  rental_adjustments: number
  rental_initial_credits: number
  rental_payments_collected: number
  rental_outstanding: number
  sale_revenue: number
  sale_revenue_normal: number
  sale_revenue_mandatory: number
  sale_payments_collected: number
  total_cash_collected: number
  total_charged: number
}

export interface FinancialDailyRowDto {
  day: string
  rental_charges_gross: number
  rental_payments_collected: number
  sale_revenue: number
  sale_payments_collected: number
  total_cash_collected: number
  total_charged: number
}

export interface FinancialDailyReportDto {
  date_from: string
  date_to: string
  timezone: string
  days: FinancialDailyRowDto[]
}

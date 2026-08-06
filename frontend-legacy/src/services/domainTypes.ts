/** Shared domain DTO shapes used by apiClient feature helpers. */

export interface PaginationMeta {
  offset: number
  limit: number
  total: number
}

export interface CategoryDto {
  id: string
  name_ar: string
  name_en: string | null
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CategoryCreateBody {
  name_ar: string
  name_en?: string | null
  description?: string | null
  display_order?: number
  is_active?: boolean
}

export interface CategoryUpdateBody {
  name_ar?: string | null
  name_en?: string | null
  description?: string | null
  display_order?: number | null
  is_active?: boolean | null
}

export interface CategoryListParams {
  q?: string
  active_only?: boolean
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

/** Brands/sizes share category-like legacy shape (name_ar ← Nest `name`). */
export type BrandDto = CategoryDto
export type BrandCreateBody = CategoryCreateBody
export type BrandUpdateBody = CategoryUpdateBody
export type BrandListParams = CategoryListParams

export type SizeDto = CategoryDto
export type SizeCreateBody = CategoryCreateBody
export type SizeUpdateBody = CategoryUpdateBody
export type SizeListParams = CategoryListParams

export interface ColorDto {
  id: string
  name_ar: string
  name_en: string | null
  hex_code: string | null
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ColorCreateBody {
  name_ar: string
  name_en?: string | null
  hex_code?: string | null
  description?: string | null
  display_order?: number
  is_active?: boolean
}

export interface ColorUpdateBody {
  name_ar?: string | null
  name_en?: string | null
  hex_code?: string | null
  description?: string | null
  display_order?: number | null
  is_active?: boolean | null
}

export type ColorListParams = CategoryListParams

export interface FinanceAccountDto {
  id: string
  accountNumber: string
  customerId: string
  customer: {
    id: string
    customerNumber: string
    fullName: string
    status: string
  } | null
  currency: string
  status: string
  notes: string | null
  outstandingFils: number | null
  outstandingMajor: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface FinanceTransactionDto {
  id: string
  accountId: string
  type: string
  amountFils: number
  amountMajor: string
  status: string
  referenceType: string | null
  referenceId: string | null
  description: string | null
  outstandingDeltaFils: number
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

export interface FinancePaymentDto {
  id: string
  paymentNumber: string
  accountId: string
  transactionId: string | null
  amountFils: number
  amountMajor: string
  status: string
  method: string | null
  notes: string | null
  completedAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

export interface FinanceOutstandingDto {
  accountId: string
  accountNumber: string
  customerId: string
  currency: string
  outstandingFils: number
  outstandingMajor: string
  balanceSource: string
}

export interface FinanceListParams {
  q?: string
  customerId?: string
  accountId?: string
  status?: string
  type?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface BarcodeDto {
  id: string
  value: string
  type: string
  prefix: string
  status: string
  entityType: string | null
  entityId: string | null
  reservedAt: string | null
  activatedAt: string | null
  retiredAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

export interface BarcodeListParams {
  q?: string
  prefix?: string
  status?: string
  type?: string
  entityType?: string
  entityId?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface BarcodeGenerateBody {
  type?: string
  prefix?: string
  separator?: string
  padding?: number
}

export interface BarcodeReserveBody extends BarcodeGenerateBody {
  value?: string
}

export interface BarcodeValidateBody {
  value: string
  type?: string
}

export interface BarcodeValueBody {
  value: string
}

export interface BarcodeValidateResult {
  ok?: boolean
  valid?: boolean
  value?: string
  type?: string
  reason?: string
  [key: string]: unknown
}

export interface CustomerDto {
  id: string
  customer_number: string
  full_name: string
  phone: string
  alternative_phone: string | null
  address: string | null
  national_id: string | null
  notes: string | null
  gender: string | null
  birth_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CustomerCreateBody {
  full_name: string
  phone: string
  alternative_phone?: string | null
  address?: string | null
  national_id?: string | null
  notes?: string | null
  gender?: string | null
  birth_date?: string | null
  is_active?: boolean
}

export interface CustomerUpdateBody {
  full_name?: string | null
  phone?: string | null
  alternative_phone?: string | null
  address?: string | null
  national_id?: string | null
  notes?: string | null
  gender?: string | null
  birth_date?: string | null
  clear_birth_date?: boolean
  is_active?: boolean | null
}

export interface CustomerListParams {
  q?: string
  active_only?: boolean
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface StoredFileDto {
  id: string
  original_filename: string
  stored_filename: string
  extension: string
  mime_type: string
  size_bytes: number
  sha256_hash: string
  storage_provider: string
  relative_path: string
  is_public: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface FileReferenceDto {
  id: string
  stored_file_id: string
  module_name: string
  entity_type: string
  entity_id: string
  purpose: string
  display_order: number
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface FileReferenceCreateBody {
  stored_file_id: string
  module_name: string
  entity_type: string
  entity_id: string
  purpose: string
  display_order?: number
  is_primary?: boolean
}

export interface FileReferenceListParams {
  module_name?: string
  entity_type?: string
  entity_id?: string
  purpose?: string
  stored_file_id?: string
  offset?: number
  limit?: number
}

export interface AuditLogDto {
  id: string
  module: string
  entity_type: string
  entity_id: string | null
  action: string
  old_values: unknown
  new_values: unknown
  user_id: string | null
  username: string | null
  ip_address: string | null
  metadata: unknown
  message: string | null
  created_at: string
}

export interface AuditLogListParams {
  module?: string
  entity_type?: string
  entity_id?: string
  action?: string
  user_id?: string
  username?: string
  q?: string
  offset?: number
  limit?: number
}

export interface ListEnvelope<T> {
  success: boolean
  data: T[]
  meta: PaginationMeta
}

export interface ItemEnvelope<T> {
  success: boolean
  data: T
}

export interface MessageEnvelope {
  success: boolean
  message: string
}


export type ReservationStatusCode =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'CONVERTED_TO_RENTAL'

export interface ReservationItemDto {
  id: string
  reservation_id: string
  dress_id: string
  reserved_daily_rental_price: number
  notes: string | null
  calendar_block_id: string | null
  created_at: string
  updated_at: string
}

export interface PagePaginationMeta {
  page: number
  page_size: number
  total: number
  pages: number
}

export type DressStatusCode =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTED'
  | 'RETURNED'
  | 'INSPECTION'
  | 'PROCESSING'
  | 'SOLD'
  | 'RUINED'
  | 'RUINED_PENDING_SALE'

export interface DressDto {
  id: string
  barcode: string
  category_id: string
  name_ar: string
  name_en: string | null
  brand: string | null
  brand_id: string | null
  size: string
  size_id: string | null
  colour: string
  color_id: string | null
  purchase_price: number
  default_daily_rental_price: number
  default_sale_price: number
  description: string | null
  purchase_date: string | null
  status: DressStatusCode | string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DressCreateBody {
  category_id: string
  name_ar: string
  name_en?: string | null
  brand?: string | null
  brand_id?: string | null
  size?: string
  size_id?: string | null
  colour?: string
  color_id?: string | null
  purchase_price: number
  default_daily_rental_price: number
  default_sale_price: number
  description?: string | null
  purchase_date?: string | null
  barcode?: string | null
  is_active?: boolean
}

export interface DressUpdateBody {
  category_id?: string | null
  name_ar?: string | null
  name_en?: string | null
  brand?: string | null
  brand_id?: string | null
  size?: string | null
  size_id?: string | null
  colour?: string | null
  color_id?: string | null
  purchase_price?: number | null
  default_daily_rental_price?: number | null
  default_sale_price?: number | null
  description?: string | null
  purchase_date?: string | null
  clear_purchase_date?: boolean
  is_active?: boolean | null
}

export interface DressListParams {
  page?: number
  page_size?: number
  q?: string
  barcode?: string
  category_id?: string
  status?: string
  brand?: string
  size?: string
  colour?: string
  is_active?: boolean
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface DressStatusChangeBody {
  new_status: string
  reason?: string | null
}

export interface DressBarcodeUpdateBody {
  barcode?: string | null
}

export interface DressPhotoFileMeta {
  id: string
  original_filename: string
  mime_type: string
  size_bytes: number
}

export interface DressPhotoDto {
  id: string
  dress_id: string
  stored_file_id: string
  display_order: number
  is_cover: boolean
  caption: string | null
  file: DressPhotoFileMeta | null
  created_at: string
  updated_at: string
}

export interface DressPhotoCreateBody {
  stored_file_id: string
  caption?: string | null
  is_cover?: boolean
  display_order?: number | null
}

export interface PageListEnvelope<T> {
  success: boolean
  data: T[]
  meta: PagePaginationMeta
}

export type CalendarBlockType = 'RESERVATION' | 'RENTAL' | 'PROCESSING' | 'MAINTENANCE'

export interface CalendarBlockDto {
  id: string
  dress_id: string
  block_type: CalendarBlockType | string
  reference_module: string | null
  reference_id: string | null
  start_at: string
  end_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CalendarBlockCreateBody {
  dress_id: string
  block_type: string
  start_at: string
  end_at: string
  reference_module?: string | null
  reference_id?: string | null
  notes?: string | null
}

export interface CalendarBlockUpdateBody {
  start_at?: string | null
  end_at?: string | null
  block_type?: string | null
  notes?: string | null
  clear_notes?: boolean
}

export interface CalendarAvailabilityDto {
  dress_id: string
  start_at: string
  end_at: string
  available: boolean
}

export interface CalendarConflictItemDto {
  block_id: string
  block_type: string
  start_at: string
  end_at: string
  reference_module: string | null
  reference_id: string | null
  conflict_kind: string
}

export interface CalendarConflictsDto {
  dress_id: string
  start_at: string
  end_at: string
  conflicts: CalendarConflictItemDto[]
}

export interface ReservationDto {
  id: string
  reservation_number: string
  customer_id: string
  reservation_at: string
  rental_start_at: string
  expected_return_at: string
  status: ReservationStatusCode | string
  notes: string | null
  /** Linked rental after Nest reservation checkout (if any). */
  rental_id?: string | null
  items: ReservationItemDto[]
  created_at: string
  updated_at: string
}

export interface ReservationItemInput {
  dress_id: string
  reserved_daily_rental_price?: number | null
  notes?: string | null
}

export interface ReservationCreateBody {
  customer_id: string
  rental_start_at: string
  expected_return_at: string
  reservation_at?: string | null
  notes?: string | null
  items: ReservationItemInput[]
}

export interface ReservationUpdateBody {
  customer_id?: string | null
  reservation_at?: string | null
  rental_start_at?: string | null
  expected_return_at?: string | null
  notes?: string | null
  clear_notes?: boolean
  items?: ReservationItemInput[] | null
}

export interface ReservationListParams {
  offset?: number
  limit?: number
  status?: string
  customer_id?: string
  rental_from?: string
  rental_to?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type RentalStatusCode =
  | 'DRAFT'
  | 'ACTIVE'
  | 'RETURN_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'

export type InitialPaymentTypeCode = 'FIXED_AMOUNT' | 'PERCENTAGE'

export interface RentalItemDto {
  id: string
  rental_id: string
  dress_id: string
  agreed_daily_rental_price: number
  expected_rental_days: number
  notes: string | null
  calendar_block_id: string | null
  created_at: string
  updated_at: string
}

export interface RentalDto {
  id: string
  rental_number: string
  customer_id: string
  reservation_id: string | null
  rental_at: string
  expected_return_at: string
  status: RentalStatusCode | string
  initial_payment_type: InitialPaymentTypeCode | string
  initial_payment_rate: number | null
  initial_payment_value: number
  estimated_total: number
  remaining_balance: number
  notes: string | null
  items: RentalItemDto[]
  created_at: string
  updated_at: string
}

export interface RentalItemInput {
  dress_id: string
  agreed_daily_rental_price?: number | null
  notes?: string | null
}

export interface RentalCreateBody {
  customer_id: string
  expected_return_at: string
  initial_payment_type: string
  rental_at?: string | null
  reservation_id?: string | null
  initial_payment_value?: number | null
  initial_payment_rate?: number | null
  notes?: string | null
  items?: RentalItemInput[] | null
}

export interface RentalUpdateBody {
  notes?: string | null
  clear_notes?: boolean
}

export interface RentalListParams {
  offset?: number
  limit?: number
  status?: string
  customer_id?: string
  reservation_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type ReturnStatusCode =
  | 'PENDING_INSPECTION'
  | 'INSPECTION_COMPLETED'
  | 'COMPLETED'

export interface ReturnItemDto {
  id: string
  return_id: string
  rental_item_id: string
  dress_id: string
  returned_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReturnDto {
  id: string
  return_number: string
  rental_id: string
  customer_id: string
  returned_at: string
  status: ReturnStatusCode | string
  returned_by: string | null
  notes: string | null
  items: ReturnItemDto[]
  created_at: string
  updated_at: string
}

export interface ReturnCreateBody {
  rental_id: string
  customer_id?: string | null
  returned_at?: string | null
  notes?: string | null
}

export interface ReturnListParams {
  offset?: number
  limit?: number
  status?: string
  customer_id?: string
  rental_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type InspectionStatusCode = 'PENDING' | 'COMPLETED'

export type DressConditionCode = 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE'

export interface InspectionItemDto {
  id: string
  inspection_id: string
  return_item_id: string
  dress_id: string
  condition: DressConditionCode | string | null
  repair_penalty_amount: number | null
  repair_notes: string | null
  requires_laundry: boolean
  send_to_ruined: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InspectionDto {
  id: string
  inspection_number: string
  return_id: string
  inspected_at: string | null
  inspected_by: string | null
  status: InspectionStatusCode | string
  notes: string | null
  items: InspectionItemDto[]
  created_at: string
  updated_at: string
}

export interface InspectionCreateBody {
  return_id: string
  notes?: string | null
}

export interface InspectionItemUpdateInput {
  id: string
  condition: string
  repair_penalty_amount?: number | null
  repair_notes?: string | null
  requires_laundry?: boolean
  send_to_ruined?: boolean
  notes?: string | null
}

export interface InspectionUpdateBody {
  notes?: string | null
  clear_notes?: boolean
  items?: InspectionItemUpdateInput[] | null
  complete?: boolean
}

export interface InspectionListParams {
  offset?: number
  limit?: number
  status?: string
  return_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type ProcessingStatusCode = 'PENDING' | 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED'

export interface ProcessingItemDto {
  id: string
  processing_batch_id: string
  dress_id: string
  inspection_item_id: string
  return_item_id: string
  rental_item_id: string
  calendar_block_id: string | null
  status: ProcessingStatusCode | string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProcessingBatchDto {
  id: string
  processing_number: string
  status: ProcessingStatusCode | string
  started_at: string | null
  mandatory_processing_end_at: string | null
  optional_extra_day_enabled: boolean
  final_processing_end_at: string | null
  completed_at: string | null
  started_by: string | null
  completed_by: string | null
  notes: string | null
  items: ProcessingItemDto[]
  created_at: string
  updated_at: string
}

export interface ProcessingCreateBody {
  inspection_item_ids: string[]
  notes?: string | null
  enable_optional_day?: boolean
}

export interface ProcessingUpdateBody {
  notes?: string | null
  clear_notes?: boolean
}

export interface ProcessingStartBody {
  enable_optional_day?: boolean | null
}

export interface ProcessingListParams {
  offset?: number
  limit?: number
  status?: string
  dress_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type SaleOriginCode = 'NORMAL_SALE' | 'MANDATORY_DAMAGE_PURCHASE'
export type SaleStatusCode = 'COMPLETED' | 'VOIDED'
/** @deprecated Alias — prefer SaleOriginCode */
export type SaleOrigin = SaleOriginCode
export type SalePaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER' | string
export type PaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'

export interface SaleItemDto {
  id: string
  sale_id: string
  dress_id: string
  default_sale_price: number
  actual_sale_price: number
  inspection_item_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SalePaymentDto {
  id: string
  sale_id: string
  amount: number
  payment_method: PaymentMethodCode | string
  received_at: string
  received_by: string | null
  reference_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SaleDto {
  id: string
  sale_number: string
  origin: SaleOriginCode | string
  status: SaleStatusCode | string
  customer_id: string | null
  rental_id: string | null
  return_id: string | null
  inspection_id: string | null
  total_amount: number
  sold_at: string
  sold_by: string | null
  notes: string | null
  items: SaleItemDto[]
  payments: SalePaymentDto[]
  created_at: string
  updated_at: string
}

export interface SaleItemCreateInput {
  dress_id: string
  actual_sale_price?: number | null
  notes?: string | null
}

export interface SalePaymentCreateInput {
  amount: number
  payment_method: PaymentMethodCode | string
  reference_number?: string | null
  notes?: string | null
  received_at?: string | null
}

export interface SaleCreateBody {
  origin: SaleOriginCode | string
  customer_id?: string | null
  inspection_item_id?: string | null
  items: SaleItemCreateInput[]
  payment: SalePaymentCreateInput
  notes?: string | null
}

export interface SaleListParams {
  offset?: number
  limit?: number
  status?: string
  origin?: string
  customer_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

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
  /** Nest V2 dashboard extras (mapped from camelCase). */
  open_settlements?: number
  outstanding_balance_fils?: number
  revenue_today_fils?: number
  revenue_this_month_fils?: number
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

// --- Admin / Identity / RBAC / Settings / System ---

export interface ItemsEnvelope<T> {
  success: boolean
  total: number
  items: T[]
}

export interface UserDto {
  id: string
  username: string
  full_name: string
  phone: string | null
  email: string | null
  role_id: string
  is_active: boolean
  is_locked: boolean
  must_change_password: boolean
  failed_login_attempts: number
  last_login_at: string | null
  password_changed_at: string | null
  created_at: string
  updated_at: string
}

export interface UserCreateBody {
  username: string
  password: string
  full_name: string
  role_id: string
  phone?: string | null
  email?: string | null
  must_change_password?: boolean
}

export interface UserUpdateBody {
  full_name?: string | null
  phone?: string | null
  email?: string | null
  role_id?: string | null
}

export interface UserListParams {
  offset?: number
  limit?: number
}

export interface AdminResetPasswordBody {
  user_id: string
  new_password: string
}

export interface LoginHistoryDto {
  id: string
  user_id: string | null
  username: string | null
  success: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: string
  [key: string]: unknown
}

export interface LoginHistoryListParams {
  offset?: number
  limit?: number
  user_id?: string
  username?: string
  success?: boolean
}

export interface PermissionDto {
  id: string
  key: string
  display_name: string
  description: string | null
  module: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PermissionCreateBody {
  key: string
  display_name: string
  description?: string | null
  module?: string | null
}

export interface PermissionUpdateBody {
  display_name?: string | null
  description?: string | null
  module?: string | null
}

export interface RoleDto {
  id: string
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  permissions: PermissionDto[]
}

export interface RoleCreateBody {
  name: string
  description?: string | null
  is_active?: boolean
  permission_keys?: string[]
}

export interface RoleUpdateBody {
  name?: string | null
  description?: string | null
  is_active?: boolean
}

export interface RolePermissionsAssignBody {
  permission_keys: string[]
}

export type SettingCategory =
  | 'company'
  | 'financial'
  | 'processing'
  | 'inventory'
  | 'customers'
  | 'reservations'
  | 'sales'
  | 'rentals'
  | 'returns'
  | 'inspection'
  | 'system'

export interface SettingDto {
  id: string
  key: string
  value: string
  parsed_value: unknown
  value_type: string
  category: SettingCategory | string
  description: string | null
  is_editable: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface SettingUpdateBody {
  value: string
  description?: string | null
}

export interface SettingValueBody {
  value: string
}

export interface HealthDto {
  status: string
  database: string
  redis: string
  app?: string
  environment?: string
  version?: string
  [key: string]: unknown
}

export interface VersionDto {
  name: string
  name_ar: string
  version: string
  api: string
  environment: string
}

export interface SystemInfoDto {
  [key: string]: unknown
}

export interface SystemDiagnosticsDto {
  status?: string
  overall?: string
  checks?: Record<string, unknown>
  [key: string]: unknown
}

export interface SystemMetricsDto {
  [key: string]: unknown
}

export interface MaintenanceTaskDto {
  key: string
  name?: string
  description?: string | null
  [key: string]: unknown
}

export interface MaintenanceExecuteBody {
  confirm?: boolean
  dry_run?: boolean
}

export interface MaintenanceRunDto {
  id: string
  task_key: string
  status: string
  started_at?: string | null
  finished_at?: string | null
  [key: string]: unknown
}

export interface MaintenanceHistoryParams {
  offset?: number
  limit?: number
  task_key?: string
  status?: string
  executed_by_user_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface SystemBackupDto {
  id: string
  filename?: string
  status: string
  compressed_size_bytes?: number | null
  checksum_sha256?: string | null
  include_media?: boolean
  notes?: string | null
  created_at: string
  [key: string]: unknown
}

export interface SystemBackupCreateBody {
  include_media?: boolean
  notes?: string | null
}

export interface SystemBackupListParams {
  offset?: number
  limit?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface RestoreValidateBody {
  backup_id?: string | null
  expected_checksum?: string | null
}

export interface RestoreExecuteBody {
  confirm: boolean
  confirm_checksum: string
  backup_id?: string | null
  notes?: string | null
}

export interface RestoreHistoryDto {
  id: string
  status: string
  started_at?: string | null
  finished_at?: string | null
  [key: string]: unknown
}

export interface RestoreHistoryParams {
  offset?: number
  limit?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

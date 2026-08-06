/**
 * Convert Nest V2 camelCase responses into legacy UI envelopes / snake_case DTOs
 * so existing feature hooks and pages keep working without visual redesign.
 */
import type {
  CategoryDto,
  ColorDto,
  CustomerDto,
  CustomerCreateBody,
  CustomerUpdateBody,
  DashboardReportDto,
  DressDto,
  DressCreateBody,
  DressUpdateBody,
  FinancialSummaryReportDto,
  AuditLogDto,
  ItemEnvelope,
  ListEnvelope,
  MessageEnvelope,
  PageListEnvelope,
  PagePaginationMeta,
  PaginationMeta,
  ReservationDto,
  ReservationCreateBody,
  RentalDto,
  RentalCreateBody,
  RentalUpdateBody,
  SettlementDto,
  SettlementPaymentCreateBody,
  SettlementAdjustmentCreateBody,
  StoredFileDto
} from '../domainTypes'
import type {
  V2Brand,
  V2Category,
  V2Color,
  V2Customer,
  V2DashboardReport,
  V2FinancialReport,
  V2Item,
  V2MediaFile,
  V2PaginationMeta,
  V2Rental,
  V2Reservation,
  V2Settlement,
  V2Size
} from './contracts'

export function toLegacyList<TSrc, TOut>(
  items: TSrc[],
  meta: V2PaginationMeta | PaginationMeta | undefined,
  mapFn: (item: TSrc) => TOut
): ListEnvelope<TOut> {
  const m: PaginationMeta = {
    offset: meta?.offset ?? 0,
    limit: meta?.limit ?? items.length,
    total: meta?.total ?? items.length
  }
  return { success: true, data: items.map(mapFn), meta: m }
}

export function toLegacyItem<TSrc, TOut>(
  entity: TSrc,
  mapFn: (item: TSrc) => TOut
): ItemEnvelope<TOut> {
  return { success: true, data: mapFn(entity) }
}

export function toLegacyMessage(message = 'ok'): MessageEnvelope {
  return { success: true, message }
}

export function toPageListEnvelope<T>(
  items: T[],
  meta: V2PaginationMeta | undefined,
  page?: number,
  pageSize?: number
): PageListEnvelope<T> {
  const limit = meta?.limit ?? pageSize ?? 50
  const offset = meta?.offset ?? 0
  const total = meta?.total ?? items.length
  const pageMeta: PagePaginationMeta = {
    page: page ?? Math.floor(offset / Math.max(limit, 1)) + 1,
    page_size: limit,
    total,
    pages: Math.max(1, Math.ceil(total / Math.max(limit, 1)))
  }
  return { success: true, data: items, meta: pageMeta }
}

/**
 * Nest `@IsIn` sort fields are camelCase. Legacy tables sort by snake_case
 * column ids — map aliases first, then generic snake→camel.
 */
const SORT_FIELD_ALIASES: Record<string, string> = {
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  full_name: 'fullName',
  customer_number: 'customerNumber',
  display_order: 'displayOrder',
  display_name: 'displayName',
  name_ar: 'displayName',
  name_en: 'displayName',
  internal_code: 'internalCode',
  rental_at: 'rentalDate',
  rental_date: 'rentalDate',
  expected_return_at: 'expectedReturnDate',
  expected_return_date: 'expectedReturnDate',
  expected_checkout_date: 'expectedCheckoutDate',
  start_date: 'startDate',
  rental_number: 'rentalNumber',
  reservation_number: 'reservationNumber',
  settlement_number: 'settlementNumber',
  remaining_balance: 'remainingFils',
  total_due: 'totalFils',
  sold_at: 'soldAt'
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function mapSortByField(value: unknown): string {
  const raw = String(value)
  return SORT_FIELD_ALIASES[raw] ?? (raw.includes('_') ? snakeToCamel(raw) : raw)
}

function applyPageToOffset(out: Record<string, unknown>): void {
  if (!('page' in out) && !('page_size' in out)) return
  const page = Number(out.page ?? 1)
  const pageSize = Number(out.page_size ?? out.limit ?? 50)
  delete out.page
  delete out.page_size
  if (out.offset === undefined) {
    out.offset = Math.max(0, (page - 1) * pageSize)
  }
  if (out.limit === undefined) {
    out.limit = pageSize
  }
}

/** Map legacy list query keys → Nest V2 query keys. */
export function bridgeListQuery(
  params?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!params) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (key === 'active_only') {
      if (value === true || value === 'true' || value === 1) out.status = 'active'
      continue
    }
    if (key === 'sort_by') {
      out.sortBy = mapSortByField(value)
      continue
    }
    if (key === 'sort_dir') {
      out.sortDir = value
      continue
    }
    if (key === 'customer_id') {
      out.customerId = value
      continue
    }
    if (key === 'category_id') {
      out.categoryId = value
      continue
    }
    if (key === 'rental_id') {
      out.rentalId = value
      continue
    }
    if (key === 'reservation_id') {
      out.reservationId = value
      continue
    }
    if (key === 'is_active') {
      if (value === true || value === 'true') out.status = 'active'
      else if (value === false || value === 'false') out.status = 'inactive'
      continue
    }
    if (key === 'page' || key === 'page_size') {
      out[key] = value
      continue
    }
    if (key === 'date_from') {
      out.from = value
      continue
    }
    if (key === 'date_to') {
      out.to = value
      continue
    }
    if (key === 'status' && typeof value === 'string') {
      // Nest validates lowercase enums (`open`, `return_pending`); UI sends UPPER_SNAKE.
      out.status = statusQueryToV2(value)
      continue
    }
    out[key] = value
  }
  applyPageToOffset(out)
  return Object.keys(out).length ? out : undefined
}

/**
 * Taxonomy list DTOs (`/categories`, brands, colors, sizes) only whitelist
 * `q` / `deleted` / `parentId` / `offset` / `limit`. Strip sort + status.
 */
export function bridgeTaxonomyListQuery(
  params?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  const bridged = bridgeListQuery(params) ?? {}
  const out: Record<string, unknown> = {}
  for (const key of ['q', 'deleted', 'parentId', 'offset', 'limit'] as const) {
    if (bridged[key] !== undefined && bridged[key] !== null && bridged[key] !== '') {
      out[key] = bridged[key]
    }
  }
  return Object.keys(out).length ? out : undefined
}

/** Dress list uses page/page_size; Nest uses offset/limit. */
export function dressListQuery(
  params?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  const bridged = bridgeListQuery(params) ?? {}
  if (bridged.colour) {
    bridged.colorId = bridged.colour
    delete bridged.colour
  }
  return Object.keys(bridged).length ? bridged : undefined
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function isoOrNull(value: unknown): string | null {
  if (value == null || value === '') return null
  return iso(value)
}

/** Uppercase snake token: `partially_paid` / `PARTIALLY_PAID` → `PARTIALLY_PAID`. */
function statusToken(status: unknown): string {
  return String(status ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
}

/**
 * Nest stores lowercase statuses; legacy UI maps/comparisons are UPPER_SNAKE.
 * Alias only where legacy codes diverge from V2.
 */
const STATUS_QUERY_LEGACY_TO_V2: Record<string, string> = {
  VOIDED: 'cancelled',
  CONVERTED_TO_RENTAL: 'checked_out'
}

function statusQueryToV2(value: string): string {
  const token = statusToken(value)
  return STATUS_QUERY_LEGACY_TO_V2[token] ?? token.toLowerCase()
}

function mapSettlementStatusToLegacy(status: unknown): SettlementDto['status'] {
  const s = statusToken(status)
  if (s === 'PARTIALLY_PAID') return 'PARTIALLY_PAID'
  if (s === 'PAID' || s === 'CLOSED') return 'PAID'
  if (s === 'CANCELLED' || s === 'VOIDED') return 'VOIDED'
  return 'OPEN'
}

function mapReservationStatusToLegacy(status: unknown): string {
  const s = statusToken(status)
  if (s === 'CHECKED_OUT' || s === 'COMPLETED' || s === 'CONVERTED_TO_RENTAL') {
    return 'CONVERTED_TO_RENTAL'
  }
  return s || 'DRAFT'
}

function mapRentalStatusToLegacy(status: unknown): string {
  return statusToken(status) || 'DRAFT'
}

// --- Customer ---

export function mapCustomerV2ToLegacy(c: V2Customer): CustomerDto {
  return {
    id: c.id,
    customer_number: c.customerNumber,
    full_name: c.fullName,
    phone: c.phone,
    alternative_phone: c.secondaryPhone ?? null,
    address: c.address ?? null,
    national_id: c.nationalId ?? null,
    notes: c.notes ?? null,
    gender: c.gender ?? null,
    birth_date: isoOrNull(c.birthDate),
    is_active: (c.status || '').toLowerCase() === 'active',
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt)
  }
}

/** Accept snake_case UI bodies and emit Nest camelCase. */
export function mapCustomerBodyToV2(
  body: CustomerCreateBody | CustomerUpdateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const fullName = b.fullName ?? b.full_name
  const phone = b.phone
  const secondary = b.secondaryPhone ?? b.alternative_phone
  const nationalId = b.nationalId ?? b.national_id
  const birthDate = b.birthDate ?? b.birth_date
  const clearBirthDate = b.clearBirthDate ?? b.clear_birth_date
  if (fullName !== undefined) out.fullName = fullName
  if (phone !== undefined) out.phone = phone
  if (secondary !== undefined) out.secondaryPhone = secondary
  if (b.address !== undefined) out.address = b.address
  if (b.city !== undefined) out.city = b.city
  if (nationalId !== undefined) out.nationalId = nationalId
  if (b.notes !== undefined) out.notes = b.notes
  if (b.gender !== undefined) out.gender = b.gender
  if (birthDate !== undefined) out.birthDate = birthDate
  if (clearBirthDate !== undefined) out.clearBirthDate = clearBirthDate
  if (b.status !== undefined) out.status = b.status
  else if (b.is_active === true) out.status = 'active'
  else if (b.is_active === false) out.status = 'inactive'
  return out
}

// --- Category ---

export function mapCategoryV2ToLegacy(c: V2Category): CategoryDto {
  return {
    id: c.id,
    name_ar: c.name,
    name_en: c.nameEn ?? null,
    description: c.description ?? null,
    display_order: c.sortOrder ?? 0,
    is_active: c.isActive !== false && !c.deletedAt,
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt)
  }
}

export function mapCategoryBodyToV2(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const name = body.name ?? body.name_ar
  if (name !== undefined) out.name = name
  if (body.name_en !== undefined || body.nameEn !== undefined) {
    out.nameEn = body.nameEn ?? body.name_en
  }
  if (body.description !== undefined) out.description = body.description
  if (body.display_order !== undefined || body.sortOrder !== undefined) {
    out.sortOrder = body.sortOrder ?? body.display_order
  }
  if (body.is_active !== undefined || body.isActive !== undefined) {
    out.isActive = body.isActive ?? body.is_active
  }
  if (body.parentId !== undefined || body.parent_id !== undefined) {
    out.parentId = body.parentId ?? body.parent_id
  }
  return out
}

export function mapBrandV2ToLegacy(b: V2Brand): CategoryDto {
  return mapCategoryV2ToLegacy(b as V2Category)
}

export function mapSizeV2ToLegacy(s: V2Size): CategoryDto {
  return mapCategoryV2ToLegacy(s as V2Category)
}

export function mapColorV2ToLegacy(c: V2Color): ColorDto {
  return {
    id: c.id,
    name_ar: c.name,
    name_en: null,
    hex_code: c.hexCode ?? null,
    description: c.description ?? null,
    display_order: 0,
    is_active: c.isActive !== false && !c.deletedAt,
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt)
  }
}

export function mapColorBodyToV2(body: Record<string, unknown>): Record<string, unknown> {
  const out = mapCategoryBodyToV2(body)
  if (body.hex_code !== undefined || body.hexCode !== undefined) {
    out.hexCode = body.hexCode ?? body.hex_code
  }
  return out
}

// --- Item / Dress ---

/** Nest lifecycle (uppercased) → dress status chip key (prefer Nest names). */
const LIFECYCLE_TO_DRESS_STATUS: Record<string, string> = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  RENTED: 'RENTED',
  CHECKED_OUT: 'RENTED',
  RETURN_PENDING: 'RETURN_PENDING',
  RETURNED: 'RETURN_PENDING',
  IN_INSPECTION: 'INSPECTION',
  INSPECTION: 'INSPECTION',
  CLEANING: 'CLEANING',
  IN_PROCESSING: 'CLEANING',
  PROCESSING: 'CLEANING',
  MAINTENANCE: 'MAINTENANCE',
  FOR_SALE: 'FOR_SALE',
  SOLD: 'SOLD',
  RETIRED: 'RETIRED',
  RUINED: 'RETIRED',
  LOST: 'LOST',
  DAMAGED: 'DAMAGED'
}

export function mapItemV2ToDress(item: V2Item): DressDto {
  // Never fall back to internalCode — Nest rentals require a real activated barcode.
  const primary =
    item.barcodes?.find((b) => b.isPrimary)?.value ?? item.barcodes?.[0]?.value ?? ''
  const lifecycle = (item.lifecycleState || item.status || 'AVAILABLE').toUpperCase()
  return {
    id: item.id,
    barcode: primary,
    category_id: item.category?.id ?? '',
    name_ar: item.displayName,
    name_en: null,
    brand: item.brand?.name ?? null,
    brand_id: item.brand?.id ?? null,
    size: item.size?.name ?? '',
    size_id: item.size?.id ?? null,
    colour: item.color?.name ?? '',
    color_id: item.color?.id ?? null,
    purchase_price: item.purchasePrice ?? 0,
    default_daily_rental_price: item.rentalPrice ?? 0,
    default_sale_price: item.salePrice ?? 0,
    description: item.description ?? null,
    purchase_date: null,
    status: LIFECYCLE_TO_DRESS_STATUS[lifecycle] ?? lifecycle,
    is_active: !item.deletedAt && (item.status || '').toLowerCase() !== 'inactive',
    created_at: iso(item.createdAt),
    updated_at: iso(item.updatedAt)
  }
}

export function mapDressBodyToItemV2(
  body: DressCreateBody | DressUpdateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const displayName = b.displayName ?? b.name_ar
  if (displayName !== undefined) out.displayName = displayName
  if (b.category_id !== undefined || b.categoryId !== undefined) {
    out.categoryId = b.categoryId ?? b.category_id
  }
  if (b.brand_id !== undefined || b.brandId !== undefined) {
    out.brandId = b.brandId ?? b.brand_id
  }
  if (b.color_id !== undefined || b.colorId !== undefined || b.colour !== undefined) {
    // colour name alone cannot resolve ID; only pass if ID-like provided
    const colorId = b.colorId ?? b.color_id
    if (colorId) out.colorId = colorId
  }
  if (b.size_id !== undefined || b.sizeId !== undefined) {
    out.sizeId = b.sizeId ?? b.size_id
  }
  if (b.purchase_price !== undefined || b.purchasePrice !== undefined) {
    out.purchasePrice = b.purchasePrice ?? b.purchase_price
  }
  if (b.default_daily_rental_price !== undefined || b.rentalPrice !== undefined) {
    out.rentalPrice = b.rentalPrice ?? b.default_daily_rental_price
  }
  if (b.default_sale_price !== undefined || b.salePrice !== undefined) {
    out.salePrice = b.salePrice ?? b.default_sale_price
  }
  if (b.description !== undefined) {
    out.description =
      b.description == null || b.description === ''
        ? null
        : String(b.description)
  }
  if (b.generateBarcode === true) out.generateBarcode = true
  if (b.barcode !== undefined) {
    const code = typeof b.barcode === 'string' ? b.barcode.trim() : b.barcode
    if (typeof code === 'string' && code.length > 0) {
      out.barcode = code
    } else {
      // Empty/null barcode on create/update → ask Nest to allocate one.
      out.generateBarcode = true
    }
  }
  if (b.is_active === false) out.status = 'inactive'
  if (b.is_active === true) out.status = 'active'
  return out
}

/** UI status → Nest ITEM_LIFECYCLE lowercase token. */
export function mapDressStatusToTransition(newStatus: string): string {
  const s = statusToken(newStatus)
  const map: Record<string, string> = {
    AVAILABLE: 'available',
    RESERVED: 'reserved',
    RENTED: 'rented',
    RETURNED: 'return_pending',
    RETURN_PENDING: 'return_pending',
    INSPECTION: 'inspection',
    IN_INSPECTION: 'inspection',
    PROCESSING: 'cleaning',
    IN_PROCESSING: 'cleaning',
    CLEANING: 'cleaning',
    MAINTENANCE: 'maintenance',
    SOLD: 'sold',
    RUINED: 'retired',
    RETIRED: 'retired',
    RUINED_PENDING_SALE: 'for_sale',
    FOR_SALE: 'for_sale',
    LOST: 'lost',
    DAMAGED: 'damaged'
  }
  return map[s] ?? s.toLowerCase()
}

// --- Reservation ---

export function mapReservationV2ToLegacy(r: V2Reservation): ReservationDto {
  return {
    id: r.id,
    reservation_number: r.reservationNumber,
    customer_id: r.customerId,
    reservation_at: iso(r.startDate),
    rental_start_at: iso(r.expectedCheckoutDate || r.startDate),
    expected_return_at: iso(r.expectedReturnDate),
    status: mapReservationStatusToLegacy(r.status),
    notes: r.notes ?? null,
    rental_id: r.rental?.id ?? null,
    items: (r.items ?? []).map((i) => ({
      id: i.id,
      reservation_id: r.id,
      dress_id: i.itemId,
      reserved_daily_rental_price: i.agreedRentalPrice ?? 0,
      notes: i.notes ?? null,
      calendar_block_id: null,
      created_at: iso(r.createdAt),
      updated_at: iso(r.updatedAt)
    })),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt)
  }
}

export function mapReservationBodyToV2(
  body: ReservationCreateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  const itemsRaw = (b.items as Array<Record<string, unknown>> | undefined) ?? []
  return {
    customerId: b.customerId ?? b.customer_id,
    startDate: b.startDate ?? b.reservation_at ?? b.rental_start_at,
    expectedCheckoutDate: b.expectedCheckoutDate ?? b.rental_start_at,
    expectedReturnDate: b.expectedReturnDate ?? b.expected_return_at,
    notes: b.notes ?? null,
    items: itemsRaw.map((it) => ({
      itemId: it.itemId ?? it.dress_id,
      agreedRentalPrice: it.agreedRentalPrice ?? it.reserved_daily_rental_price ?? undefined,
      notes: it.notes ?? undefined,
      barcode: it.barcode ?? undefined
    }))
  }
}

// --- Rental ---

/** Calendar span in whole days (min 1), matching FE checkout deposit preview. */
function rentalSpanDays(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1
  return Math.max(1, Math.ceil((end - start) / 86_400_000))
}

export function mapRentalV2ToLegacy(r: V2Rental): RentalDto {
  if (!r || typeof r !== 'object') {
    throw new Error('Invalid rental payload from server')
  }
  const days = rentalSpanDays(r.rentalDate, r.expectedReturnDate)
  const itemRows = Array.isArray(r.items) ? r.items : []
  // Nest checkout charge = sum(agreedRentalPrice) once (not × days). Keep FE in sync.
  const estimatedTotal = itemRows.reduce(
    (sum, i) => sum + (i.agreedRentalPrice ?? 0),
    0
  )
  return {
    id: r.id,
    rental_number: r.rentalNumber,
    customer_id: r.customerId,
    reservation_id: r.reservationId ?? null,
    rental_at: iso(r.rentalDate),
    expected_return_at: iso(r.expectedReturnDate),
    status: mapRentalStatusToLegacy(r.status),
    initial_payment_type: 'FIXED_AMOUNT',
    initial_payment_rate: null,
    // Deposit / remaining live on Settlement — filled by pages via getByRental.
    initial_payment_value: 0,
    estimated_total: estimatedTotal,
    remaining_balance: estimatedTotal,
    notes: r.notes ?? null,
    items: itemRows.map((i) => ({
      id: i.id,
      rental_id: r.id,
      dress_id: i.itemId,
      agreed_daily_rental_price: i.agreedRentalPrice ?? 0,
      expected_rental_days: days,
      notes: i.notes ?? null,
      calendar_block_id: null,
      created_at: iso(r.createdAt),
      updated_at: iso(r.updatedAt)
    })),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt)
  }
}

export function mapRentalBodyToV2(
  body: RentalCreateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  const itemsRaw = (b.items as Array<Record<string, unknown>> | undefined) ?? []
  return {
    customerId: b.customerId ?? b.customer_id,
    rentalDate: b.rentalDate ?? b.rental_at ?? new Date().toISOString(),
    expectedReturnDate: b.expectedReturnDate ?? b.expected_return_at,
    notes: b.notes ?? null,
    items: itemsRaw.map((it) => ({
      itemId: it.itemId ?? it.dress_id,
      agreedRentalPrice: it.agreedRentalPrice ?? it.agreed_daily_rental_price ?? undefined,
      notes: it.notes ?? undefined,
      barcode: it.barcode ?? undefined
    }))
  }
}

export function mapRentalUpdateBodyToV2(
  body: RentalUpdateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  if (b.clear_notes === true) return { notes: null }
  if (b.notes !== undefined) {
    const n = b.notes
    if (n == null || (typeof n === 'string' && !n.trim())) return { notes: null }
    return { notes: n }
  }
  return {}
}

export function mapAuditLogV2ToLegacy(row: Record<string, unknown>): AuditLogDto {
  return {
    id: String(row.id ?? ''),
    module: String(row.module ?? ''),
    entity_type: String(row.entityType ?? row.entity_type ?? ''),
    entity_id:
      row.entityId != null || row.entity_id != null
        ? String(row.entityId ?? row.entity_id)
        : null,
    action: String(row.action ?? ''),
    old_values: row.oldValues ?? row.old_values ?? null,
    new_values: row.newValues ?? row.new_values ?? null,
    user_id:
      row.userId != null || row.user_id != null
        ? String(row.userId ?? row.user_id)
        : null,
    username:
      row.username != null ? String(row.username) : null,
    ip_address:
      row.ipAddress != null || row.ip_address != null
        ? String(row.ipAddress ?? row.ip_address)
        : null,
    metadata: row.metadata ?? null,
    message: row.message != null ? String(row.message) : null,
    created_at: iso(row.createdAt ?? row.created_at)
  }
}

// --- Settlement ---

export function mapSettlementV2ToLegacy(s: V2Settlement): SettlementDto {
  const payments = (s.history ?? [])
    .filter((h) => h.paymentId || (h.action || '').toLowerCase().includes('payment'))
    .map((h) => ({
      id: h.id,
      settlement_id: s.id,
      amount: h.amountFils ?? 0,
      payment_method: 'CASH',
      received_at: iso(h.createdAt),
      received_by: h.username ?? null,
      reference_number: h.paymentId ?? null,
      notes: h.reason ?? null,
      created_at: iso(h.createdAt),
      updated_at: iso(h.createdAt)
    }))

  return {
    id: s.id,
    settlement_number: s.settlementNumber,
    rental_id: s.rentalId,
    return_id: '',
    status: mapSettlementStatusToLegacy(s.status),
    rental_charge_amount: s.chargeFils ?? 0,
    initial_payment_credit: s.depositFils ?? 0,
    late_penalty_amount: s.lateFeeFils ?? 0,
    minor_damage_penalty_amount: 0,
    manual_adjustment_amount: s.adjustmentFils ?? 0,
    gross_total: s.totalFils ?? 0,
    total_due: s.totalFils ?? 0,
    total_paid: s.paidFils ?? 0,
    remaining_balance: s.remainingFils ?? 0,
    settled_at: isoOrNull(s.closedAt),
    settled_by: null,
    notes: s.notes ?? null,
    charges: [],
    payments,
    adjustments: (s.adjustments ?? []).map((a) => ({
      id: a.id,
      settlement_id: s.id,
      amount: a.amountFils ?? 0,
      reason: a.reason ?? '',
      created_at: iso(a.createdAt),
      updated_at: iso(a.createdAt),
      created_by: null
    })),
    created_at: iso(s.createdAt),
    updated_at: iso(s.updatedAt)
  }
}

export function mapSettlementPaymentBodyToV2(
  body: SettlementPaymentCreateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  const amountRaw = b.amountFils ?? b.amount
  return {
    amountFils: typeof amountRaw === 'number' ? amountRaw : Number(amountRaw),
    method: b.method ?? b.payment_method ?? 'CASH',
    notes: b.notes ?? undefined,
    idempotencyKey: b.idempotencyKey ?? undefined
  }
}

export function mapSettlementAdjustmentBodyToV2(
  body: SettlementAdjustmentCreateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  const amountRaw = b.amountFils ?? b.amount
  return {
    amountFils: typeof amountRaw === 'number' ? amountRaw : Number(amountRaw),
    reason: b.reason,
    idempotencyKey: b.idempotencyKey ?? undefined
  }
}

// --- Media ---

export function mapMediaV2ToStoredFile(m: V2MediaFile): StoredFileDto {
  return {
    id: m.id,
    original_filename: m.originalFilename,
    stored_filename: m.storedFilename,
    extension: m.extension,
    mime_type: m.mimeType,
    size_bytes: m.sizeBytes,
    sha256_hash: m.checksum ?? '',
    storage_provider: 'local',
    relative_path: '',
    is_public: m.isPublic,
    uploaded_by: m.uploadedBy ?? null,
    created_at: iso(m.createdAt),
    updated_at: iso(m.updatedAt)
  }
}

// --- Reports ---

export function mapDashboardV2ToLegacy(d: V2DashboardReport): DashboardReportDto {
  const asOf = iso(d.asOf)
  return {
    timezone: 'Asia/Baghdad',
    as_of: asOf,
    today_from: asOf,
    today_to: asOf,
    dresses_total: d.inventoryCount ?? 0,
    dresses_active: (d.availableItems ?? 0) + (d.reservedItems ?? 0),
    dresses_by_status: {
      AVAILABLE: d.availableItems ?? 0,
      RESERVED: d.reservedItems ?? 0
    },
    rentals_active: d.activeRentals ?? 0,
    rentals_due_today: d.todaysReturns ?? 0,
    rentals_overdue: 0,
    reservations_today: d.todaysCheckouts ?? 0,
    reservations_upcoming: d.reservedItems ?? 0,
    processing_batches_in_process: 0,
    dresses_in_processing: 0,
    open_settlements: d.openSettlements ?? 0,
    outstanding_balance_fils: d.outstandingBalanceFils ?? 0,
    revenue_today_fils: d.revenueTodayFils ?? 0,
    revenue_this_month_fils: d.revenueThisMonthFils ?? 0
  }
}

export function mapFinancialV2ToLegacy(
  f: V2FinancialReport,
  range?: { date_from?: string; date_to?: string }
): FinancialSummaryReportDto {
  const revenue = f.revenueFils ?? 0
  const charges = f.chargesFils ?? 0
  return {
    date_from: range?.date_from ?? '',
    date_to: range?.date_to ?? '',
    rental_charges_gross: charges,
    rental_charges_rental: charges,
    rental_charges_late: f.lateFeesFils ?? 0,
    rental_charges_minor_damage: 0,
    rental_adjustments: f.adjustmentsFils ?? 0,
    rental_initial_credits: f.depositsFils ?? 0,
    rental_payments_collected: revenue,
    rental_outstanding: f.outstandingFils ?? 0,
    sale_revenue: 0,
    sale_revenue_normal: 0,
    sale_revenue_mandatory: 0,
    sale_payments_collected: 0,
    total_cash_collected: revenue,
    total_charged: charges
  }
}

/** Extract paginated payload whether already V2 shape or accidental envelope. */
export function unwrapV2Page<T>(raw: unknown): { items: T[]; meta: V2PaginationMeta } {
  if (!raw || typeof raw !== 'object') {
    return { items: [], meta: { offset: 0, limit: 0, total: 0 } }
  }
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.items)) {
    const meta = (r.meta as V2PaginationMeta) ?? {
      offset: 0,
      limit: (r.items as T[]).length,
      total: (r.items as T[]).length
    }
    return { items: r.items as T[], meta }
  }
  if (Array.isArray(r.data)) {
    const meta = (r.meta as V2PaginationMeta) ?? {
      offset: 0,
      limit: (r.data as T[]).length,
      total: (r.data as T[]).length
    }
    return { items: r.data as T[], meta }
  }
  return { items: [], meta: { offset: 0, limit: 0, total: 0 } }
}

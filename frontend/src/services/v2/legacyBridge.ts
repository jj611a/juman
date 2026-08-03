/**
 * Convert Nest V2 camelCase responses into legacy UI envelopes / snake_case DTOs
 * so existing feature hooks and pages keep working without visual redesign.
 */
import type {
  CategoryDto,
  CustomerDto,
  CustomerCreateBody,
  CustomerUpdateBody,
  DashboardReportDto,
  DressDto,
  DressCreateBody,
  DressUpdateBody,
  FinancialSummaryReportDto,
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
  SettlementDto,
  SettlementPaymentCreateBody,
  SettlementAdjustmentCreateBody,
  StoredFileDto
} from '../domainTypes'
import type {
  V2Category,
  V2Customer,
  V2DashboardReport,
  V2FinancialReport,
  V2Item,
  V2MediaFile,
  V2PaginationMeta,
  V2Rental,
  V2Reservation,
  V2Settlement
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
      out.sortBy = value
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
      // Converted by dressListQuery
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
    out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

/** Dress list uses page/page_size; Nest uses offset/limit. */
export function dressListQuery(
  params?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  const bridged = bridgeListQuery(params) ?? {}
  const page = Number(bridged.page ?? 1)
  const pageSize = Number(bridged.page_size ?? bridged.limit ?? 50)
  delete bridged.page
  delete bridged.page_size
  bridged.offset = Math.max(0, (page - 1) * pageSize)
  bridged.limit = pageSize
  if (bridged.colour) {
    bridged.colorId = bridged.colour
    delete bridged.colour
  }
  return bridged
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

// --- Item / Dress ---

const LIFECYCLE_TO_DRESS_STATUS: Record<string, string> = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  RENTED: 'RENTED',
  CHECKED_OUT: 'RENTED',
  RETURNED: 'RETURNED',
  IN_INSPECTION: 'INSPECTION',
  INSPECTION: 'INSPECTION',
  IN_PROCESSING: 'PROCESSING',
  PROCESSING: 'PROCESSING',
  MAINTENANCE: 'PROCESSING',
  SOLD: 'SOLD',
  RETIRED: 'RUINED',
  RUINED: 'RUINED',
  DAMAGED: 'RUINED'
}

export function mapItemV2ToDress(item: V2Item): DressDto {
  const primary =
    item.barcodes?.find((b) => b.isPrimary)?.value ?? item.barcodes?.[0]?.value ?? item.internalCode
  const lifecycle = (item.lifecycleState || item.status || 'AVAILABLE').toUpperCase()
  return {
    id: item.id,
    barcode: primary,
    category_id: item.category?.id ?? '',
    name_ar: item.displayName,
    name_en: null,
    brand: item.brand?.name ?? null,
    size: item.size?.name ?? '',
    colour: item.color?.name ?? '',
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
  if (b.description !== undefined) out.description = b.description
  if (b.barcode !== undefined) out.barcode = b.barcode
  if (b.is_active === false) out.status = 'inactive'
  if (b.is_active === true) out.status = 'active'
  return out
}

export function mapDressStatusToTransition(newStatus: string): string {
  const s = newStatus.toUpperCase()
  const map: Record<string, string> = {
    AVAILABLE: 'AVAILABLE',
    RESERVED: 'RESERVED',
    RENTED: 'RENTED',
    RETURNED: 'RETURNED',
    INSPECTION: 'IN_INSPECTION',
    PROCESSING: 'IN_PROCESSING',
    SOLD: 'SOLD',
    RUINED: 'RETIRED',
    RUINED_PENDING_SALE: 'RETIRED'
  }
  return map[s] ?? s
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
    status: r.status,
    notes: r.notes ?? null,
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

export function mapRentalV2ToLegacy(r: V2Rental): RentalDto {
  return {
    id: r.id,
    rental_number: r.rentalNumber,
    customer_id: r.customerId,
    reservation_id: r.reservationId ?? null,
    rental_at: iso(r.rentalDate),
    expected_return_at: iso(r.expectedReturnDate),
    status: r.status,
    initial_payment_type: 'FIXED_AMOUNT',
    initial_payment_rate: null,
    initial_payment_value: 0,
    estimated_total: 0,
    remaining_balance: 0,
    notes: r.notes ?? null,
    items: (r.items ?? []).map((i) => ({
      id: i.id,
      rental_id: r.id,
      dress_id: i.itemId,
      agreed_daily_rental_price: i.agreedRentalPrice ?? 0,
      expected_rental_days: 1,
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
    status: s.status as SettlementDto['status'],
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
      amount: a.amountFils,
      reason: a.reason,
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
  return {
    amountFils: b.amountFils ?? b.amount,
    method: b.method ?? b.payment_method ?? 'CASH',
    notes: b.notes ?? undefined,
    idempotencyKey: b.idempotencyKey ?? undefined
  }
}

export function mapSettlementAdjustmentBodyToV2(
  body: SettlementAdjustmentCreateBody | Record<string, unknown>
): Record<string, unknown> {
  const b = body as Record<string, unknown>
  return {
    amountFils: b.amountFils ?? b.amount,
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

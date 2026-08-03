/** Nest Backend V2 public shapes (camelCase). Mirrors backend-node HTTP DTOs. */

export interface V2PaginationMeta {
  offset: number
  limit: number
  total: number
}

export interface V2Paginated<T> {
  items: T[]
  meta: V2PaginationMeta
}

export interface V2Customer {
  id: string
  customerNumber: string
  fullName: string
  phone: string
  phoneNormalized?: string | null
  secondaryPhone?: string | null
  secondaryPhoneNormalized?: string | null
  address?: string | null
  city?: string | null
  nationalId?: string | null
  gender?: string | null
  birthDate?: string | null
  notes?: string | null
  status: string
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
  deletedBy?: string | null
}

export interface V2TaxonomySummary {
  id: string
  name: string
}

export interface V2Category {
  id: string
  name: string
  nameEn?: string | null
  description?: string | null
  isActive?: boolean
  sortOrder?: number | null
  parentId?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface V2Brand {
  id: string
  name: string
  description?: string | null
  isActive?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface V2Color {
  id: string
  name: string
  hexCode?: string | null
  description?: string | null
  isActive?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface V2Size {
  id: string
  name: string
  description?: string | null
  isActive?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface V2ItemBarcode {
  id: string
  value: string
  isPrimary: boolean
}

export interface V2ItemMedia {
  id: string
  mediaFileId: string
  purpose?: string | null
  isPrimary: boolean
  displayOrder: number
  mediaFile?: {
    id: string
    originalFilename: string
    mimeType: string
    relativePath?: string | null
  } | null
}

export interface V2Item {
  id: string
  internalCode: string
  displayName: string
  purchasePrice: number
  rentalPrice: number
  salePrice: number
  condition?: string | null
  status: string
  lifecycleState: string
  description?: string | null
  category?: V2TaxonomySummary | null
  brand?: V2TaxonomySummary | null
  color?: (V2TaxonomySummary & { hexCode?: string | null }) | null
  size?: V2TaxonomySummary | null
  barcodes: V2ItemBarcode[]
  media?: V2ItemMedia[]
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface V2ReservationItem {
  id: string
  itemId: string
  barcodeValue?: string | null
  agreedRentalPrice?: number | null
  notes?: string | null
  item?: {
    id: string
    internalCode: string
    displayName: string
    status: string
    lifecycleState: string
    rentalPrice: number
  } | null
}

export interface V2Reservation {
  id: string
  reservationNumber: string
  customerId: string
  customer?: {
    id: string
    customerNumber: string
    fullName: string
    status: string
  } | null
  startDate: string
  expectedCheckoutDate: string
  expectedReturnDate: string
  status: string
  notes?: string | null
  rental?: { id: string; rentalNumber: string; status: string } | null
  items: V2ReservationItem[]
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface V2RentalItem {
  id: string
  itemId: string
  barcodeValue?: string | null
  agreedRentalPrice?: number | null
  notes?: string | null
  item?: {
    id: string
    internalCode: string
    displayName: string
    status: string
    lifecycleState: string
    rentalPrice: number
  } | null
}

export interface V2Rental {
  id: string
  rentalNumber: string
  customerId: string
  reservationId?: string | null
  customer?: {
    id: string
    customerNumber: string
    fullName: string
    status: string
  } | null
  rentalDate: string
  expectedReturnDate: string
  actualReturnDate?: string | null
  status: string
  notes?: string | null
  items: V2RentalItem[]
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface V2SettlementAdjustment {
  id: string
  amountFils: number
  reason: string
  status?: string
  createdAt: string
}

export interface V2SettlementPaymentHistory {
  id: string
  amountFils?: number | null
  paymentId?: string | null
  action?: string
  reason?: string | null
  createdAt: string
  username?: string | null
}

export interface V2Settlement {
  id: string
  settlementNumber: string
  rentalId: string
  rental?: { id: string; rentalNumber: string; status: string } | null
  accountId?: string | null
  customerId?: string | null
  chargeFils: number
  depositFils: number
  lateFeeFils: number
  adjustmentFils: number
  discountFils: number
  refundFils: number
  totalFils: number
  paidFils: number
  remainingFils: number
  totalMajor?: string
  paidMajor?: string
  remainingMajor?: string
  status: string
  currency?: string
  notes?: string | null
  closedAt?: string | null
  cancelledAt?: string | null
  refunds?: Array<{
    id: string
    amountFils: number
    reason: string
    createdAt: string
  }>
  adjustments?: V2SettlementAdjustment[]
  discounts?: Array<{ id: string; amountFils: number; reason: string; createdAt: string }>
  lateFees?: Array<{ id: string; computedFils: number; reason: string; createdAt: string }>
  history?: V2SettlementPaymentHistory[]
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface V2Payment {
  id: string
  paymentNumber?: string
  accountId: string
  settlementId?: string | null
  amountFils: number
  amountMajor?: string
  method?: string | null
  status: string
  notes?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface V2FinanceAccount {
  id: string
  accountNumber: string
  customerId: string
  currency: string
  status: string
  balanceFils?: number
  outstandingFils?: number
  createdAt: string
  updatedAt: string
}

export interface V2DashboardReport {
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

export interface V2FinancialReport {
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

export interface V2MediaFile {
  id: string
  originalFilename: string
  storedFilename: string
  extension: string
  mimeType: string
  sizeBytes: number
  checksum?: string
  width?: number | null
  height?: number | null
  orientation?: string | null
  kind?: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  uploadedBy?: string | null
}

export interface V2Health {
  status: string
  version: string
  database: string
  uptime: number
  environment: string
}

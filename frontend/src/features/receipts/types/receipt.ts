import type { SaleDto } from '@/features/pos/api/salesApi'
import type { RentalDto } from '@/features/rentals/api/api'
import type { SettlementDto } from '@/features/settlements/api/api'

/** Receipt paper widths in millimetres. */
export type ReceiptPaperWidth = 58 | 80

export type ReceiptEntityKind = 'sale' | 'rental' | 'payment' | 'refund' | 'settlement'

export interface ReceiptStoreInfo {
  name: string
  address: string
  phone: string
  taxId: string
  footer: string
  logoDataUrl: string | null
}

export interface ReceiptCustomer {
  name: string
  phone: string
  customerNumber: string
}

export interface ReceiptItemLine {
  name: string
  code: string
  barcode: string | null
  quantity: number
  unitPriceFils: number
  discountFils: number
  lineTotalFils: number
}

export interface ReceiptTotals {
  subtotalFils: number
  discountFils: number
  depositFils: number
  paidFils: number
  outstandingFils: number
  totalFils: number
  lateFeeFils: number
  refundFils: number
}

export interface ReceiptData {
  kind: ReceiptEntityKind
  receiptNumber: string
  entityId: string
  createdAt: string
  cashierName: string
  paymentMethod: string | null
  store: ReceiptStoreInfo
  customer: ReceiptCustomer | null
  items: ReceiptItemLine[]
  totals: ReceiptTotals
  /** Rental-specific fields (rental receipts only). */
  rental?: {
    rentalDate: string
    expectedReturnDate: string
    actualReturnDate: string | null
    periodLabel: string
  }
  /** Payment/refund/settlement-receipt metadata (financial kinds only). */
  financial?: {
    paymentNumber?: string
    settlementNumber?: string
    settlementStatus?: string
    entityLabel?: string
    method?: string
    notes?: string
  }
  source: { sale?: SaleDto; rental?: RentalDto; settlement?: SettlementDto } | null
}

export interface ReceiptSettings {
  paperWidth: ReceiptPaperWidth
  fontSize: 'sm' | 'md' | 'lg'
  lineHeight: 'tight' | 'normal' | 'relaxed'
  /** Show/hide sections. */
  showLogo: boolean
  showStoreInfo: boolean
  showHeaderText: boolean
  headerText: string
  showBarcode: boolean
  showCashier: boolean
  showCustomer: boolean
  showItemCodes: boolean
  showPrices: boolean
  showSubtotal: boolean
  showDiscount: boolean
  showDeposit: boolean
  showPaid: boolean
  showOutstanding: boolean
  footerText: string
  returnPolicyText: string
  showSeparatorLine: boolean
  fontFamily: string
  /** Store branding (persisted in localStorage only). */
  store: ReceiptStoreInfo
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  paperWidth: 80,
  fontSize: 'md',
  lineHeight: 'normal',
  showLogo: true,
  showStoreInfo: true,
  showHeaderText: true,
  headerText: 'إيصال',
  showBarcode: true,
  showCashier: true,
  showCustomer: true,
  showItemCodes: true,
  showPrices: true,
  showSubtotal: true,
  showDiscount: true,
  showDeposit: true,
  showPaid: true,
  showOutstanding: true,
  footerText: 'شكراً لتعاملكم معنا',
  returnPolicyText: 'الاسترجاع خلال 24 ساعة بشرط سلامة القطعة وإبراز الإيصال',
  showSeparatorLine: true,
  fontFamily: 'IBM Plex Sans Arabic, system-ui, sans-serif',
  store: {
    name: 'جمان',
    address: '',
    phone: '',
    taxId: '',
    footer: 'شكراً لتعاملكم معنا',
    logoDataUrl: null,
  },
}

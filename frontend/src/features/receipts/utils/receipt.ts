import type { SaleDto } from '@/features/pos/api/salesApi'
import type { RentalDto } from '@/features/rentals/api/api'
import type { SettlementDto } from '@/features/settlements/api/api'
import type {
  ReceiptData,
  ReceiptItemLine,
  ReceiptSettings,
  ReceiptTotals,
} from '../types/receipt'
import { DEFAULT_RECEIPT_SETTINGS } from '../types/receipt'

/** Minimal settlement shape shared by SaleDto and RentalDto */
interface MinimalSettlement {
  depositFils?: number
  lateFeeFils?: number
  refundFils?: number
  adjustmentFils?: number
  paidFils?: number
  remainingFils?: number
  totalFils?: number
  payments?: Array<{
    status: string
    method: string
  }>
}

/** Receipts are Arabic-first, but technical values must stay LTR. */
export const RTL_TEXT_STYLE = 'direction: rtl; unicode-bidi: embed;'
export const LTR_TEXT_STYLE = 'direction: ltr; unicode-bidi: embed; text-align: left;'

export function formatFils(fils: number | null | undefined): string {
  if (fils === null || fils === undefined || Number.isNaN(fils)) return '0.00'
  return (fils / 1000).toFixed(2)
}

export function formatReceiptDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatReceiptNumber(value: string | null | undefined): string {
  return value ?? '—'
}

/** IQD currency label used on receipts. */
export function currencyLabel(): string {
  return 'د.ع'
}

/** Escape untrusted text before injecting into the printable HTML surface. */
export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Extract payment method from settlement payments.
 * Returns the method of the most recent completed payment, or null.
 */
function extractPaymentMethod(settlement: MinimalSettlement | null | undefined): string | null {
  if (!settlement?.payments?.length) return null
  const completedPayments = settlement.payments.filter(p => p.status === 'completed')
  if (!completedPayments.length) return null
  return completedPayments[completedPayments.length - 1].method ?? null
}

/**
 * Extract deposit from settlement.
 */
function extractDepositFils(settlement: MinimalSettlement | null | undefined): number {
  return settlement?.depositFils ?? 0
}

/**
 * Extract late fee from settlement.
 */
function extractLateFeeFils(settlement: MinimalSettlement | null | undefined): number {
  return settlement?.lateFeeFils ?? 0
}

/**
 * Extract refund from settlement.
 */
function extractRefundFils(settlement: MinimalSettlement | null | undefined): number {
  return settlement?.refundFils ?? 0
}

/**
 * Extract adjustment from settlement.
 */
function extractAdjustmentFils(settlement: MinimalSettlement | null | undefined): number {
  return settlement?.adjustmentFils ?? 0
}

const DEFAULT_STORE = {
  name: 'جمان',
  address: '',
  phone: '',
  taxId: '',
  footer: 'شكراً لتعاملكم معنا',
  logoDataUrl: null,
}

/**
 * Build a full receipt from a completed Sale.
 * Money values come from the backend DTO — never recomputed.
 */
export function buildSaleReceipt(
  sale: SaleDto,
  settings: ReceiptSettings,
  cashierName: string,
  store: Partial<ReceiptData['store']> = {},
): ReceiptData {
  const items: ReceiptItemLine[] = (sale.items ?? []).map((line) => ({
    name: line.itemNameSnapshot ?? line.item?.displayName ?? line.itemId,
    code: line.item?.internalCode ?? line.itemId,
    barcode: line.barcodeSnapshot ?? line.barcode ?? null,
    quantity: line.quantity ?? 1,
    unitPriceFils: line.priceFils ?? 0,
    discountFils: line.discountFils ?? 0,
    lineTotalFils: line.totalFils ?? (line.priceFils ?? 0) - (line.discountFils ?? 0),
  }))

  const totals: ReceiptTotals = {
    subtotalFils: sale.subtotalFils ?? 0,
    discountFils: sale.discountFils ?? 0,
    depositFils: extractDepositFils(sale.settlement as MinimalSettlement | null | undefined),
    lateFeeFils: extractLateFeeFils(sale.settlement as MinimalSettlement | null | undefined),
    refundFils: extractRefundFils(sale.settlement as MinimalSettlement | null | undefined),
    paidFils: sale.settlement?.paidFils ?? 0,
    outstandingFils: sale.settlement?.remainingFils ?? 0,
    totalFils: sale.totalFils ?? 0,
  }

  return {
    kind: 'sale',
    receiptNumber: sale.saleNumber,
    entityId: sale.id,
    createdAt: sale.completedAt ?? sale.createdAt,
    cashierName,
    paymentMethod: extractPaymentMethod(sale.settlement as MinimalSettlement | null | undefined),
    store: { ...DEFAULT_STORE, ...store },
    customer: sale.customer
      ? {
          name: sale.customer.fullName,
          phone: sale.customer.phone,
          customerNumber: sale.customer.customerNumber,
        }
      : null,
    items,
    totals,
    source: { sale },
  }
}

/**
 * Build a full receipt from a Rental.
 * All money fields come from the backend settlement — never recomputed.
 */
export function buildRentalReceipt(
  rental: RentalDto,
  settings: ReceiptSettings,
  cashierName: string,
  store: Partial<ReceiptData['store']> = {},
): ReceiptData {
  const items: ReceiptItemLine[] = (rental.items ?? []).map((line) => ({
    name: line.item?.displayName ?? line.itemId,
    code: line.item?.internalCode ?? line.itemId,
    barcode: line.barcode ?? null,
    quantity: 1,
    unitPriceFils: line.agreedRentalPrice ?? 0,
    discountFils: 0,
    lineTotalFils: line.agreedRentalPrice ?? 0,
  }))

  const settlement = rental.settlement as MinimalSettlement | null | undefined
  const totals: ReceiptTotals = {
    subtotalFils: rental.settlement?.totalFils ?? items.reduce((sum, i) => sum + i.lineTotalFils, 0),
    discountFils: 0,
    depositFils: extractDepositFils(settlement),
    lateFeeFils: extractLateFeeFils(settlement),
    refundFils: extractRefundFils(settlement),
    paidFils: rental.settlement?.paidFils ?? 0,
    outstandingFils: Math.max(0, (rental.settlement?.totalFils ?? 0) - (rental.settlement?.paidFils ?? 0)),
    totalFils: rental.settlement?.totalFils ?? items.reduce((sum, i) => sum + i.lineTotalFils, 0),
  }

  const start = new Date(rental.rentalDate)
  const end = new Date(rental.expectedReturnDate)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))

  return {
    kind: 'rental',
    receiptNumber: rental.rentalNumber,
    entityId: rental.id,
    createdAt: rental.createdAt,
    cashierName,
    paymentMethod: extractPaymentMethod(settlement),
    store: { ...DEFAULT_STORE, ...store },
    customer: rental.customer
      ? {
          name: rental.customer.fullName,
          phone: rental.customer.phone,
          customerNumber: rental.customer.id,
        }
      : null,
    items,
    totals,
    rental: {
      rentalDate: rental.rentalDate,
      expectedReturnDate: rental.expectedReturnDate,
      actualReturnDate: rental.actualReturnDate ?? null,
      periodLabel: `${days} يوم`,
    },
    source: { rental },
  }
}

export interface FinancialReceiptInput {
  /** The original sale/rental to reuse customer + reference number. */
  sale?: SaleDto | null
  rental?: RentalDto | null
  /** The settlement this payment/refund/settlement applies to. */
  settlement?: SettlementDto | null
  /** Latest completed payment on the settlement (for payment receipts). */
  payment?: {
    paymentNumber?: string
    amountFils?: number
    method?: string
    notes?: string
  } | null
  /** Custom reference line shown in place of a sale/rental number. */
  entityLabel?: string
}

function customerFromSettlement(settlement: SettlementDto | null | undefined, sale?: SaleDto | null, rental?: RentalDto | null) {
  const c = settlement?.account?.customer
  const s = sale?.customer
  const r = rental?.customer
  if (c) return { name: c.fullName, phone: c.phone, customerNumber: c.id }
  if (s) return { name: s.fullName, phone: s.phone, customerNumber: s.customerNumber }
  if (r) return { name: r.fullName, phone: r.phone, customerNumber: r.id }
  return null
}

/**
 * Build a payment receipt from a settlement + payment record.
 * Money values come from the backend DTO — never recomputed.
 */
export function buildPaymentReceiptData(
  input: FinancialReceiptInput,
  settings: ReceiptSettings,
  cashierName: string,
  store: Partial<ReceiptData['store']> = {},
): ReceiptData {
  const settlement = input.settlement
  const paymentAmountFils = input.payment?.amountFils ?? settlement?.paidFils ?? 0

  const referenceLabel = input.entityLabel ?? input.sale?.saleNumber ?? input.rental?.rentalNumber ?? ''

  const totals: ReceiptTotals = {
    subtotalFils: 0,
    discountFils: 0,
    depositFils: extractDepositFils(settlement as MinimalSettlement | null | undefined),
    lateFeeFils: extractLateFeeFils(settlement as MinimalSettlement | null | undefined),
    refundFils: extractRefundFils(settlement as MinimalSettlement | null | undefined),
    paidFils: settlement?.paidFils ?? 0,
    outstandingFils: settlement?.remainingFils ?? 0,
    totalFils: paymentAmountFils,
  }

  return {
    kind: 'payment',
    receiptNumber: input.payment?.paymentNumber ?? settlement?.settlementNumber ?? referenceLabel,
    entityId: settlement?.id ?? input.sale?.id ?? input.rental?.id ?? '',
    createdAt: input.payment ? new Date().toISOString() : (settlement?.updatedAt ?? new Date().toISOString()),
    cashierName,
    paymentMethod: input.payment?.method ?? extractPaymentMethod(settlement as MinimalSettlement | null | undefined),
    store: { ...DEFAULT_STORE, ...store },
    customer: customerFromSettlement(settlement, input.sale, input.rental),
    items: [],
    totals,
    financial: {
      paymentNumber: input.payment?.paymentNumber,
      settlementNumber: settlement?.settlementNumber,
      settlementStatus: settlement?.status,
      entityLabel: referenceLabel || undefined,
      method: input.payment?.method,
      notes: input.payment?.notes,
    },
    source: { sale: input.sale ?? undefined, rental: input.rental ?? undefined, settlement: settlement ?? undefined },
  }
}

/**
 * Build a refund receipt from a settlement + refund record.
 * Money values come from the backend DTO — never recomputed.
 */
export function buildRefundReceiptData(
  input: FinancialReceiptInput,
  refund: { amountFils: number; reason?: string | null },
  settings: ReceiptSettings,
  cashierName: string,
  store: Partial<ReceiptData['store']> = {},
): ReceiptData {
  const settlement = input.settlement
  const referenceLabel = input.entityLabel ?? input.sale?.saleNumber ?? input.rental?.rentalNumber ?? ''

  const totals: ReceiptTotals = {
    subtotalFils: 0,
    discountFils: 0,
    depositFils: extractDepositFils(settlement as MinimalSettlement | null | undefined),
    lateFeeFils: extractLateFeeFils(settlement as MinimalSettlement | null | undefined),
    refundFils: refund.amountFils,
    paidFils: settlement?.paidFils ?? 0,
    outstandingFils: settlement?.remainingFils ?? 0,
    totalFils: refund.amountFils,
  }

  return {
    kind: 'refund',
    receiptNumber: settlement?.settlementNumber ?? referenceLabel,
    entityId: settlement?.id ?? input.sale?.id ?? input.rental?.id ?? '',
    createdAt: new Date().toISOString(),
    cashierName,
    paymentMethod: extractPaymentMethod(settlement as MinimalSettlement | null | undefined),
    store: { ...DEFAULT_STORE, ...store },
    customer: customerFromSettlement(settlement, input.sale, input.rental),
    items: [],
    totals,
    financial: {
      settlementNumber: settlement?.settlementNumber,
      settlementStatus: settlement?.status,
      entityLabel: referenceLabel || undefined,
      notes: refund.reason ?? 'مردود',
    },
    source: { sale: input.sale ?? undefined, rental: input.rental ?? undefined, settlement: settlement ?? undefined },
  }
}

/**
 * Build a settlement summary receipt from a Settlement DTO.
 * Money values come from the backend DTO — never recomputed.
 */
export function buildSettlementReceiptData(
  settlement: SettlementDto,
  settings: ReceiptSettings,
  cashierName: string,
  store: Partial<ReceiptData['store']> = {},
): ReceiptData {
  const totals: ReceiptTotals = {
    subtotalFils: settlement.chargeFils,
    discountFils: settlement.discountFils,
    depositFils: settlement.depositFils,
    lateFeeFils: settlement.lateFeeFils,
    refundFils: settlement.refundFils,
    paidFils: settlement.paidFils,
    outstandingFils: settlement.remainingFils,
    totalFils: settlement.totalFils,
  }

  const referenceLabel = settlement.sale?.saleNumber ?? settlement.rental?.rentalNumber ?? settlement.entityId

  return {
    kind: 'settlement',
    receiptNumber: settlement.settlementNumber,
    entityId: settlement.id,
    createdAt: settlement.updatedAt ?? settlement.createdAt,
    cashierName,
    paymentMethod: extractPaymentMethod(settlement as unknown as MinimalSettlement),
    store: { ...DEFAULT_STORE, ...store },
    customer: customerFromSettlement(settlement),
    items: [],
    totals,
    financial: {
      settlementNumber: settlement.settlementNumber,
      settlementStatus: settlement.status,
      entityLabel: referenceLabel,
    },
    source: { settlement },
  }
}

export function settingsToCss(settings: ReceiptSettings): {  widthMm: number
  fontSizePx: number
  lineHeight: number
  bodyFontSizePx: number
} {
  const widthMm = settings.paperWidth === 58 ? 58 : 80
  const fontSizePx = settings.fontSize === 'sm' ? 11 : settings.fontSize === 'lg' ? 15 : 13
  const lineHeight = settings.lineHeight === 'tight' ? 1.15 : settings.lineHeight === 'relaxed' ? 1.6 : 1.35
  return { widthMm, fontSizePx, lineHeight, bodyFontSizePx: Math.round(fontSizePx * 0.92) }
}

export function isDefaultSettings(settings: ReceiptSettings): boolean {
  return JSON.stringify(settings) === JSON.stringify(DEFAULT_RECEIPT_SETTINGS)
}
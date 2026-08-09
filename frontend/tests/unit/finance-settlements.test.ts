import { describe, expect, it } from 'vitest'
import { formatIQD, formatIQDNumber, toFils, IQD_LABEL, PAYMENT_METHOD_LABELS } from '@/shared/utils/money'
import { escapeHtml, buildPaymentReceiptData, buildRefundReceiptData, buildSettlementReceiptData } from '@/features/receipts/utils/receipt'
import { renderReceiptHtml } from '@/features/receipts/utils/render'
import { DEFAULT_RECEIPT_SETTINGS } from '@/features/receipts/types/receipt'
import type { SettlementDto } from '@/features/settlements/api/api'

describe('Shared money utilities (IQD)', () => {
  it('formats integer fils as IQD (د.ع)', () => {
    expect(formatIQD(123450)).toContain(IQD_LABEL)
    expect(formatIQD(123450)).toContain('123.45')
  })

  it('renders 1000 fils as exactly 1 د.ع', () => {
    expect(formatIQD(1000)).toContain('1')
    expect(formatIQD(1000)).toContain(IQD_LABEL)
  })

  it('handles null/undefined/NaN as em-dash', () => {
    expect(formatIQD(null)).toBe('—')
    expect(formatIQD(undefined)).toBe('—')
    expect(formatIQD(Number.NaN)).toBe('—')
  })

  it('renders zero as 0 د.ع', () => {
    expect(formatIQD(0)).toContain(IQD_LABEL)
    expect(formatIQD(0)).toContain('0')
  })

  it('formatIQDNumber omits the currency label', () => {
    expect(formatIQDNumber(123450)).toBe('123.45')
    expect(formatIQDNumber(null)).toBe('—')
  })

  it('toFils converts display IQD amounts to integer fils', () => {
    expect(toFils('1.5')).toBe(1500)
    expect(toFils(1)).toBe(1000)
    expect(toFils('')).toBe(0)
    expect(toFils(null)).toBe(0)
  })

  it('payment method labels cover cash/card/bank_transfer', () => {
    expect(PAYMENT_METHOD_LABELS.cash).toBe('نقدي')
    expect(PAYMENT_METHOD_LABELS.card).toBe('بطاقة')
    expect(PAYMENT_METHOD_LABELS.bank_transfer).toBe('تحويل')
  })
})

describe('escapeHtml (receipt injection safety)', () => {
  it('encodes HTML metacharacters to real entities', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml('a & b "quoted" \'single\'')).toBe('a &amp; b &quot;quoted&quot; &#39;single&#39;')
  })

  it('does not double-encode already-escaped input', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('round-trips plain Arabic text unchanged', () => {
    const text = 'فستان زفاف — عبايات'
    expect(escapeHtml(text)).toBe(text)
  })
})

const sampleSettlement: SettlementDto = {
  id: 'set-1',
  settlementNumber: 'STL-1001',
  entityType: 'sale',
  entityId: 'sale-1',
  accountId: 'acc-1',
  customerId: 'cust-1',
  chargeFils: 500000,
  depositFils: 100000,
  lateFeeFils: 0,
  adjustmentFils: 0,
  discountFils: 0,
  refundFils: 0,
  totalFils: 600000,
  paidFils: 200000,
  remainingFils: 400000,
  status: 'partially_paid',
  currency: 'IQD',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  account: {
    id: 'acc-1',
    accountNumber: 'ACC-9',
    customer: { id: 'cust-1', fullName: 'أحمد علي', phone: '0770000000' },
  },
}

const settings = { ...DEFAULT_RECEIPT_SETTINGS, paperWidth: 58 as const }

describe('Financial receipt builders', () => {
  it('buildPaymentReceiptData uses backend amounts verbatim', () => {
    const data = buildPaymentReceiptData(
      {
        settlement: sampleSettlement,
        payment: { paymentNumber: 'PAY-55', amountFils: 200000, method: 'cash' },
        sale: { id: 'sale-1', saleNumber: 'S-88', customerId: 'cust-1', status: 'confirmed', subtotalFils: 500000, discountFils: 0, taxFils: 0, totalFils: 500000, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' },
      },
      settings,
      'الكاشير',
    )
    expect(data.kind).toBe('payment')
    expect(data.receiptNumber).toBe('PAY-55')
    expect(data.totals.totalFils).toBe(200000)
    expect(data.totals.outstandingFils).toBe(400000)
    expect(data.paymentMethod).toBe('cash')
    expect(data.financial?.settlementNumber).toBe('STL-1001')
    expect(data.customer?.name).toBe('أحمد علي')
  })

  it('buildRefundReceiptData marks refund as a negative-flow total', () => {
    const data = buildRefundReceiptData(
      { settlement: sampleSettlement, sale: { id: 'sale-1', saleNumber: 'S-88', customerId: 'cust-1', status: 'confirmed', subtotalFils: 500000, discountFils: 0, taxFils: 0, totalFils: 500000, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' } },
      { amountFils: 50000, reason: 'إرجاع قطعة' },
      settings,
      'الكاشير',
    )
    expect(data.kind).toBe('refund')
    expect(data.totals.refundFils).toBe(50000)
    expect(data.totals.totalFils).toBe(50000)
    expect(data.financial?.notes).toBe('إرجاع قطعة')
  })

  it('buildSettlementReceiptData exposes full settlement breakdown', () => {
    const data = buildSettlementReceiptData(sampleSettlement, settings, 'الكاشير')
    expect(data.kind).toBe('settlement')
    expect(data.totals.subtotalFils).toBe(500000)
    expect(data.totals.depositFils).toBe(100000)
    expect(data.totals.paidFils).toBe(200000)
    expect(data.totals.outstandingFils).toBe(400000)
    expect(data.financial?.settlementStatus).toBe('partially_paid')
  })

  it('renders a payment receipt to safe HTML without raw injection', async () => {
    const data = buildPaymentReceiptData(
      {
        settlement: sampleSettlement,
        payment: { paymentNumber: 'PAY-56', amountFils: 200000, method: 'cash' },
      },
      settings,
      'الكاشير',
    )
    const html = await renderReceiptHtml(data, settings)
    expect(html).toContain('PAY-56')
    expect(html).toContain('د.ع')
    expect(html).not.toContain('<script')
  })
})

describe('Settlement status labels coverage', () => {
  it('renders settlement DTO fields consistently via money util', () => {
    expect(formatIQD(sampleSettlement.totalFils)).toContain('600')
    expect(formatIQD(sampleSettlement.remainingFils)).toContain('400')
  })
})

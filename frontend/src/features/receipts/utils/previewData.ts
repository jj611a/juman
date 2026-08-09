import type { ReceiptData } from '../types/receipt'

/**
 * ISOLATED preview data used ONLY by the receipt settings page live preview.
 * Clearly separated from production transaction data — never rendered against
 * real sales/rentals. Money values are cosmetic and marked in the UI as
 * "معاينة".
 */
export function buildPreviewReceiptData(): ReceiptData {
  return {
    kind: 'sale',
    receiptNumber: 'SALE-00012345',
    entityId: 'preview-sale',
    createdAt: new Date().toISOString(),
    cashierName: 'أمين الصندوق (معاينة)',
    paymentMethod: 'نقدي',
    store: {
      name: 'جمان',
      address: 'بغداد - شارع الكرادة',
      phone: '0770 000 0000',
      taxId: 'IQ0000000000',
      footer: 'شكراً لتعاملكم معنا',
      logoDataUrl: null,
    },
    customer: {
      name: 'عميل المعاينة',
      phone: '0771 111 1111',
      customerNumber: 'CUS-00000042',
    },
    items: [
      {
        name: 'فستان زفاف كلاسيكي',
        code: 'DR-0001',
        barcode: '1000001234567',
        quantity: 1,
        unitPriceFils: 250_000,
        discountFils: 0,
        lineTotalFils: 250_000,
      },
      {
        name: 'طقم إكسسوارات عرائس',
        code: 'AC-0042',
        barcode: '1000007654321',
        quantity: 1,
        unitPriceFils: 75_000,
        discountFils: 5_000,
        lineTotalFils: 70_000,
      },
    ],
    totals: {
      subtotalFils: 325_000,
      discountFils: 5_000,
      depositFils: 0,
      lateFeeFils: 0,
      refundFils: 0,
      paidFils: 320_000,
      outstandingFils: 0,
      totalFils: 320_000,
    },
    source: null,
  }
}

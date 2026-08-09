import type { ReceiptData, ReceiptSettings } from '../types/receipt'
import { escapeHtml, settingsToCss, formatFils, formatReceiptDate, currencyLabel } from './receipt'

/**
 * Serialize a receipt to a self-contained printable HTML document.
 * The renderer builds HTML and hands it to Main via receipt:print — the
 * renderer never touches native printer APIs.
 */
export async function renderReceiptHtml(
  data: ReceiptData,
  settings: ReceiptSettings,
): Promise<string> {
  const css = settingsToCss(settings)
  const widthPx = Math.round((css.widthMm * 96) / 25.4)

  const t = data.totals
  const rows: string[] = []

  const row = (label: string, value: string, mono = false) =>
    `<div class="r"><span>${escapeHtml(label)}</span><span class="${mono ? 'm' : ''}">${escapeHtml(value)}</span></div>`

  if (settings.showLogo && data.store.logoDataUrl) {
    rows.push(`<div class="c"><img src="${data.store.logoDataUrl}" class="logo"/></div>`)
  }
  if (settings.showStoreInfo) {
    rows.push(`<div class="c b">${escapeHtml(data.store.name)}</div>`)
    if (data.store.address) rows.push(`<div class="c s">${escapeHtml(data.store.address)}</div>`)
    if (data.store.phone) rows.push(`<div class="c s ltr">${escapeHtml(data.store.phone)}</div>`)
    if (data.store.taxId) rows.push(`<div class="c s">ض.ت: ${escapeHtml(data.store.taxId)}</div>`)
  }
  rows.push('<div class="hr"></div>')
  if (settings.showHeaderText) {
    rows.push(`<div class="c b t1">${escapeHtml(settings.headerText)}</div>`)
  }
  rows.push(row('رقم الإيصال', data.receiptNumber, true))
  rows.push(row('التاريخ', formatReceiptDate(data.createdAt), true))
  if (settings.showCashier) rows.push(row('الكاشير', data.cashierName || '—'))
  if (data.paymentMethod) rows.push(row('طريقة الدفع', data.paymentMethod))
  if (data.kind === 'rental' && data.rental) {
    rows.push(row('تاريخ التسليم', formatReceiptDate(data.rental.rentalDate), true))
    rows.push(row('تاريخ الإرجاع', formatReceiptDate(data.rental.expectedReturnDate), true))
    rows.push(row('مدة الإيجار', data.rental.periodLabel))
  }
  if (data.financial) {
    if (data.financial.settlementNumber) rows.push(row('التسوية', data.financial.settlementNumber, true))
    if (data.financial.entityLabel) rows.push(row('المرجع', data.financial.entityLabel))
    if (data.financial.method) rows.push(row('الطريقة', data.financial.method))
    if (data.financial.notes) rows.push(row('ملاحظات', data.financial.notes))
  }
  rows.push('<div class="hr"></div>')

  if (settings.showCustomer && data.customer) {
    rows.push('<div class="b">العميل</div>')
    rows.push(row('الاسم', data.customer.name))
    rows.push(row('الهاتف', data.customer.phone, true))
    rows.push(row('رقم العميل', data.customer.customerNumber, true))
    rows.push('<div class="hr"></div>')
  }

  const isFinancial = data.kind === 'payment' || data.kind === 'refund' || data.kind === 'settlement'

  if (!isFinancial || data.items.length > 0) {
    rows.push('<div class="b">الأصناف</div>')
    data.items.forEach((line, idx) => {
      rows.push(`<div class="it">`)
      rows.push(`<div class="b">${escapeHtml(line.name)}</div>`)
      if (settings.showItemCodes) {
        rows.push(
          `<div class="ltr s">${escapeHtml(line.code)}${settings.showBarcode && line.barcode ? ` · ${escapeHtml(line.barcode)}` : ''}</div>`,
        )
      }
      rows.push(
        `<div class="r"><span>${line.quantity} × ${escapeHtml(formatFils(line.unitPriceFils))}${line.discountFils > 0 ? ` (خصم ${escapeHtml(formatFils(line.discountFils))})` : ''}</span><span class="m">${escapeHtml(formatFils(line.lineTotalFils))}</span></div>`,
      )
      rows.push('</div>')
      if (idx < data.items.length - 1) rows.push('<div class="hr"></div>')
    })
    rows.push('<div class="hr"></div>')
  }

  if (settings.showSubtotal) rows.push(row('المجموع الفرعي', formatFils(t.subtotalFils), true))
  if (settings.showDiscount && t.discountFils > 0) rows.push(row('الخصم', `-${formatFils(t.discountFils)}`, true))
  if (settings.showDeposit && t.depositFils > 0) rows.push(row('التأمين', formatFils(t.depositFils), true))
  if (t.lateFeeFils > 0) rows.push(row('غرامة تأخير', formatFils(t.lateFeeFils), true))
  if (t.refundFils > 0) rows.push(row('مردود', `-${formatFils(t.refundFils)}`, true))
  rows.push(row('الإجمالي', `${formatFils(t.totalFils)} ${currencyLabel()}`, true))
  if (settings.showPaid) rows.push(row('المدفوع', formatFils(t.paidFils), true))
  if (settings.showOutstanding && t.outstandingFils > 0) rows.push(row('المتبقي', formatFils(t.outstandingFils), true))
  rows.push('<div class="hr"></div>')

  const footerTexts = [settings.footerText, settings.returnPolicyText, data.store.footer].filter(Boolean)
  if (footerTexts.length > 0) {
    rows.push(`<div class="c s">${footerTexts.map(escapeHtml).join('<br/>')}</div>`)
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(data.receiptNumber)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    width: ${widthPx}px;
    margin: 0 auto;
    color: #000;
    font-family: ${settings.fontFamily};
    font-size: ${css.bodyFontSizePx}px;
    line-height: ${css.lineHeight};
    padding: 6px;
  }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .s { font-size: 0.9em; }
  .t1 { font-size: 1.15em; }
  .ltr { direction: ltr; unicode-bidi: embed; text-align: right; font-family: monospace; }
  .m { direction: ltr; unicode-bidi: embed; font-variant-numeric: tabular-nums; font-weight: 700; }
  .hr { border-top: 1px dashed #000; margin: 4px 0; }
  .r { display: flex; justify-content: space-between; gap: 4px; }
  .it { margin: 3px 0; }
  .logo { max-height: 48px; max-width: 120px; object-fit: contain; }
</style>
</head>
<body>
${rows.join('\n')}
</body>
</html>`
}

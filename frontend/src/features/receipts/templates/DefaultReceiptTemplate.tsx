import type { ReactNode } from 'react'
import type { ReceiptData, ReceiptSettings } from '../types/receipt'
import { settingsToCss, formatFils, formatReceiptDate, formatReceiptNumber, currencyLabel } from '../utils/receipt'

export interface ReceiptTemplateProps {
  data: ReceiptData
  settings: ReceiptSettings
  /** Extra preview wrapper (used to inject the tailwind CDN/print media in the settings preview). */
  renderFor?: 'preview' | 'print'
}

/**
 * Base printable surface. Width adapts to 58mm / 80mm thermal paper.
 * Technical values (barcode, receipt number, phone) are forced LTR so Arabic
 * RTL does not corrupt them.
 */
export function ReceiptSurface({ data, settings, children }: {
  data: ReceiptData
  settings: ReceiptSettings
  children: ReactNode
}) {
  const css = settingsToCss(settings)
  return (
    <div
      dir="rtl"
      style={{
        width: `${css.widthMm}mm`,
        margin: '0 auto',
        background: '#ffffff',
        color: '#000000',
        fontFamily: settings.fontFamily,
        fontSize: `${css.bodyFontSizePx}px`,
        lineHeight: css.lineHeight,
        padding: '3mm',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', fontWeight: 700, margin: '2px 0' }}>
      {children}
    </div>
  )
}

function Divider({ show }: { show: boolean }) {
  if (!show) return null
  return <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
}

function Row({ label, value, mono = false }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
      <span>{label}</span>
      <span
        style={{
          ...(mono
            ? { direction: 'ltr', unicodeBidi: 'embed', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
            : {}),
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function ReceiptHeader({ data, settings }: Pick<ReceiptTemplateProps, 'data' | 'settings'>) {
  return (
    <>
      {settings.showLogo && data.store.logoDataUrl && (
        <div style={{ textAlign: 'center', marginBottom: '2px' }}>
          <img
            src={data.store.logoDataUrl}
            alt=""
            style={{ maxHeight: '12mm', maxWidth: '30mm', objectFit: 'contain' }}
          />
        </div>
      )}
      {settings.showStoreInfo && (
        <SectionHeader>{data.store.name}</SectionHeader>
      )}
      {settings.showStoreInfo && data.store.address && (
        <div style={{ textAlign: 'center', fontSize: '0.9em' }}>{data.store.address}</div>
      )}
      {settings.showStoreInfo && data.store.phone && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.9em',
            direction: 'ltr',
            unicodeBidi: 'embed',
          }}
        >
          {data.store.phone}
        </div>
      )}
      {settings.showStoreInfo && data.store.taxId && (
        <div style={{ textAlign: 'center', fontSize: '0.85em' }}>ض.ت: {data.store.taxId}</div>
      )}
      <Divider show={settings.showSeparatorLine} />
      {settings.showHeaderText && (
        <SectionHeader>
          <span style={{ fontSize: '1.15em' }}>{settings.headerText}</span>
        </SectionHeader>
      )}
    </>
  )
}

export function ReceiptMeta({ data, settings }: Pick<ReceiptTemplateProps, 'data' | 'settings'>) {
  return (
    <>
      <Row label="رقم الإيصال" value={formatReceiptNumber(data.receiptNumber)} mono />
      <Row label="التاريخ" value={formatReceiptDate(data.createdAt)} mono />
      {settings.showCashier && <Row label="الكاشير" value={data.cashierName || '—'} />}
      {data.paymentMethod && <Row label="طريقة الدفع" value={data.paymentMethod} />}
      {data.kind === 'rental' && data.rental && (
        <>
          <Row label="تاريخ التسليم" value={formatReceiptDate(data.rental.rentalDate)} mono />
          <Row label="تاريخ الإرجاع" value={formatReceiptDate(data.rental.expectedReturnDate)} mono />
          <Row label="مدة الإيجار" value={data.rental.periodLabel} />
        </>
      )}
      <Divider show={settings.showSeparatorLine} />
    </>
  )
}

export function ReceiptCustomerSection({ data, settings }: Pick<ReceiptTemplateProps, 'data' | 'settings'>) {
  if (!settings.showCustomer || !data.customer) return null
  return (
    <>
      <div style={{ fontWeight: 700, margin: '2px 0' }}>العميل</div>
      <Row label="الاسم" value={data.customer.name} />
      <Row label="الهاتف" value={data.customer.phone} mono />
      <Row label="رقم العميل" value={data.customer.customerNumber} mono />
      <Divider show={settings.showSeparatorLine} />
    </>
  )
}

export function ReceiptItems({ data, settings }: Pick<ReceiptTemplateProps, 'data' | 'settings'>) {
  return (
    <>
      <div style={{ fontWeight: 700, margin: '2px 0' }}>الأصناف</div>
      {data.items.map((line, idx) => (
        <div key={`${line.code}-${idx}`} style={{ margin: '3px 0' }}>
          <div style={{ fontWeight: 700 }}>{line.name}</div>
          {settings.showItemCodes && (
            <div
              style={{
                direction: 'ltr',
                unicodeBidi: 'embed',
                textAlign: 'right',
                fontSize: '0.85em',
                fontFamily: 'monospace',
              }}
            >
              {line.code}
              {settings.showBarcode && line.barcode ? ` · ${line.barcode}` : ''}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {line.quantity} × {formatFils(line.unitPriceFils)}
              {line.discountFils > 0 ? ` (خصم ${formatFils(line.discountFils)})` : ''}
            </span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatFils(line.lineTotalFils)}
            </span>
          </div>
        </div>
      ))}
      <Divider show={settings.showSeparatorLine} />
    </>
  )
}

export function ReceiptTotalsSection({ data, settings }: Pick<ReceiptTemplateProps, 'data' | 'settings'>) {
  const t = data.totals
  return (
    <>
      {settings.showSubtotal && <Row label="المجموع الفرعي" value={formatFils(t.subtotalFils)} mono />}
      {settings.showDiscount && t.discountFils > 0 && (
        <Row label="الخصم" value={`-${formatFils(t.discountFils)}`} mono />
      )}
      {settings.showDeposit && t.depositFils > 0 && (
        <Row label="التأمين" value={formatFils(t.depositFils)} mono />
      )}
      {t.lateFeeFils > 0 && <Row label="غرامة تأخير" value={formatFils(t.lateFeeFils)} mono />}
      {t.refundFils > 0 && <Row label="مردود" value={`-${formatFils(t.refundFils)}`} mono />}
      <Row label="الإجمالي" value={`${formatFils(t.totalFils)} ${currencyLabel()}`} mono />
      {settings.showPaid && <Row label="المدفوع" value={formatFils(t.paidFils)} mono />}
      {settings.showOutstanding && t.outstandingFils > 0 && (
        <Row label="المتبقي" value={formatFils(t.outstandingFils)} mono />
      )}
      <Divider show={settings.showSeparatorLine} />
    </>
  )
}

export function ReceiptFooter({ data, settings }: Pick<ReceiptTemplateProps, 'data' | 'settings'>) {
  const texts = [settings.footerText, settings.returnPolicyText, data.store.footer].filter(Boolean)
  if (texts.length === 0) return null
  return (
    <div style={{ textAlign: 'center', fontSize: '0.9em', marginTop: '4px' }}>
      {texts.map((t, i) => (
        <div key={i} style={{ margin: '1px 0' }}>{t}</div>
      ))}
    </div>
  )
}

/**
 * Default receipt template — Header / Meta / Customer / Items / Totals / Footer.
 * Kept as discrete components so alternate templates can compose them differently.
 */
export function DefaultReceiptTemplate({ data, settings }: ReceiptTemplateProps) {
  return (
    <ReceiptSurface data={data} settings={settings}>
      <ReceiptHeader data={data} settings={settings} />
      <ReceiptMeta data={data} settings={settings} />
      <ReceiptCustomerSection data={data} settings={settings} />
      <ReceiptItems data={data} settings={settings} />
      <ReceiptTotalsSection data={data} settings={settings} />
      <ReceiptFooter data={data} settings={settings} />
    </ReceiptSurface>
  )
}

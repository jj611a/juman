# Receipt System Design — Juman V2 Frontend

## Overview

The receipt system is a **reusable, extensible architecture** for generating, previewing, customizing, and printing thermal receipts. It is **not** a simple "print button" — it provides:

- Structured data model (TypeScript) derived from backend DTOs
- Sectioned template system (composable React components)
- Live customization page with isolated preview
- 58mm / 80mm thermal paper support
- RTL Arabic text with LTR technical values (barcode, numbers, phone)
- Print boundary via Electron IPC (renderer → preload → Main → `webContents.print`)
- Local-only settings persistence (no backend endpoint)

---

## 1. Data Model (`types/receipt.ts`)

### Core Types

```typescript
type ReceiptPaperWidth = 58 | 80
type ReceiptEntityKind = 'sale' | 'rental'

interface ReceiptStoreInfo {
  name: string
  address: string
  phone: string
  taxId: string
  footer: string
  logoDataUrl: string | null
}

interface ReceiptCustomer {
  name: string
  phone: string
  customerNumber: string
}

interface ReceiptItemLine {
  name: string
  code: string
  barcode: string | null
  quantity: number
  unitPriceFils: number
  discountFils: number
  lineTotalFils: number
}

interface ReceiptTotals {
  subtotalFils: number
  discountFils: number
  depositFils: number
  paidFils: number
  outstandingFils: number
  totalFils: number
  lateFeeFils: number
  refundFils: number
}

interface ReceiptData {
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
  rental?: {
    rentalDate: string
    expectedReturnDate: string
    actualReturnDate: string | null
    periodLabel: string
  }
  source: { sale?: SaleDto; rental?: RentalDto } | null
}
```

### Settings (Persisted in localStorage)

```typescript
interface ReceiptSettings {
  paperWidth: ReceiptPaperWidth
  fontSize: 'sm' | 'md' | 'lg'
  lineHeight: 'tight' | 'normal' | 'relaxed'
  // Section toggles (17 booleans)
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
  // Store branding
  store: ReceiptStoreInfo
}
```

---

## 2. Template System (`templates/DefaultReceiptTemplate.tsx`)

### Design Principles

1. **Composable sections** — Each visual block is a discrete function component (`ReceiptHeader`, `ReceiptMeta`, `ReceiptCustomerSection`, `ReceiptItems`, `ReceiptTotalsSection`, `ReceiptFooter`).
2. **Settings-driven** — Every section checks `settings.showXxx` before rendering.
3. **Extensible** — Alternate templates can reorder/replace sections by importing the section components.
4. **No business logic** — Templates receive `ReceiptData` and `ReceiptSettings` only; all money formatting happens in utils.

### Section Breakdown

| Section | Component | Settings Controls |
|---------|-----------|-------------------|
| Logo | `ReceiptHeader` | `showLogo`, `showStoreInfo`, `showHeaderText`, `headerText` |
| Store info | `ReceiptHeader` | `showStoreInfo` |
| Receipt meta | `ReceiptMeta` | `showCashier`, `paymentMethod` (auto), rental dates (auto) |
| Customer | `ReceiptCustomerSection` | `showCustomer` |
| Items table | `ReceiptItems` | `showItemCodes`, `showBarcode`, `showPrices` |
| Totals | `ReceiptTotalsSection` | `showSubtotal`, `showDiscount`, `showDeposit`, `showPaid`, `showOutstanding` |
| Footer | `ReceiptFooter` | `footerText`, `returnPolicyText`, `store.footer` |

### Printable Surface (`ReceiptSurface`)

```tsx
<div
  dir="rtl"
  style={{
    width: `${paperWidth}mm`,
    margin: '0 auto',
    background: '#fff',
    color: '#000',
    fontFamily: settings.fontFamily,
    fontSize: `${bodyFontSizePx}px`,
    lineHeight: lineHeight,
    padding: '3mm',
  }}
>
  {children}
</div>
```

- Width set in **millimetres** via CSS → maps directly to thermal paper.
- `paperWidth` 58 or 80 → `width: 58mm` / `80mm`.
- Font size derived from `fontSize` setting (`sm=11px`, `md=13px`, `lg=15px` body).

---

## 3. RTL / LTR Handling

**Rule:** Arabic text = RTL; technical values = LTR.

Implementation:
- Root `dir="rtl"` on `ReceiptSurface`.
- Technical values wrapped in `<span style={{direction: 'ltr', unicodeBidi: 'embed'}}>`:
  - Barcode values
  - Receipt numbers
  - Phone numbers
  - Money amounts (also `font-variant-numeric: tabular-nums` for alignment)
  - Item codes
- Section headers/labels remain RTL.

---

## 4. Receipt Builders (`utils/receipt.ts`)

```typescript
buildSaleReceipt(sale: SaleDto, settings, cashierName, store): ReceiptData
buildRentalReceipt(rental: RentalDto, settings, cashierName, store): ReceiptData
```

- **Never recompute money** — all fils values copied from backend DTOs.
- `subtotalFils`, `discountFils`, `taxFils`, `totalFils`, `paidFils`, `outstandingFils` come directly from `SaleDto` / `RentalDto.settlement`.
- Item lines map from `SaleItemDto` / `RentalItemDto` with snapshots.
- Rental period computed from `rentalDate` / `expectedReturnDate`.

---

## 5. Print Pipeline

### Renderer → Preload → Main

```
[React Component] 
  → useReceiptPrint.print(data, settings)
  → renderReceiptHtml(data, settings)  // self-contained HTML string
  → window.juman.receipt.print({html, paperWidthMm})
  → [Preload] ipcRenderer.invoke('receipt:print', payload)
  → [Main] ipcMain.handle('receipt:print')
  → create hidden BrowserWindow (sandboxed)
  → loadURL('data:text/html;base64,...')
  → webContents.print({silent:false, printBackground:true})
  → returns {success, cancelled?}
```

### Key Implementation Details

**`renderReceiptHtml()`** (`utils/render.ts`):
- Produces a **single HTML string** with inline `<style>` — no external CSS, no React.
- Uses same section logic as React template but as string concatenation.
- Escapes all dynamic content via `escapeHtml()`.
- Technical values get inline `direction: ltr; unicode-bidi: embed`.
- Returns `<!DOCTYPE html><html lang="ar" dir="rtl">...</html>`.

**Main handler** (`electron/main/ipc/register.ts`):
```typescript
const printWin = new BrowserWindow({
  width: Math.max(400, Math.min(1200, paperWidthMm * 8)),
  height: 1400,
  show: false,
  webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
})
await printWin.loadURL(dataUrl)
const result = await new Promise(resolve => {
  printWin.webContents.print({ silent: false, printBackground: true }, resolve)
})
printWin.destroy()
return ok(result)
```

- `silent: false` → OS print dialog appears (user selects printer).
- `printBackground: true` → ensures backgrounds/borders print.
- Hidden window (`show: false`) works on modern Electron; if print dialog doesn't appear, set `show: true` and minimize.

---

## 6. Customization Page (`/settings/receipts`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Title + Reset button + Print Preview button         │
├──────────────────────────────┬──────────────────────────────┤
│ LEFT: Settings (scrollable)  │ RIGHT: Live Preview           │
│ ┌────────────────────────┐   │ ┌──────────────────────────┐  │
│ │ Store                  │   │ │ ReceiptPreview             │  │
│ │   - Name               │   │ │   (isolated preview data)  │  │
│ │   - Address            │   │ │   "بيانات معاينة فقط"      │  │
│ │   - Phone              │   │ └──────────────────────────┘  │
│ │   - Tax ID             │   │                               │
│ │   - Logo upload        │   │                               │
│ ├────────────────────────┤   │                               │
│ │ Layout                 │   │                               │
│ │   - Paper 58/80mm      │   │                               │
│ │   - Font size          │   │                               │
│ │   - Line height        │   │                               │
│ ├────────────────────────┤   │                               │
│ │ Sections (17 toggles)  │   │                               │
│ ├────────────────────────┤   │                               │
│ │ Footer texts           │   │                               │
│ └────────────────────────┘   │                               │
└──────────────────────────────┴──────────────────────────────┘
```

### Isolated Preview Data

```typescript
buildPreviewReceiptData(): ReceiptData
```
- Hardcoded sale with 2 items, known totals.
- Clearly labeled "بيانات معاينة فقط" (Preview data only) via warning badge.
- **Never** uses real transaction data.

### Persistence

- `useReceiptSettings` hook reads/writes `localStorage['juman.receipt.settings.v1']`.
- Defaults from `DEFAULT_RECEIPT_SETTINGS`.
- **No backend sync** — documented in UI warning banner.

---

## 7. Integration Points

### POS Workspace
```typescript
const { settings } = useReceiptSettings()
const print = useReceiptPrint()
const data = buildSaleReceipt(sale, settings, sale.createdBy ?? '')
await print.print(data, settings)
```

### Sales Detail Page
Same pattern — triggered by "طباعة الإيصال" button.

### Future: Rental Receipts
```typescript
const data = buildRentalReceipt(rental, settings, rental.createdBy ?? '')
```

---

## 8. Extensibility

### Adding a New Template
1. Create `MyReceiptTemplate.tsx` importing section components.
2. Export from `templates/index.ts`.
3. Settings page can add a template selector dropdown.

### Adding a New Section
1. Create section component (e.g., `ReceiptLoyaltyPoints`).
2. Add toggle to `ReceiptSettings`.
3. Add to `DefaultReceiptTemplate` and `renderReceiptHtml` (for print).

### Adding a New Paper Size
1. Add to `ReceiptPaperWidth` type.
2. Add option in settings page.
3. CSS `width: ${mm}mm` handles it automatically.

---

## 9. Limitations & Known Issues

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No backend settings endpoint | Settings not synced across devices | Documented; localStorage only |
| No binary media serving | Logo must be base64 data URL | Acceptable for logo (<100KB) |
| `webContents.print()` on hidden window | Print dialog may not appear on some platforms | Test on target OS; fallback: `show: true` + minimize |
| No barcode font/image rendering | Barcode shown as monospace text | Documented; can add `jsbarcode` later |
| PDF/Excel export stubs | PDF/Excel export disabled | Backend issue — not frontend scope |

---

## 10. Security Considerations

- **HTML sanitization** — `renderReceiptHtml` uses `escapeHtml()` on all dynamic content.
- **No user HTML** — receipt HTML built from structured data only.
- **IPC boundary** — renderer builds HTML string; main prints; renderer never calls `webContents.print`.
- **LocalStorage only** — no sensitive data in receipt settings (store name/address/phone/logo).

---

## 11. Testing Strategy

### Unit Tests (vitest)
- `formatFils` — edge cases (null, 0, negative, large).
- `formatReceiptDate` — invalid/valid ISO strings.
- `buildSaleReceipt` / `buildRentalReceipt` — maps all DTO fields correctly.
- `settingsToCss` — 58/80mm, sm/md/lg, tight/normal/relaxed.
- `renderReceiptHtml` — produces valid HTML with expected sections.

### Manual Tests
- Settings page: every toggle updates preview instantly.
- Paper width 58/80mm: preview width changes.
- Logo upload → preview shows logo; remove → clears.
- Print preview: opens system dialog (or fails gracefully).
- RTL/LTR: barcode, numbers, phone render LTR; Arabic text RTL.

---

## 12. Future Enhancements

1. **Backend settings endpoint** — sync across devices, role-based defaults.
2. **Barcode image rendering** — integrate `bwip-js` or similar for real barcode images.
3. **Template marketplace** — admin can design custom templates via drag-drop.
4. **Email/PDF receipt** — `printToPDF` path for digital copies.
5. **Multi-language** — receipt templates per locale.
6. **Printer profile** — save printer-specific margins/offsets.

---

## Appendix: File Map

```
src/features/receipts/
├── types/receipt.ts           # TypeScript interfaces
├── utils/
│   ├── receipt.ts             # formatters, builders, settingsToCss
│   ├── render.ts              # renderReceiptHtml (print pipeline)
│   └── previewData.ts         # isolated preview data
├── templates/
│   └── DefaultReceiptTemplate.tsx
├── components/
│   └── ReceiptPreview.tsx
├── hooks/
│   ├── useReceiptSettings.ts  # localStorage persistence
│   └── useReceiptPrint.ts     # IPC print boundary
├── pages/
│   └── ReceiptSettingsPage.tsx
└── api/
    └── api.ts                 # receiptApi.print()
```

**Electron IPC:**
```
electron/
├── shared/channels.ts         # RECEIPT_PRINT, REPORTS_EXPORT
├── shared/preload.ts          # JumanPreloadApi.receipt, .reports
├── preload/index.ts           # contextBridge wiring
└── main/ipc/register.ts       # handlers (hidden window print, export download)
```
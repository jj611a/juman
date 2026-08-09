# PHASE 9.9 — FINANCE + SETTLEMENTS + RECEIPT INTEGRATION REPORT

## Verdict
**PASS** — All quality gates green; finance/settlements/sales money flows deepened with a reusable payment workflow, consistent IQD display, security fix, and extended receipt system — against the frozen Nest V2 backend.

---

## Critical security fix
- **`escapeHtml` was a no-op** (raw byte audit confirmed it replaced `&`→`&`, `<`→`<` — the replacement strings were the literal characters, not entities). Printable receipt HTML was injection-vulnerable.
- **Fixed** in `src/features/receipts/utils/receipt.ts` to real entity encoding (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).
- Verified by unit tests: `<script>` → `&lt;script&gt;`, no double-encoding of already-escaped input, plain Arabic unchanged.

---

## Currency consistency (IQD)
- **Bug**: Backend is IQD (`د.ع`), but finance/settlements/sales/customers/POS/dashboard/reports pages formatted as AED (`د.إ` with `ar-AE`).
- **Fix**: New shared `src/shared/utils/money.ts` (`formatIQD`, `formatIQDNumber`, `toFils`, `formatDateTime`, `formatDate`, `PAYMENT_METHOD_LABELS`). Uses `ar-IQ-u-nu-latn` for Latin numerals with `د.ع` label.
- **Applied** via thin delegating modules so existing import sites keep working:
  - `settlements/pages/settlementUtils.ts`, `finance/pages/financeUtils.ts`, `sales/constants/sales.ts`, `reports/pages/reportUtils.ts` → re-export `formatIQD`/`formatDateTime`/`formatDate`.
  - Inline AED formatters replaced in `RentalDetailPage`, `ReservationDetailPage`, `DashboardPage`, `POSWorkspace`, `CustomerDetailPage`.
- **Out of scope / untouched**: `inventory/constants/inventory.ts` formatter keeps its own behavior (its existing tests assert AED; catalog-only, not a money-flow surface).

---

## Reusable PaymentDialog
- **New** `src/features/finance/components/PaymentDialog.tsx` — production payment dialog used across Finance, Settlements, Sales, Customers:
  - Amount in IQD with `تسديد كامل المبلغ` quick-fill, **overpayment guard** (client-side AND enforced server-side by settlement engine 422).
  - Method selector (cash/card/bank_transfer), optional notes, remaining-balance display.
  - Loading state, Arabic error banner (backend messages preserved), success state with optional print-receipt action.
  - Never mutates money without confirmed submit; native `<dialog>` with Esc/backdrop close; idempotency key generated per attempt.

### FinancePage
- Inline payment form replaced with PaymentDialog.
- **Honest open-settlement notice**: when `balanceSource === 'settlement'`, the UI explains the backend rejects standalone payments (409) and directs the operator to record the payment inside the settlement.
- Uses `FINANCE_PAYMENT` gate; account-scoped outstanding remains required (never empty scope).

### SettlementsPage
- Payment modifier now opens PaymentDialog (routes to `POST /settlements/:id/payment`).
- **`canAdjust` wired correctly**: adjustment modifier now gated by `finance.adjustment` (backend `ADJUSTMENT` permission), while payment/refund/discount/late-fee/close/cancel stay under `finance.settlement.manage`.
- Remaining modifiers (refund/adjustment/discount/late-fee) keep the inline form with amount + reason validation.

### SalesDetailPage
- Inline payment form replaced with PaymentDialog (`POST /sales/:id/payment`).

### CustomerDetailPage
- **`دفع الرصيد`** action on the outstanding stat card when balance > 0 and operator has `FINANCE_PAYMENT`.
- **Correct routing**: if an open/partial settlement exists → payment routes through `POST /settlements/:id/payment` (backend rejects standalone while open); otherwise → standalone `POST /finance/payments`.
- Formatter switched to IQD; dates switched to `ar-IQ`.

---

## POS fixes
- **`handlePrintReceipt` no longer a stub**: now builds a real sale receipt from the last completed sale (`buildSaleReceipt` + `useReceiptPrint` + `useReceiptSettings`) and prints via the existing IPC path; last sale is captured from the `complete()` DTO.
- **`bank_transfer`** added as a payment method (type + select + API payload).
- **Invalidation expanded**: sale completion now invalidates `items`, `sales`, `settlements`, `finance`, `customerOutstanding`, `customerPayments`, `dashboard`, `reports`, `customers`.
- Cashier name from `SessionProvider` (`displayName ?? username`).

---

## Receipt system extensions
- `ReceiptEntityKind` extended: `'sale' | 'rental'` → `+ 'payment' | 'refund' | 'settlement'`.
- **New builders** (all money from backend DTOs, never recomputed):
  - `buildPaymentReceiptData(input, settings, cashierName, store)` — payment + settlement + customer.
  - `buildRefundReceiptData(input, refund, settings, cashierName, store)` — refund amount + reason.
  - `buildSettlementReceiptData(settlement, settings, cashierName, store)` — full breakdown (charge/deposit/late-fee/refund/paid/outstanding/total).
- `ReceiptData` gains optional `financial` metadata block (paymentNumber, settlementNumber, settlementStatus, entityLabel, method, notes) and `source.settlement`.
- **Renderer** (`utils/render.ts`): financial kinds skip the empty items block and show financial metadata rows; totals still print subtotal/discount/deposit/late-fee/refund/total/paid/outstanding.
- React preview template unaffected (renders financial kinds with empty items list).

---

## React Query invalidation expansion
Settlement mutations and finance payment now also invalidate:
`customerOutstanding`, `customerPayments`, `sales`, `rentals`, `dashboard`, `reports` — in addition to existing `settlements`/`finance`/`items`/`customers`.
- `useConfirmSale` / `useSalePayment` also invalidate `customerOutstanding`, `dashboard`, `reports`.

---

## Route guard fix
- `/settings/receipts` guard changed from `reports.view` → `finance.settlement.view`, matching `nav.config.ts` and the route's finance setting semantics.

---

## Backend changes
- **NONE** — backend remains frozen per hard rule.

---

## Frontend changes

### New files
- `src/shared/utils/money.ts`
- `src/features/finance/components/PaymentDialog.tsx`
- `frontend/tests/unit/finance-settlements.test.ts`
- `docs/frontend/PHASE_9_9_PLAN.md`

### Modified files
- `src/features/receipts/types/receipt.ts` — kinds + `financial` metadata
- `src/features/receipts/utils/receipt.ts` — escapeHtml security fix + payment/refund/settlement builders
- `src/features/receipts/utils/render.ts` — financial-kind rendering
- `src/features/finance/pages/FinancePage.tsx` — PaymentDialog + open-settlement notice
- `src/features/finance/pages/financeUtils.ts` — IQD delegation
- `src/features/finance/hooks/useFinance.ts` — invalidation
- `src/features/settlements/pages/SettlementsPage.tsx` — canAdjust fix + PaymentDialog
- `src/features/settlements/pages/settlementUtils.ts` — IQD delegation
- `src/features/settlements/hooks/useSettlements.ts` — invalidation
- `src/features/sales/pages/SalesDetailPage.tsx` — PaymentDialog
- `src/features/sales/constants/sales.ts` — IQD delegation
- `src/features/sales/hooks/useSales.ts` — invalidation
- `src/features/customers/pages/CustomerDetailPage.tsx` — دفع الرصيد + IQD
- `src/features/pos/pages/POSWorkspace.tsx` — real print + bank_transfer + invalidation
- `src/features/rentals/pages/RentalDetailPage.tsx` — IQD
- `src/features/reservations/pages/ReservationDetailPage.tsx` — IQD
- `src/features/dashboard/pages/DashboardPage.tsx` — IQD
- `src/features/reports/pages/reportUtils.ts` — IQD delegation
- `src/router/AppRouter.tsx` — receipts route guard fix

---

## Tests
| Suite | Tests | Status |
|-------|-------|--------|
| finance-settlements.test.ts | 16 | ✅ (new: money util, escapeHtml, receipt builders, renderer safety) |
| Existing suites | 38 | ✅ no regressions |
| **Total** | **54** | **✅ PASS** |

---

## Gates
| Gate | Result |
|------|--------|
| `pnpm lint` (tsc web + node) | **PASS** |
| `pnpm test` (vitest, 54 tests) | **PASS** |
| `pnpm validate:arch` | **PASS** |
| `pnpm build` (electron-vite) | **PASS** |

---

## Manual testing
### TESTED (renderer-level / static)
- Money formatting: `د.ع` label, Latin numerals, 1000 fils → 1, null/NaN → `—`
- escapeHtml: script tags neutralized, no double-encode, Arabic round-trip
- Payment/refund/settlement receipt builders: backend amounts verbatim
- Payment receipt HTML: no raw `<script>` injection
- Route guard: receipts settings uses `finance.settlement.view`
- Typecheck: all modified pages compile

### NOT TESTED (require live backend + hardware)
- Live settlement payment flow end-to-end (needs seeded backend + printer)
- Physical thermal printing of the new financial receipt kinds
- Overpayment 422 from the live settlement engine
- Open-settlement 409 block on standalone finance payment (backend behavior documented, UI surfaces it)

---

## Remaining gaps
1. Physical USB/Bluetooth printer printing still untested (unchanged integration boundary).
2. No `/reports/sales` aggregation endpoint (unchanged — sales tab stays honest unsupported state).
3. Inventory catalog formatter still AED (`د.إ`) — not a money-flow surface; flagged for a later consistency pass if desired.
4. Receipt settings still localStorage-only (no backend endpoint).
5. No PDF/Excel export (backend adapters stub).

---

## Recommendation
**READY FOR REVIEW.**

Phase 9.9 delivers:
- One critical XSS fix on the printable receipt surface
- Consistent IQD display across all financial surfaces
- A reusable, guarded payment dialog reused by 4 workspaces
- Settlement adjustment permission wiring corrected
- Real POS receipt printing + `bank_transfer` + complete invalidation
- Payment/refund/settlement receipt kinds with safe rendering
- Route-guard alignment and expanded cache invalidation
- 16 new unit tests; all gates pass; no backend changes

Awaiting explicit approval before Phase 9.10.

---

## Next phase
**Phase 9.10** (per roadmap) — await approval.

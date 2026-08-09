# Phase 9.9 — Finance + Settlements + Receipt Integration

**Branch:** `backend-v2` · **Product UI:** `frontend/` · **Backend:** Nest `backend-node/` — **FROZEN**

## Objective

Deepen and productionize Finance, Settlements, Sales money workflows, Customer outstanding balances, payment/refund workflows, settlement modifiers, and receipt integration — one coherent enterprise POS/ERP feel, Arabic-first, IQD (`د.ع`).

## Architecture rules (hard)

- Do NOT modify Nest backend, Prisma, settlement formulas, ledger formulas, or business rules.
- No mock/fake financial data, no local-only financial records, no fake API success.
- Unsupported backend gaps → disable/hide the UI action + document; never fake the result.
- Money = integer fils. Backend values are authoritative. Frontend never recomputes financial totals (presentational only).

## Audit findings driving this phase

1. **`escapeHtml` in `features/receipts/utils/receipt.ts` is a no-op** (replaces `&`→`&`, `<`→`<`). Printable HTML is injection-vulnerable. **Fix to real entity encoding.**
2. **Currency inconsistency:** finance/settlements/sales/customers/POS pages format as AED `د.إ`; receipts use IQD `د.ع`. Backend is IQD. **Create a shared IQD formatter and apply it consistently.**
3. **`canAdjust` is dead** in `SettlementsPage` — adjustment endpoint requires `finance.adjustment` (not `finance.settlement.manage`). Wire it.
4. **POS `handlePrintReceipt` is a stub**; POS sale completion invalidates only `['items']`+`['sales']`. Fix invalidation + real receipt print.
5. **Route guard mismatch:** `/settings/receipts` router uses `reports.view`, nav uses `finance.settlement.view`. Align.
6. **No `/reports/sales` endpoint** — the Reports sales tab stays an explicit unsupported state (already done in 9.7).
7. **No `finance.refund` / `finance.discount` permissions exist** in the backend catalog — refund/discount/late-fee/close/cancel are gated by `finance.settlement.manage`, adjustment by `finance.adjustment`. Document; don't invent keys.

## Deliverables

### 1. Shared finance utilities
- `shared/utils/money.ts`: `formatIQD(fils)` (د.ع), `formatDateTime`, `toFils`, payment-method labels.
- Replace duplicate AED formatters in finance, settlements, sales, customers, POS, rentals, reports.
- Fix `escapeHtml` in receipts.

### 2. Reusable PaymentDialog
- `features/finance/components/PaymentDialog.tsx` — production payment dialog (amount, method, notes, remaining balance, overpayment guard, loading/success/error, idempotency key, receipt option after success).
- Used by: FinancePage, SettlementsPage, SalesDetailPage, CustomerDetailPage (`دفع الرصيد`).

### 3. Finance workspace
- Account selection, account details, customer association, outstanding balance, transaction history, payment history, loading/empty states, permission-aware actions.
- `GET /finance/outstanding` must always be called with accountId or customerId (client guard already exists).

### 4. Settlement workspace
- Status rendering (open/partially_paid/paid/cancelled/closed) — display only real backend states.
- Modifiers (payment/refund/adjustment/discount/late-fee/close/cancel) with permission-aware buttons:
  - payment/refund/discount/late-fee/close/cancel → `finance.settlement.manage`
  - adjustment → `finance.adjustment`
- Payment history + modifiers lists from the settlement detail DTO.
- Dedicated confirmations; amount validation; loading states; never silently mutate money.

### 5. Customer outstanding
- Customer detail: outstanding balance, account, active settlements, recent payments, financial transactions.
- "دفع الرصيد" action → opens the same reusable PaymentDialog.

### 6. Sales ↔ Finance
- Sale detail shows sale total, paid, remaining, settlement status, customer/account, payments, receipt actions.
- Use the polymorphic settlement model: `entityType='sale'`.

### 7. Rentals ↔ Finance
- Display rental charge, deposit, paid, remaining, late fees, adjustments, refunds, settlement state — all from backend responses.

### 8. Receipt system
- Reuse the existing engine (builders → renderReceiptHtml → `receipt:print` IPC → hidden BrowserWindow).
- Add builders: `buildPaymentReceiptData`, `buildRefundReceiptData`, `buildSettlementReceiptData` (only where data exists).
- Distinguish receipt kinds (sale/payment/refund/rental/settlement) without duplicating rendering.

### 9. React Query invalidation
- All finance mutations invalidate: finance account, outstanding, transactions, settlements, customer details/outstanding, sales details, rental details, POS, dashboard, reports.

### 10. Error handling
- Arabic error messages preserving backend error codes. Do not hide backend details from diagnostics.

## Gates

`pnpm lint` · `pnpm test` · `pnpm validate:arch` · `pnpm build` — all must pass.

## Manual verification

Login → customer outstanding → account → settlement → payment → balance change → sale → sale settlement → print payment receipt → receipt settings preview → permission-restricted user. Printer hardware marked **NOT TESTED** unless actually verified.

## Deliverable

`docs/frontend/PHASE_9_9_FINANCE_SETTLEMENTS_REPORT.md` + update `PROGRESS.md`, `PHASE_9_FRONTEND_REBUILD.md`. STOP after; await approval before Phase 9.10.

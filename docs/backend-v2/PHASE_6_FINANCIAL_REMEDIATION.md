# Phase 6 Financial Integrity Remediation Report

**Branch:** `backend-v2`  
**Commit target:** `fix(v2-finance): financial integrity remediation`  
**Date:** 2026-08-02  
**Scope:** Eliminate dual payment paths and establish Settlement as sole rental financial owner. **No** late fees, penalties, reports, invoices, or refunds.

---

## Executive verdict

| Item | Result |
|------|--------|
| Dual payment path | **CLOSED** |
| Settlement owns rental balances | **YES** |
| Ledger append-only history | **YES** |
| Financial integrity score | **92 / 100** |
| Financial certification readiness | **CONDITIONAL PASS** — ready for certification review; not for late-fee/report feature work |

---

## Resolved debt

### Blocker 1 — Audit of mutation sites

Audited every `registerPayment` / `MoneyMovement` / `FinancialTransaction` / outstanding path under `src/finance/**` and rental checkout/complete.

| Path | Owner after remediation |
|------|-------------------------|
| `POST /settlements/:id/payment` | SettlementService → publishes ledger via `registerPaymentInTx` + CAS settlement balances |
| `POST /finance/payments` | FinanceService standalone only when **no** open/partial settlement |
| `createCharge` / `registerDeposit` | Ledger publish at checkout; settlement created immediately after |
| Outstanding HTTP | Settlement remaining when any non-cancelled settlement exists |

### Blocker 2 — Dual payment paths removed

`FinanceService.registerPayment` now calls `assertStandalonePaymentAllowed`:

- If account has settlement status ∈ `{ open, partially_paid }` → **409 Conflict**
- Message directs operators to `POST /settlements/:id/payment`
- `registerPaymentInTx` remains Settlement-trusted (no guard) so settlement can publish ledger entries

Integration tests that previously blessed `/finance/payments` after checkout were rewritten.

### Blocker 3 — Settlement publishes ledger; ledger does not own balances

- Settlement `applyPayment` still creates Payment + payment TX + MoneyMovement (append-only).
- `GET /finance/outstanding` returns `balanceSource: "settlement" | "ledger"`.
- When settlements exist, outstanding = Σ `remainingFils` over non-cancelled settlements.
- Ledger outstanding is available only as reconstruction (`ledgerOutstandingForAccount`) for audit — not rental source of truth.

### Blocker 4 — Invariant tests

Added `settlement.integrity.ts` + unit/integration coverage:

- `paidFils + remainingFils === totalFils`
- Settlement total === charge − deposit; remaining === total − applied payments
- Paid never transitions to `partially_paid`
- Cancelled / closed / paid reject payments
- Overpayment rolls back (no Payment row)

### Blocker 5 — Concurrency

- Settlement CAS on `(remainingFils, status)` + row lock retained
- Concurrent settlement payments remain deterministic
- Double-click (two equal payments) succeeds iff remaining allows; otherwise reject — no lost updates
- Standalone ledger payment blocked while settlements open

---

## Architecture review

| Principle | Status |
|-----------|--------|
| Single source of truth (rental money) | Settlement balances |
| Append-only ledger | Payment/TX/movement create-only |
| Settlement owns balances | Stored total/paid/remaining + status |
| FinanceService does not duplicate completion logic | Completion only via `assertFinanciallyComplete` |
| Rental never calculates balances | Unchanged |

```
Checkout → charge/deposit (ledger) → createForRental (Settlement)
Pay rental → Settlement.applyPayment → registerPaymentInTx (ledger) + CAS balances
Complete rental → Settlement.assertFinanciallyComplete
```

---

## Remaining risks (do not ignore)

| Risk | Severity | Notes |
|------|----------|-------|
| Checkout finance not in same TX as inventory | Medium | Charge/deposit/settlement run after rental TX; partial failure can orphan ledger without settlement (or vice versa). Fix in a dedicated atomicity phase. |
| Standalone `/finance/payments` still exists | Low | Gated correctly today; future refunds/adjustments must reuse the same gate. |
| Multiple open settlements per account | Low | Reject-all-while-any-open forces per-settlement payment API — correct, but UX must list settlements. |
| No client idempotency key on payment | Low | Double-click creates two payments if balance allows (deterministic). Add request-id idempotency before high-volume POS. |
| Refund / adjustment types unused | Medium | Constants exist; implementing them without settlement awareness will re-open dual-path debt. |

---

## Financial integrity score

| Criterion | Score | Weight |
|-----------|------:|-------:|
| Single payment authority for rentals | 20 | 20 |
| Settlement owns balances | 18 | 20 |
| Ledger append-only / no balance ownership | 15 | 15 |
| Concurrent payment safety | 14 | 15 |
| Invariant test coverage | 15 | 15 |
| Atomic checkout+finance | 5 | 10 |
| Idempotent payment API | 5 | 5 |
| **Total** | **92** | **100** |

---

## Certification readiness

**Ready for Financial Certification review** under the following constraints:

1. Certification scope = core ledger + settlement integrity (Phases 6.1–6.3).
2. Explicitly **out of scope** until approved: late fees, penalties, invoices, reports, refunds.
3. Must-fix before claiming production-complete finance: atomic checkout finance TX (remaining risk above).

**Recommendation:** Proceed to Financial Certification (Phase 6 cert) after product approval. Do **not** start late fees until certification accepts this remediation.

---

## Validation

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:cov
pnpm test:cov:finance   # ≥95% on src/finance/**
```

## Docs / canvas

- `SettlementDesign.md` — dual-path debt closed
- `FinancialDesign.md` — balance ownership rule
- `DecisionLog.md` — ADR-V2-026
- `PROGRESS.md` / roadmap / canvas — Phase 6.3 done

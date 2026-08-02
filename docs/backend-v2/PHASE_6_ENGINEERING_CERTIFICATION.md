# Backend V2 — Phase 6 Engineering Certification (Financial)

**Date:** 2026-08-02  
**Branch:** `backend-v2`  
**Mode:** Verification only — no feature implementation  
**Scope:** Money VO · FinanceService · SettlementService · Ledger · Payment · Rental finance integration · Outstanding · History · Audit (Phases 6.1–6.3)  
**Stance:** Critical. 10-year maintainability. Phase 6.3 integrity score of 92 is **not** accepted as final certification.

---

## Executive Summary

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (66 files / **252** tests) |
| `pnpm test:cov` | **PASS** (statements **94.33%** / lines **95.2%** / branches **86.04%** / functions **97.81%**) |
| `pnpm test:cov:finance` | **PASS** (statements **96.61%** / lines **97.5%** / branches **92.96%** / functions **100%**) |

**Overall certification:** **PASS WITH WARNINGS**  
**Production readiness (finance core):** **CONDITIONAL**  
**Reports readiness:** **NO-GO**

Settlement ownership and dual-path HTTP gating are real. Checkout/deposit non-atomicity, deposit non-idempotency, and rental↔settlement cancel decoupling are **release blockers for any reporting layer** that would treat balances as durable truth.

---

## Scorecard

| Area | Score | Verdict |
|------|------:|---------|
| Architecture | **78** | PASS WITH WARNINGS |
| Security | **82** | PASS WITH WARNINGS |
| Performance | **88** | PASS |
| Database | **74** | PASS WITH WARNINGS |
| Testing | **86** | PASS |
| Maintainability | **80** | PASS WITH WARNINGS |
| **Overall** | **80** | **PASS WITH WARNINGS** |

Rubric: 90–100 strong; 80–89 production-capable with tracked debt; 70–79 conditional; <70 fail.

Financial workflow foundations (charge → settlement → pay → complete) are **conditionally certified**. They are **not** certified as Reports-ready or production-complete money domain.

---

## 1. Logical Certification

| Area | Verdict | Notes |
|------|---------|-------|
| Charge lifecycle | **WARN** | Idempotent by reference when present; check is outside TX/lock; **no unique** `(type, referenceType, referenceId)` |
| Deposit lifecycle | **FAIL** | **No** reference idempotency — retry of `syncCheckoutFinance` can double-post deposit while settlement uses one amount |
| Payment lifecycle (settlement path) | **PASS** | `applyPayment` → `registerPaymentInTx` + CAS; overpay rejected; TX rollback |
| Settlement lifecycle | **PASS** | Status graph closed; `paid+remaining===total` post-CAS |
| Outstanding | **WARN** | Prefers settlement Σ remaining; cancelled-only → ledger fallback (`balanceSource`) — dual semantics |
| Rental completion | **PASS** | `assertFinanciallyComplete` requires `{paid, closed}` |
| Ledger consistency | **WARN** | Holds on happy path; diverges on deposit retry / orphaned checkout |
| Impossible / stuck states | **FAIL** | (1) Rental cancel leaves open settlement + charge; (2) settlement cancel leaves rental unable to complete; (3) inventory TX commits then finance fails → rented without settlement |

**Section:** FAIL (structural lifecycle coupling), but does not fail the whole module certification when scoped as “foundation with Must-Fix before Reports.”

---

## 2. Functional Certification

Evidence: `test/finance-integration.spec.ts`, `test/finance-settlement-integration.spec.ts`, unit suites.

| Scenario | Verdict |
|----------|---------|
| Checkout → charge (+ deposit) → settlement | **PASS** |
| Partial payment | **PASS** |
| Full payment → paid | **PASS** |
| Settlement close | **PASS** |
| Settlement cancel (unpaid) | **PASS** |
| Cancel blocked after payment | **PASS** |
| Rental complete gated by settlement | **PASS** |
| Complete blocked while open | **PASS** |
| Overpayment rollback | **PASS** |
| Ledger bypass while open settlement | **PASS** (409) |
| Concurrent settlement payments | **PASS** (balance conserved) |
| Double-click equal payments | **PASS** (deterministic: 2 payments if remaining allows) |
| Closed account standalone pay rollback | **PASS** |
| Deposit retry / checkout finance failure | **GAP** |
| Rental cancel with open settlement | **GAP** |
| Full deposit (= charge) auto-paid complete | **GAP** |
| Payment idempotency key | **ABSENT** (by design today) |

---

## 3. Database Certification

| Topic | Verdict | Notes |
|-------|---------|-------|
| Relations | **WARN** | Settlement↔Rental unique OK; **no FK** `customerId→Customer`; **no FK** `SettlementHistory.paymentId→Payment` |
| Indexes | **PASS** | List/filter indexes adequate; charge reference index **non-unique** |
| Soft delete | **WARN** | Columns present; unused in services |
| Append-only trail | **PASS** | Movement / audit / history create-only |
| Transactions | **WARN** | Settlement pay atomic; checkout finance **outside** rental TX |
| Enum integrity | **WARN** | Free `String` statuses — no CHECK |
| Migrations | **PASS** | `20260802220000_financial_core`, `20260802230000_settlement_engine` |

**DB score 74** — foundation usable; uniqueness and cancel coupling must precede report queries.

---

## 4. Concurrency Certification

| Mechanism | Proven? |
|-----------|---------|
| Settlement lock + CAS `(remainingFils, status)` | **Yes** (integration) |
| Account row-touch lock | Unit only |
| Settlement create race (unique `rentalId`) | Unit |
| Charge idempotency under concurrency | **Not proven** |
| Deposit under concurrency / retry | **Fail** |
| Sequence counters | Weak read-then-increment |

**Verdict:** Concurrent **payments** are deterministic. Concurrent **publish** (charge/deposit/numbering) is not yet production-grade.

---

## 5. Security Certification

| Probe | Verdict |
|-------|---------|
| Unauthenticated finance/settlement | **PASS** (401) |
| `finance.view` / `finance.payment` / `finance.settlement.*` RBAC | **PASS** |
| Standalone `/finance/payments` while open settlement | **PASS** (409) |
| Settlement never edits Payment rows | **PASS** |
| `registerPaymentInTx` unguarded export | **WARN** — trust = module discipline |
| Rental cancel without finance authority | **WARN** — obligation survives cancel |
| Legacy `rental.settlement.*` vs `finance.settlement.*` | **WARN** — RBAC confusion |

Unauthorized HTTP payment / settlement bypass: **blocked**. Service-boundary and cancel coupling remain the material risks.

---

## 6. Architecture Certification

| Principle | Status |
|-----------|--------|
| Settlement owns rental balances | **YES** |
| Ledger append-only history | **YES** |
| Outstanding for rentals = settlement remaining | **YES** (when settlements exist) |
| Dual HTTP payment path closed | **YES** (Phase 6.3) |
| Rental owns workflow only | **YES** (no balance fields) |
| Inventory owns lifecycle | **YES** |
| Availability isolated | **YES** (unchanged) |
| Money arithmetic centralized (`Money` / fils) | **YES** |
| No duplicate completion logic | **YES** (`assertFinanciallyComplete` only) |
| Cross-boundary closure | **INCOMPLETE** — checkout atomicity, deposit idempotency, cancel coupling |

Intent (ADR-024/025/026) is correct. Closure for a multi-year money domain is not.

---

## 7. Hardening Review (evaluate only — do not implement here)

| Item | Class | Best single strategy |
|------|-------|----------------------|
| Checkout atomicity | **Release blocker** (before Reports) | One Prisma TX: inventory/rental mutation + `createChargeInTx` + `registerDepositInTx` + `createForRentalInTx`; unique `(type, referenceType, referenceId)` for charge & deposit |
| Payment idempotency | **High** | Required `Idempotency-Key` unique per settlement; replay returns prior result; keep CAS for concurrency |
| Deposit idempotency | **Release blocker** (before Reports) | Same reference idempotency as charge, inside the atomic checkout TX |
| Rental↔settlement cancel | **Release blocker** (before Reports) | Explicit policy in one TX: unpaid → auto-cancel settlement; paid → forbid rental cancel or reverse via settlement-owned compensating entries |
| Refund architecture | **High** (before any refund appears in UI/Reports) | Settlement-owned `applyRefund` only; append compensating ledger; never mutate Payment |
| Adjustment architecture | **Medium** | Settlement-owned signed adjustment under CAS + `finance.adjustment`; standalone adjustments only when no blocking settlements |

---

## 8. Performance

No dedicated load harness in this phase. Evidence from automated suite:

| Operation class | Observation |
|-----------------|-------------|
| Finance gate (`test:cov:finance`, 37 tests) | ~20s wall including Nest boots |
| Concurrent settlement payments (3×1000) | Deterministic balance; no lost updates |
| Outstanding (settlement sum) | O(settlements per account) — acceptable for desktop SQLite |
| History embed (last 50) | Bounded |

**Score 88** — adequate for desktop-first SQLite; re-measure under PG before multi-store scale.

---

## 9. Tests / Coverage

| Suite | Result |
|-------|--------|
| Full | 252 passed |
| Finance module gate | **96.61%** stmts / **97.5%** lines / **100%** funcs (≥95) |
| Global | Lines **95.2%** |

Gaps that lower certification confidence (not coverage %): deposit retry, rental cancel finance, zero-charge / full-deposit edges.

---

## 10. Final Decision

### Overall: **PASS WITH WARNINGS** (score **80**)

Financial core + settlement are certified as a **workflow foundation** with dual-path remediation accepted.

### Production readiness: **CONDITIONAL**

Safe for continued controlled backend development and manual ops testing. Not safe to treat balances as immutable business truth in production reporting without Must-Fix below.

### Reports readiness: **NO-GO**

**Do not begin Phase 7 Reports** until Must-Fix items are remediated (or explicitly waived by product with written mitigations — not recommended).

Building Reports now would:

1. Encode dual outstanding semantics (`settlement` vs `ledger` fallback).  
2. Amplify orphaned checkout / double-deposit rows into operator-trusted numbers.  
3. Leave cancelled rentals with live financial obligations invisible to workflow but visible (or wrong) in reports.

### Must-Fix before Reports GO

1. **Atomic checkout finance** (single TX with rental/inventory).  
2. **Deposit (+ charge) reference uniqueness + idempotency**.  
3. **Rental cancel ↔ settlement policy** (coupled, explicit, tested).  
4. Document Reports source of truth: **Settlement only** for rental money; ledger = audit trail.

### Acceptable debt (tracked, not blockers for continued Phase 6 hardening)

- Payment idempotency keys (High — fix before high-volume POS).  
- Unused refund/adjustment (High when introduced — settlement-owned only).  
- Soft-delete unused; SQLite lock → PG `FOR UPDATE` on DB migrate.  
- `markPaid` without HTTP (fine).

---

## GO / NO-GO (explicit)

| Decision | Result |
|----------|--------|
| Certify Phase 6.1–6.3 as financial **foundation** | **GO** (with warnings) |
| Start **Reports** | **NO-GO** |
| Start late fees / penalties / invoices / refunds | **NO-GO** |
| Start Desktop finance adapter beyond auth | Out of scope — separate approval |

---

## References

- `FinancialDesign.md`, `SettlementDesign.md`  
- `PHASE_6_FINANCIAL_REMEDIATION.md` (integrity 92 — superseded as *certification* score by this report’s **80**)  
- ADR-V2-024, ADR-V2-025, ADR-V2-026, ADR-V2-027  

**STOP.** Wait for approval before Reports or further finance features.

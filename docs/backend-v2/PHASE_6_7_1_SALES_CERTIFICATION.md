# Backend V2 — Phase 6.7.1 Sales Integrity Hardening & Certification

**Date:** 2026-08-05  
**Branch:** `backend-v2`  
**Mode:** Engineering certification — no new product features  
**Scope:** `src/sales/**` integrity, rollback, concurrency, settlement/lifecycle coupling, RBAC, soft-delete, Walk-in uniqueness  
**Evidence:** `test/sales-certification-671.spec.ts` → `docs/backend-v2/cert_sales_671.json`  
**Commit intent:** `fix(v2-sales): engineering certification and integrity remediation`

---

## Executive Summary

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (82 files / **366** tests) |
| `pnpm test:cov` | **PASS** (statements **94.2%** / lines **95.05%** / functions **97.6%**) |
| `pnpm test:cov:sales` | **PASS** — statements **98.33%** / lines **98.8%** / functions **100%** / branches **93.26%** |

**Certification checks:** **20 / 20 PASS** (`cert_sales_671.json`)

**Overall:** **PASS**  
**Production readiness (Sales backend):** **GO** for review (still no POS / returns / reports UI)

---

## Scorecard

| Area | Score | Verdict |
|------|------:|---------|
| Architecture | **94** | PASS |
| Security | **93** | PASS |
| Performance | **88** | PASS |
| Integrity | **96** | PASS |
| Testing | **97** | PASS |
| Maintainability | **92** | PASS |
| **Overall** | **93** | **PASS** |

Rubric: 90–100 strong; 80–89 production-capable with tracked debt; &lt;80 fail certification.

---

## Remediation applied (vs Phase 6.7 CONDITIONAL GO)

| Gap | Fix |
|-----|-----|
| Foreign `for_sale` hold steal | Hold ownership via `ItemStateHistory` + reject other confirmed/completed sales on same item |
| Complete after cancelled settlement | Require live settlement status (`open` \| `partially_paid` \| `paid`) |
| Settlement HTTP cancel while sale live | Blocked for active sale documents |
| Customer reassignment after payment | Settlement `reassignCustomerInTx` rejects when `paidFils > 0` |
| Nested duplicate payment path | Sales uses `SettlementService.applyPaymentInTx` only |
| Payment / cancel outside exclusive lock | Both under `AvailabilityService.runExclusive` + idempotency scopes |
| Walk-in resolve outside TX | `resolveFinanceCustomerIdInTx` creates/restores Walk-in inside exclusive TX |
| Soft-delete unguarded | Only draft/cancelled without live settlement |
| Public `available → sold` | Removed; Sales path is `available → for_sale → sold` only |
| Over-broad permissions | Confirm needs `sales.complete`; pay/complete scoped to `sales.payment` / `sales.complete` |
| Create without sellability | `isSellable` enforced at draft create |

---

## Certification matrix

| Goal | Result | Evidence |
|------|--------|----------|
| ≥95% sales coverage | **PASS** | `pnpm test:cov:sales` |
| Forced mid-TX rollback | **PASS** | Inject failure after `createChargeInTx` → sale stays draft, no settlement/ledger/hold |
| Concurrency (same item / same confirm) | **PASS** | Hold-steal 409; concurrent confirm → 1 settlement |
| Settlement math / cancel unwind | **PASS** | Charge = total; cancel voids ledger + restores `available` |
| Lifecycle impossibles | **PASS** | `sold→available/rented` 409; completed→cancel 409; no public `available→sold` |
| Walk-in uniqueness (100 sales) | **PASS** | 1 customer, 1 account |
| Soft-delete policy | **PASS** | Confirmed blocked; cancelled allowed |
| Permissions | **PASS** | Anon 401; Inventory role 403; Admin 200 |
| API validation / idempotency | **PASS** | Bad UUID/payload; confirm replay |
| Dependency boundaries | **PASS** | Sales mutates inventory/finance/lifecycle only via services |
| Architecture duplication | **PASS** | No copied Settlement/Lifecycle formulas |

---

## Residual debt (non-blocking)

1. Performance stress at 1000 sales / 500 settlements is not a dedicated soak harness in CI (Walk-in 100 + concurrent confirm cover integrity under SQLite locks).
2. Defensive `canTransitionSaleStatus` branch after `canConfirm` remains theoretically unreachable (status graph already closed).
3. POS / receipts / returns / refund UI / sales reports remain explicitly out of scope.

---

## Verdict

**PASS.** Sales domain engineering quality is certified at Rentals/Finance parity for backend integrity gates. Stop for approval before any POS or reporting work.

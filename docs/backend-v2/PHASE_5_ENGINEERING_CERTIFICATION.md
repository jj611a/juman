# Backend V2 — Phase 5 Engineering Certification (Rental + Reservation)

**Date:** 2026-08-02  
**Branch:** `backend-v2`  
**Mode:** Verification only — no feature implementation  
**Scope:** Rental (5.1) + Reservation / AvailabilityService (5.2) + Lifecycle integration + History + Audit  
**Stance:** Critical. Scores are evidence-based. Warnings and Must-Fix items are not ignored.

---

## Executive Summary

Phase 5.1–5.2 rental/reservation deliverables were subjected to logical review, full automated suites, module coverage gates, a live Nest certification harness (`scripts/cert-phase53.cjs`), schema inspection, TypeScript/architecture review, and documentation cross-check.

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (58 files / **201** tests) |
| `pnpm test:cov` | **PASS** (statements **94.37%** / lines **95.25%** / branches **86.19%** / functions **97.81%**) |
| `pnpm test:cov:reservations` | **PASS** (statements **99.11%** / lines **99.07%** / branches **90.22%** / functions **100%**) |
| `pnpm test:cov:rentals` | **FAIL** (statements **90.87%** / lines **90.9%** / branches **74.14%** — below 95/95/80 gates) |
| Live harness (`scripts/cert-phase53.cjs`) | **PASS** (9/9 security · 16/16 API · 0 errors; architecture debt probes documented) |

**Overall certification:** **PASS WITH WARNINGS**  
**Financial readiness?** **NO** — Must-Fix items below block Phase 6 Financial.

Evidence artifact: `docs/backend-v2/cert_p53_harness.json`.

---

## Scorecard

| Area | Score | Verdict |
|------|------:|---------|
| Architecture | **72** | PASS WITH WARNINGS |
| Security | **76** | PASS WITH WARNINGS |
| Performance | **90** | PASS |
| Database | **82** | PASS |
| API | **78** | PASS WITH WARNINGS |
| Testing | **70** | PASS WITH WARNINGS |
| Documentation | **86** | PASS |
| Maintainability | **74** | PASS WITH WARNINGS |
| **Overall** | **76** | **PASS WITH WARNINGS** |

Scoring rubric: 90–100 strong; 80–89 production-capable with tracked debt; 70–79 conditional; <70 fail gate.

Rental + Reservation are **conditionally certified as workflow foundations**. They are **not** certified as financial-ready.

---

## 1. Logical Review

| Area | Verdict | Notes |
|------|---------|-------|
| Rental workflow | **PASS** | `draft → checked_out → active → return_pending / cancelled`; closed transition map |
| Reservation workflow | **PASS** | Create auto `draft→confirmed`; checkout / cancel / expire |
| Checkout (rental) | **PASS** | Single TX; Lifecycle `available→reserved→rented`; rental activates |
| Checkout (reservation) | **PASS** | Availability assert + materialize rental + mark `checked_out` |
| Cancellation | **PASS** | Draft cancel clean; outbound rental cancel restores inventory via Lifecycle path |
| Expiration | **PASS** | Foundation HTTP only; no scheduler (intentional) |
| Return pending | **PASS** | Outbound → `return_pending` + inventory `rented→return_pending` |
| Conflict detection | **FAIL→Must Fix** | Reservations use `AvailabilityService`; **walk-in rentals do not** — harness confirms steal |
| Lifecycle synchronization | **PASS** | No direct `Item.lifecycleState` writes in rentals/reservations |
| State consistency | **WARNING** | After walk-in steal, reservation remains `confirmed` while item is `rented` — ops trap |
| Duplicate business rules | **PASS** | Overlap logic lives only in `AvailabilityService.rangesOverlap` |
| Impossible transitions | **PASS** | Invalid edges → 409; harness confirmed |
| Dead transitions | **WARNING** | `overdue` and `return_pending→completed` exist in map but have **no service/HTTP path** |
| History | **PASS** | Status history embedded on GET; append-only tables |
| Audit | **PASS** | Create/checkout/return/cancel/expire audited |

Harness debt probes:

- Walk-in rental create overlapping a confirmed reservation → **201** (gap).
- Walk-in checkout → **200**; subsequent reservation checkout → **409**.
- Concurrent identical reservation creates → **2×201** (TOCTOU).

---

## 2. Functional Testing

| Capability | Evidence | Verdict |
|------------|----------|---------|
| Rental creation | Integration + harness | **PASS** |
| Reservation creation | Integration + harness | **PASS** |
| Reservation checkout | Integration + harness | **PASS** |
| Rental checkout | Integration + harness | **PASS** |
| Cancellation | Integration + harness | **PASS** |
| Expiration | Integration + harness | **PASS** |
| Availability | Unit + harness | **PASS** (reservation path) |
| Conflict detection | Integration + harness | **WARNING** — asymmetric (reservations only) |
| History | Harness + GET embed | **PASS** |
| Audit | Service paths | **PASS** |
| Rollback | TX unit/integration | **PASS** |
| Concurrency | CAS on status + lifecycle | **PASS** for checkout CAS; **FAIL** for reservation create race |

---

## 3. Database Review

| Check | Result | Verdict |
|-------|--------|---------|
| Models | `Rental`, `RentalItem`, `RentalStatusHistory`, `Reservation`, `ReservationItem`, `ReservationStatusHistory` | **PASS** |
| `Rental.reservationId` | Optional `@unique` FK → Reservation | **PASS** |
| Line uniqueness | `(rentalId,itemId)`, `(reservationId,itemId)` | **PASS** |
| Indexes | Status, dates, customer, composite `status+deletedAt`, reservation window `(startDate, expectedReturnDate)` | **PASS** |
| Soft delete | App-level `deletedAt` on header docs | **PASS** |
| Cascade | Line/history FKs default Restrict (no accidental hard-delete wipe) | **PASS** |
| Transactions | Checkout / cancel / materialize use `$transaction` | **PASS** |
| Rollback | Failure mid-TX leaves inventory + docs unchanged (tested) | **PASS** |
| Window uniqueness | **No** DB unique constraint on item×date overlap | **WARNING** — enables TOCTOU dual-create |

Harness DB snapshot (after probes): rentals 3 · reservations 6 · rental history 10 · reservation history 15 · item state history 12.

---

## 4. Performance

Measured on local Nest harness (SQLite, coldish process). Values are wall ms for the timed operation.

| Operation | ms | Verdict |
|-----------|---:|---------|
| Availability lookup | **2** | PASS |
| Rental create | **46** | PASS |
| Rental checkout TX | **75** | PASS |
| Reservation create | **88** | PASS |
| Reservation checkout TX | **88** | PASS |
| Rental list | **24** | PASS |
| Reservation list | **14** | PASS |
| Rental history (GET embed) | **18** | PASS |
| App startup | **2973** | PASS (test boot) |
| Migrate deploy | **4706** | PASS |
| RSS after boot | **127 MB** | PASS |

**WARNING:** `AvailabilityService` loads all blocking line rows for an item then filters overlap in memory. Fine for desktop SQLite scale; redesign before multi-tenant / large calendars.

---

## 5. Security

| Probe | Result | Verdict |
|-------|--------|---------|
| Unauthenticated `/rentals` | 401 | **PASS** |
| Unauthenticated `/reservations` | 401 | **PASS** |
| Unauthenticated rental checkout | 401 | **PASS** |
| Unauthenticated reservation cancel | 401 | **PASS** |
| Reservation overlap | 409 | **PASS** |
| Checkout non-draft rental | 409 | **PASS** |
| Cancel checked-out reservation | 409 | **PASS** |
| Lifecycle bypass via rental APIs | No direct lifecycle writes | **PASS** |
| Walk-in steals reserved window | Allowed today | **FAIL→Must Fix** (integrity, not authz) |
| Concurrent reservation create | 2 wins | **FAIL→Must Fix** |
| Permission escalation | Admin bootstrap only in harness; RBAC permissions seeded | **PASS** (permission matrix exists; no cross-tenant model yet — desktop single-store) |

Harness: **9/9** security checks marked `ok` under current definitions; architecture probes separately flag integrity gaps (steal + TOCTOU).

---

## 6. API Review

| Check | Verdict | Notes |
|-------|---------|-------|
| HTTP codes | **PASS** | 201 create, 200 actions, 400 validation, 401 auth, 409 conflicts |
| DTOs / validation | **PASS** | class-validator; `ArrayMinSize(1)` on items |
| Serialization | **WARNING** | `toRentalPublic` **omits `reservationId`** — clients cannot see link without nested reservation query |
| History API | **WARNING** | No `GET …/history`; history embedded (capped 50) — OK for now |
| Consistency | **PASS** | Shared pagination/sort patterns |
| Reservation create status | **WARNING** | HTTP always lands on `confirmed`; `draft` is internal birth row only |

---

## 7. Architecture Review

| Rule | Verdict | Notes |
|------|---------|-------|
| Rental never mutates inventory directly | **PASS** | Static + runtime: only `LifecycleService.transition` |
| LifecycleService sole owner | **PASS** | Optional `{ tx, skipAudit }` joins outer business TXs |
| AvailabilityService reused | **FAIL→Must Fix** | Used by reservations only; rentals ignore it |
| No duplicated overlap logic | **PASS** | Single `rangesOverlap` |
| Reservation → Rental materialization | **PASS** | `materializeActiveFromReservation` inside outer TX |
| Checkout inventory path | **PASS** | Shared `available→reserved→rented` |
| Cancel inventory path | **PASS** | `rented→return_pending→inspection→available` |
| Return foundation | **WARNING** | Stops at `return_pending`; no complete/inspect/clean |

**Redesign required before Financial:** Treat availability as a **shared domain service** consumed by **both** rental create/checkout and reservation create/checkout. Today’s asymmetry will corrupt settlement assumptions (double-booked windows, orphaned confirmed reservations).

---

## 8. TypeScript

| Check | Verdict |
|-------|---------|
| Strict mode | **PASS** (`strict` in tsconfig) |
| `any` in rentals/reservations | **PASS** (none found) |
| `@ts-ignore` | **PASS** (none found) |
| Lint | **PASS** |
| Build | **PASS** |

Unused exports/imports: ESLint clean for `{src,test}/**/*.ts`.

---

## 9. Test Coverage

### Global (`pnpm test:cov`)

| Metric | Value |
|--------|------:|
| Statements | 94.37% |
| Branches | 86.19% |
| Functions | 97.81% |
| Lines | 95.25% |

### Rentals module (`pnpm test:cov:rentals`)

| Metric | Value | Gate |
|--------|------:|------|
| Statements | **90.87%** | 95 — **FAIL** |
| Branches | **74.14%** | 80 — **FAIL** |
| Functions | 96.77% | 95 — PASS |
| Lines | **90.9%** | 95 — **FAIL** |

Uncovered hotspots: `rentals.service.ts` materialize / cancel concurrency edges (Phase 5.2 added surface area not fully covered by `test/rentals-*.spec.ts`).

### Reservations module (`pnpm test:cov:reservations`)

| Metric | Value | Gate |
|--------|------:|------|
| Statements | 99.11% | 95 — PASS |
| Branches | 90.22% | 80 — PASS |
| Functions | 100% | 95 — PASS |
| Lines | 99.07% | 95 — PASS |

---

## 10. Technical Debt

### Critical (Must-Fix before Financial)

1. **Walk-in rentals bypass `AvailabilityService`** — create + checkout can steal a confirmed reservation window. Harness reproduced.
2. **Reservation create TOCTOU** — concurrent identical creates both succeed (`ok=2 fail=0`). Need transactional serialization or stronger locking strategy.
3. **`pnpm test:cov:rentals` gate failing** — restore ≥95% statements/lines and ≥80% branches after `materializeActiveFromReservation` landed.

### High

4. Expose `reservationId` on rental public DTO (and keep relation nested).
5. No service path for `overdue` or `return_pending → completed` — either implement foundations or remove dead transitions from the public map.
6. Confirmed reservation left orphaned after walk-in steal — needs conflict policy (auto-cancel? block walk-in?).
7. Availability in-memory overlap scan — plan indexed window query before calendar UI scale-up.

### Medium

8. No dedicated history endpoints (embedded only).
9. Reservation `draft` not a client-visible hold state (auto-confirm).
10. `skipAudit` on in-TX lifecycle transitions — inventory audit trail thinner during checkout (platform audit on rental/reservation still present).
11. Soft-delete semantics for rentals/reservations with outbound inventory not fully specified.

### Low

12. Birth history rows (`draft→draft` / create markers) slightly pollute “transition = change” semantics.
13. Harness / cert scripts are CJS outside TypeScript strict pipeline.

---

## 11. Recommended Fixes Before Financial

**Do not start Phase 6 until:**

1. `RentalsService.create` and `checkout` call `AvailabilityService.assertItemsAvailable` for `[rentalDate, expectedReturnDate)`.
2. Concurrent reservation create is single-winner under load (prove with harness: `ok=1 fail=1`).
3. `pnpm test:cov:rentals` passes published thresholds.
4. Decide and document orphan-reservation policy when inventory is taken by another path.
5. Add rental DTO `reservationId` (small, high clarity).

Optional but strongly advised: return-completion foundation that returns inventory through Lifecycle (or explicitly keep Financial scoped to checked-out/active only).

---

## 12. Validation Commands

```text
pnpm lint          → PASS
pnpm build         → PASS
pnpm test          → PASS (201)
pnpm test:cov      → PASS
pnpm test:cov:rentals       → FAIL (thresholds)
pnpm test:cov:reservations  → PASS
node scripts/cert-phase53.cjs → PASS (0 errors; debt probes recorded)
```

---

## 13. Documentation

| Doc | Update in this phase |
|-----|----------------------|
| `PHASE_5_ENGINEERING_CERTIFICATION.md` | **Created** (this file) |
| `cert_p53_harness.json` | **Created** |
| `Architecture.md` | Certification note + Financial gate |
| `RentalDesign.md` | Known limitations / cert reference |
| `ReservationDesign.md` | Known limitations / cert reference |
| `DevelopmentRoadmap.md` | Phase 5.3 complete; Financial blocked |
| `PROGRESS.md` | YOU ARE HERE after 5.3 |
| Canvas | Phase 5 cert status |
| ADR | ADR-V2-022 certification gate |

---

## 14. Final Verdict

| Question | Answer |
|----------|--------|
| Overall score | **76** |
| Certification | **PASS WITH WARNINGS** |
| Ready for Financial (Phase 6)? | **NO** |
| Ready for reports / late fees / payments? | **NO** |
| What is certified? | Rental + Reservation **workflow foundations** with Lifecycle ownership and reservation-side availability |
| What is not certified? | Cross-domain conflict integrity, rental coverage gate, concurrent reservation safety |

**STOP.** Do not implement Financial until Must-Fix items are remediated and re-certified.

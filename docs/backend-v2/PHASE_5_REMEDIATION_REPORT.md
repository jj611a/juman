# Backend V2 — Phase 5.4 Rental Integrity Remediation Report

**Date:** 2026-08-02  
**Branch:** `backend-v2`  
**Commit target:** `fix(v2-rentals): integrity remediation`  
**Scope:** Eliminate Phase 5.3 Must-Fix blockers only — **no** Financial, payments, late fees, settlement, or reports.

---

## Executive summary

All three certification blockers from `PHASE_5_ENGINEERING_CERTIFICATION.md` are remediated with regression coverage. Rental + Reservation allocation integrity is restored.

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (59 files / **213** tests; was 201) |
| `pnpm test:cov` | **PASS** (stmts **94.13%** / lines **95.06%** / branches **86%** / funcs **97.81%**) |
| `pnpm test:cov:rentals` | **PASS** (stmts **97.55%** / lines **97.44%** / branches **87.31%** / funcs **100%**) |
| `pnpm test:cov:reservations` | **PASS** (stmts **98.34%** / lines **98.26%** incl. `src/availability`) |

**Updated integrity score:** **90 / 100** (was **76**)  
**Financial readiness?** **NO — wait for explicit approval** (code Must-Fix cleared; product gate remains).

---

## Resolved (Must-Fix)

### Blocker 1 — Centralize allocation

- Extracted shared `AvailabilityModule` → `src/availability/`
- `AvailabilityService` is the **sole** calendar conflict / allocation authority
- Wired into:
  - `RentalsService.create` (walk-in)
  - `RentalsService.checkout`
  - `ReservationsService.create`
  - `ReservationsService.checkout`
- Repository search: `rangesOverlap` / conflict logic exists only under `src/availability/`
- Walk-in overlapping a confirmed reservation → **409** (was 201 steal)

### Blocker 2 — Reservation race (TOCTOU)

- `AvailabilityService.runExclusive(fn)`:
  1. Opens Prisma `$transaction`
  2. Acquires write lock via `SequenceCounter` prefix `__allocation_lock__`
  3. Runs callback (assert + persist) under that lock
- Reservation create: **assert availability + `createConfirmedInTx`** inside one exclusive TX
- Rental create / both checkouts use the same exclusive allocator
- Concurrent overlapping reservation creates: integration proves **exactly one 201 and one 409**

### Blocker 3 — Rentals coverage gate

- Expanded unit coverage for `materializeActiveFromReservation` CAS paths
- Availability conflict path on create
- Restored module gate: statements **97.55%** / lines **97.44%** (threshold 95)

---

## Architecture changes

| Before | After |
|--------|--------|
| Availability nested under reservations only | Shared `AvailabilityModule` (global) |
| Walk-in ignored calendar conflicts | Walk-in create/checkout call `assertItemsAvailable` |
| Assert then persist (TOCTOU) | `runExclusive` lock → assert → persist |
| Duplicate module ownership risk | LifecycleService = inventory; AvailabilityService = windows |

**Verified:**

- AvailabilityService = sole allocator  
- LifecycleService = sole inventory mutator  
- No duplicated overlap logic  

---

## Regression tests added

File: `test/rentals-integrity.spec.ts`

| Scenario | Expectation |
|----------|-------------|
| Walk-in vs confirmed reservation | 409 |
| Reservation vs walk-in draft | 409 |
| Concurrent reservation create | 1×201 + 1×409 |
| Concurrent walk-in create | 1×201 + 1×409 |
| Walk-in + reservation checkout | lifecycle → `rented` |
| Rollback on conflict | reservation count unchanged |
| Concurrent rental checkout | 1×200 + 1×409 |

Also updated `rentals-integration.spec.ts` concurrency case for the new create-time conflict semantics.

---

## Remaining risks (not blockers for Financial kickoff approval)

| Risk | Severity | Notes |
|------|----------|-------|
| `overdue` / `return_pending→completed` have no HTTP yet | Medium | Foundation transitions only |
| Availability scans load line rows then filter in memory | Medium | Fine for desktop SQLite; redesign before calendar scale |
| Lifecycle `skipAudit` inside checkout TX | Low | Domain audit still recorded on rental/reservation |
| Soft-delete of outbound docs | Low | Policy not fully specified |
| Number allocation outside exclusive TX | Low | Unique constraint; wasted numbers possible on conflict |

---

## Documentation

| Doc | Change |
|-----|--------|
| `PHASE_5_REMEDIATION_REPORT.md` | **Created** (this file) |
| `Architecture.md` | AvailabilityModule + remediation note |
| `RentalDesign.md` / `ReservationDesign.md` | Limitations cleared / allocator lock |
| `DevelopmentRoadmap.md` / `PROGRESS.md` | Phase 5.4 done; Financial approval gate |
| `DecisionLog.md` | ADR-V2-023 |
| Canvas | Integrity 90 · Financial blocked pending approval |

---

## Financial readiness

| Question | Answer |
|----------|--------|
| Phase 5.3 Must-Fix cleared? | **YES** |
| Integrity score | **90** |
| Ready to implement Financial code? | **NO — wait for approval** |
| Why? | Product/process gate; remaining Medium risks should be acknowledged before settlement work |

**STOP.** Do not start Phase 6 Financial until explicitly approved.

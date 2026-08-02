# Backend V2 — Phase 4 Engineering Certification (Inventory)

**Date:** 2026-08-02  
**Branch:** `backend-v2`  
**Mode:** Verification only — no feature implementation  
**Scope:** Inventory Catalog (4.1) + Lifecycle Foundation (4.2) + Media/Barcode integration  
**Stance:** Critical. Scores are evidence-based. Warnings and Must-Fix items are not ignored.

---

## Executive Summary

Phase 4.1–4.2 inventory deliverables were subjected to logical review, full automated suites, a live Nest certification harness (`scripts/cert-phase43.cjs`), schema inspection, TypeScript/architecture review, and documentation cross-check.

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (49 files / **161** tests) |
| `pnpm test:cov` | **PASS** (global thresholds met; see coverage) |
| `pnpm test:cov:inventory` | **PASS** (statements **95.71%** / lines **97.17%** / functions **100%**) |
| Live harness (`scripts/cert-phase43.cjs`) | **PASS** (8/8 security · 11/11 API · 0 errors) |

**Overall certification:** **PASS WITH WARNINGS**  
**Ready for Rental Engine?** **NO** — Must-Fix integrity items below block reservations/rentals.

Evidence artifact: `docs/backend-v2/cert_p43_harness.json`.

---

## Scorecard

| Area | Score | Verdict |
|------|------:|---------|
| Architecture | **78** | PASS WITH WARNINGS |
| Security | **80** | PASS WITH WARNINGS |
| Performance | **88** | PASS |
| Database | **74** | PASS WITH WARNINGS |
| API | **79** | PASS WITH WARNINGS |
| Testing | **86** | PASS |
| Documentation | **84** | PASS |
| Maintainability | **72** | PASS WITH WARNINGS |
| **Overall** | **78** | **PASS WITH WARNINGS** |

Scoring rubric: 90–100 strong; 80–89 production-capable with tracked debt; 70–79 conditional; <70 fail gate.

Inventory is **conditionally certified as a catalog + lifecycle foundation**. It is **not** certified as rental-ready.

---

## 1. Logical Review

| Area | Verdict | Notes |
|------|---------|-------|
| Catalog Item + taxonomy | **PASS** | Generic Item (not dress-hardcoded); Category tree-ready; Brand/Color/Size CRUD |
| Media integration | **WARNING** | Uses `MediaService.attach` **and** `ItemMedia` dual write — drift risk under partial failure |
| Barcode integration | **WARNING** | Generate/reserve/activate via platform — good; soft-delete does **not** release barcodes |
| Single lifecycle engine | **PASS** | Closed `ITEM_LIFECYCLE_TRANSITIONS`; domains must call `LifecycleService` |
| Transition rules | **PASS** | Happy path + sale/maintenance/lost/damaged; invalid edges → 409 |
| Dead transitions | **WARNING** | `cleaning` cannot go to lost/damaged/retired; `sold` only → retired (no cancel) — ops traps, not cycles |
| Circular transitions | **PASS** | No infinite loops; returns to `available` are intentional |
| History | **WARNING** | Birth row `available→available` pollutes “transition = change” semantics |
| Availability helpers | **WARNING** | `isRentable`/`isSellable` correct; `isOperational` includes **draft** — dangerous if misused |
| Impossible states | **FAIL→Must Fix** | Soft-delete allowed while `reserved`/`rented`; catalog `retired` + lifecycle `available` creatable |
| Duplicated state logic | **PASS** | No second state machine found outside lifecycle module |
| Architecture leaks | **WARNING** | Parallel `ItemMedia` vs MediaReference; taxonomy RBAC split (`categories.*` vs `inventory.*`) |
| Naming collision | **WARNING** | Catalog `status=retired` vs lifecycle `retired` — same token, two axes |

Harness documented debt probe: soft-delete while reserved currently returns **200**.

---

## 2. Functional Testing

| Capability | Evidence | Verdict |
|------------|----------|---------|
| Taxonomy CRUD + restore | Integration + harness | **PASS** |
| Item CRUD / search / filter | Integration + harness | **PASS** |
| Soft delete / restore | Integration + harness | **PASS** (restore status debt — see #6) |
| Barcode on create | Integration + harness | **PASS** |
| Media attach HTTP | Integration / unit | **PASS** (service path) |
| Transition valid / invalid | Integration + harness | **PASS** |
| Concurrent CAS transitions | Unit + harness (1 win / 1 lose) | **PASS** |
| 409 conflicts | Skip reserved→rented; edit while reserved | **PASS** |
| Permissions (auth required) | Harness 401 | **PASS** |
| History | Harness + integration | **PASS** |

---

## 3. Database Review

| Check | Result | Verdict |
|-------|--------|---------|
| Tables | 25 (incl. Item, taxonomy, ItemMedia, ItemBarcode, ItemStateHistory) | **PASS** |
| Indexes | 103 | **PASS** |
| Item FKs to taxonomy | Present; `ON DELETE SET NULL` | **PASS** |
| History → Item | `ON DELETE CASCADE` (hard delete) | **PASS** |
| Soft-delete behavior | App-level `deletedAt`; live queries filter null | **PASS** |
| Partial unique live taxonomy names | Raw SQL in migration (`lower(name)` WHERE deletedAt IS NULL) | **WARNING** — not modeled in Prisma schema (introspection drift risk) |
| `ItemMedia` unique | `(itemId, mediaFileId, purpose)` ignores soft-delete | **WARNING** — re-attach after soft-delete media row fails |
| Migrations | Catalog + lifecycle applied on boot/harness | **PASS** |
| Integrity / free-text enums | `status` / `lifecycleState` are TEXT — app-enforced only | **WARNING** |
| Harness `PRAGMA foreign_keys` | Reported false in probe | **WARNING** — verify Prisma connection still enables FK (boot path); migrations define FKs |

---

## 4. Performance (live harness)

| Metric | Value |
|--------|------:|
| Migrate deploy | **3027 ms** |
| Nest test-module boot | **830 ms** |
| RSS after boot | **121 MB** |
| Taxonomy create (4 entities) | **80 ms** |
| Item create + barcode | **65 ms** |
| Catalog search/filter | **26 ms** |
| Internal-code lookup | **33 ms** |
| Lifecycle transition | **51 ms** |
| History retrieval | **13 ms** |
| Concurrent transitions | **22 ms** |

**Verdict:** **PASS** for desktop-first SQLite. Acceptable local latency. Revisit taxonomy `findAnyName` full-table scan before multi-writer LAN.

---

## 5. Security

| Attack / control | Verdict | Evidence |
|------------------|---------|----------|
| Unauthenticated `/items` | **PASS** | Harness 401 |
| Unauthenticated transition | **PASS** | Harness 401 |
| State skipping | **PASS** | 409 |
| Catalog edit mid-lifecycle | **PASS** | 409 while reserved |
| Deleted item get/transition | **PASS** | 404 |
| Invalid payloads | **PASS** | 400 |
| Concurrent transition race | **PASS** | CAS |
| Soft-delete mid-rental lifecycle | **FAIL (debt)** | Currently allowed — Must Fix |
| Draft lifecycle transitions | **WARNING** | Transition does not block `draft` catalog status |
| Permission model inconsistency | **WARNING** | Categories use `categories.*`; brands/colors/sizes use `inventory.*` |
| Custom role can bind barcodes via `inventory.create` without `barcode.*` HTTP | **WARNING** | Document / decide policy |
| Horizontal row ACL | **WARNING** | Desktop role-based model (same as Phase 3) |

---

## 6. API Review

| Surface | Verdict |
|---------|---------|
| `/categories` CRUD + restore | **PASS** |
| `/brands` `/colors` `/sizes` CRUD + restore | **PASS** |
| `/items` CRUD + search + code + media | **PASS** |
| `/items/:id/state` `/history` `/transition` | **PASS** |
| DTO validation on transition `newState` | **PASS** (`@IsIn`) |
| List `lifecycleState` filter | **WARNING** — plain string; typos → empty result, not 400 |
| Create `description` | **WARNING** — accepted by DTO, **not persisted** on create |
| Update DTO still lists `barcode` / `generateBarcode` | **WARNING** — ignored on PATCH (lying surface) |
| Error consistency (400/401/404/409) | **PASS** for exercised paths |
| Serialization includes `lifecycleState` | **PASS** |

---

## 7. Architecture Review

| Principle | Verdict |
|-----------|---------|
| Single lifecycle engine | **PASS** |
| No duplicated transition graphs | **PASS** |
| Media platform reused | **PASS** with dual-join warning |
| Barcode platform reused | **PASS** with incomplete release coupling |
| Audit reused (`TRANSITION`) | **PASS** |
| Repository private; services exported | **PASS** |
| Module coupling | **PASS** — inventory does not import rentals/sales (none exist) |
| Compensating transactions on create+barcode | **FAIL→Must Fix** |
| Soft-delete lifecycle gates | **FAIL→Must Fix** |

---

## 8. TypeScript Review

| Check | Verdict |
|-------|---------|
| `strict: true` | **PASS** |
| `any` / `@ts-ignore` / `@ts-nocheck` in `src/inventory` | **PASS** (none) |
| Lint clean | **PASS** |

---

## 9. Test Coverage

### Inventory gate (`pnpm test:cov:inventory`)

| Metric | Value |
|--------|------:|
| Statements | **95.71%** (402/420) |
| Branches | **90.4%** (292/323) |
| Functions | **100%** (151/151) |
| Lines | **97.17%** (379/390) |

| Subtree | Lines | Notes |
|---------|------:|-------|
| `lifecycle/` | **100%** | Transition engine well covered |
| `items/` | **~97.6%** | Strong |
| `taxonomy.ts` | **~92.9%** | Some update/parent edges thinner |

### Global (`pnpm test:cov`)

Thresholds green (suite 161 tests). Weak non-inventory areas remain (migrate-on-boot, users admin edges) — unchanged from Phase 3.4.

**Verdict:** **PASS** for inventory coverage gate.

---

## 10. Documentation Review

| Doc | Matches code? |
|-----|---------------|
| `InventoryDesign.md` | **PASS** (catalog + lifecycle diagram) |
| `Architecture.md` | **PASS** (4.1 + 4.2 sections) |
| ADR-V2-016 / 017 | **PASS** |
| Roadmap / PROGRESS | **Updated** this certification |
| Canvas | **Updated** to Phase 4.3 YOU ARE HERE |
| Gaps | Soft-delete/barcode release contract **under-documented** — Must Fix docs alongside code |

---

## 11. Technical Debt

### Critical
1. **Soft-delete allowed while item is reserved/rented/return_pending** — destroys ops integrity for future rentals.  
2. **Soft-delete does not release barcodes / soft-delete `ItemBarcode`** — scanners remain bound to deleted entities.  
3. **Create+barcode path is not transactional** — activate-then-fail soft-deletes item but leaves barcode activated.

### High
4. **Restore leaves `status=inactive`** — restored items stay non-operational until manual PATCH.  
5. **`isOperational` includes draft; transitions allow draft** — incomplete catalog stock can enter reserved/rented.  
6. **Dual `ItemMedia` + `MediaReference` without shared transaction** — drift under partial failure; unique ignores soft-delete.  
7. **Catalog `retired` vs lifecycle `retired` naming collision**.  
8. **Taxonomy RBAC inconsistency** (`categories.*` vs `inventory.*` for peer entities).  
9. **Taxonomy uniqueness TOCTOU** (app scan + partial SQL index; P2002 may surface as 500).

### Medium
10. Create `description` dropped; Update DTO advertises unused barcode fields.  
11. `lifecycleState` list filter not enum-validated.  
12. Inactive taxonomy (`isActive=false`) still linkable.  
13. Category parent cycles (A→B→A) not detected.  
14. Birth history `available→available`.  
15. Ops dead-ends (`cleaning` lacks lost/damaged; `sold` no cancel).  
16. Partial unique indexes only in raw SQL (Prisma schema drift).

### Low
17. Redundant internalCode index.  
18. `ITEM_SORT_FIELDS` omits `lifecycleState`.  
19. Shared taxonomy DTOs carry unused fields per kind.  
20. Two `@Controller('items')` classes — fragile for future routes.

---

## 12. Must Fix (before Rental Engine)

| # | Item | Blocking rentals? |
|---|------|-------------------|
| 1 | Reject soft-delete (and catalog retire) when lifecycle ∉ safe set | **YES** |
| 2 | On item soft-delete: release barcodes + soft-delete joins | **YES** |
| 3 | Transactional create / compensating barcode release | **YES** |
| 4 | Restore prior catalog status (or explicit restore policy) | **YES** |
| 5 | Block lifecycle transitions unless catalog `active` (draft ≠ operational) | **YES** |
| 6 | Single attachment model **or** transactional dual-write + detach on delete | **YES** |
| 7 | Document barcode/media lifecycle contracts in InventoryDesign | Docs |

**No Rental Engine / Reservations / Calendar work until these land and are re-probed.**

---

## 13. Recommended Improvements

1. Rename axes: `catalogStatus` vs `lifecycleState` tokens (avoid dual `retired`).  
2. Unify taxonomy permissions (`taxonomy.*` or per-entity keys).  
3. Map Prisma P2002 → 409 for taxonomy/item unique races.  
4. Validate list `lifecycleState` with `@IsIn`.  
5. Persist create `description`; remove unused update barcode fields or implement.  
6. Soft-delete-aware unique for `ItemMedia`.  
7. Extend transition graph for laundry loss (`cleaning` → lost/damaged).  
8. Keep `scripts/cert-phase43.cjs` as CI smoke for inventory.

---

## 14. Ready for Rental Engine?

**NO.**

Automated quality gates pass and the **single lifecycle engine** is the correct architectural bet. However Critical/High integrity holes (soft-delete mid-flow, barcode orphans, non-transactional bind, restore status, draft transitions, media dual-write) will poison reservations and rentals if ignored.

**Next allowed work (after approval):** Must-Fix remediation commit(s) — still **no** rentals/reservations/calendar/payments until a remediation re-cert note.

---

## Appendix A — Harness summary

- Generated: `2026-08-02T08:32:58.879Z`  
- Security probes (non-debt): **8/8** passed  
- API probes: **11/11** passed  
- Errors: **0**  
- Full JSON: `cert_p43_harness.json`

## Appendix B — Commands

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:cov
pnpm test:cov:inventory
node scripts/cert-phase43.cjs
```

## Appendix C — HTTP inventory surface (certified)

| Area | Paths |
|------|-------|
| Categories | `/categories` |
| Brands / Colors / Sizes | `/brands` `/colors` `/sizes` |
| Items | `/items` `/items/search` `/items/code/:code` `/items/:id` `/items/:id/media` |
| Lifecycle | `/items/:id/state` `/items/:id/history` `/items/:id/transition` |

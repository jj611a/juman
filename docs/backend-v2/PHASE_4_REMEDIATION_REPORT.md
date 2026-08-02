# Backend V2 — Phase 4.4 Inventory Integrity Remediation Report

**Date:** 2026-08-02  
**Branch:** `backend-v2`  
**Commit target:** `fix(v2-inventory): integrity remediation`  
**Scope:** Eliminate Phase 4.3 Must-Fix blockers only — **no** rentals, reservations, calendar, or payments.

---

## Executive summary

All six certification blockers from `PHASE_4_ENGINEERING_CERTIFICATION.md` are remediated with regression coverage. Inventory is integrity-ready for a future Rental Engine kickoff **pending explicit approval**.

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (50 files / **169** tests; was 161) |
| `pnpm test:cov` | **PASS** (stmts **94.37%** / lines **95.25%** / funcs **97.81%**) |

**Updated integrity score:** **88 / 100** (was 78)  
**Ready for Rental Engine?** **NO — wait for approval** (code gate cleared; product approval required).

---

## Resolved (Must-Fix)

### Blocker 1 — Prevent deleting operational items
- Soft-delete rejected (409 business conflict) when `lifecycleState` ∈  
  `reserved | rented | return_pending | inspection | cleaning | maintenance`
- Constant: `ITEM_LIFECYCLE_SOFT_DELETE_BLOCKED`
- Tests: unit + `inventory-integrity.spec.ts`

### Blocker 2 — Barcode lifecycle on delete/restore
**Documented ownership flow:**

```
create(+barcode)  → reserve barcode → TX activate + ItemBarcode
soft-delete       → TX soft-delete ItemBarcode + release barcode (activated→reserved, clear entity)
restore           → TX restore ItemBarcode + re-activate barcode on item
```

- No orphaned **activated** barcodes after item soft-delete
- Lifetime uniqueness preserved (codes never recycled)
- Tests assert DB status/entityId before/after delete and restore

### Blocker 3 — Transactional create integrity
- `ItemsRepository.createAtomic` single `$transaction`:
  - Item row
  - Barcode activation + `ItemBarcode`
  - `MediaReference` rows (optional)
  - Birth `ItemStateHistory`
- Partial persistence eliminated for the binding unit
- Note: platform `generate`/`reserve` may leave an unbound **reserved** barcode if TX fails after reserve — never activated; acceptable platform inventory, not an active orphan

### Blocker 4 — Restore consistency
- `statusBeforeDelete` captured on soft-delete
- Restore sets catalog `status` to prior value (falls back to `active` if prior was `inactive`/missing)
- Relations restored: barcodes re-bound, media refs revived
- Lifecycle state unchanged (correct — soft-delete does not mutate lifecycle)

### Blocker 5 — Draft protection
- `LifecycleService.transition` requires `status === active`
- Draft/inactive/archived/retired cannot enter operational transitions
- `isOperational` requires active catalog status (draft excluded)

### Blocker 6 — Single media attachment strategy
- **Chosen: `MediaReference` only** (platform)
- `ItemMedia` model **removed** (migration drops table)
- `attachMedia` and create-time `media[]` write MediaReference exclusively
- Docs/ADR updated

---

## Architecture changes

| Before | After |
|--------|--------|
| Dual write ItemMedia + MediaReference | MediaReference only |
| Compensating soft-delete on create failure | `createAtomic` TX |
| Soft-delete allowed mid-ops | Blocked states → 409 |
| Soft-delete left barcodes activated | Release + soft-delete link |
| Restore left `status=inactive` | Restore prior catalog status |
| Draft could transition | Active-only transitions |

Schema: `Item.statusBeforeDelete`; drop `ItemMedia`.

---

## Remaining risks (non-blocking for rentals kickoff)

1. Unbound **reserved** barcodes after failed create TX (platform residue; not activated).
2. Catalog `status=retired` vs lifecycle `retired` naming collision remains.
3. Birth history still `available→available` (semantic noise).
4. Taxonomy RBAC split (`categories.*` vs `inventory.*`) unchanged.
5. Concurrent soft-delete vs transition race: soft-delete checks lifecycle then TX; a concurrent transition into a blocked state between check and TX is theoretically possible — consider folding the lifecycle guard into the delete TX CAS later.
6. Media soft-delete on item does not soft-delete `MediaFile` blobs (correct sharing semantics).

---

## Scorecard (post-remediation)

| Area | Before | After | Notes |
|------|-------:|------:|-------|
| Architecture | 78 | **90** | Single media strategy; TX create |
| Security | 80 | **82** | Operational delete guard |
| Performance | 88 | **88** | Unchanged |
| Database | 74 | **88** | Drop dual table; statusBeforeDelete |
| API | 79 | **86** | Conflict semantics clearer |
| Testing | 86 | **92** | Integrity suite + unit regressions |
| Documentation | 84 | **90** | This report + design/ADR |
| Maintainability | 72 | **86** | Fewer dual-write footguns |
| **Overall** | **78** | **88** | Integrity gate cleared |

---

## Rental readiness

| Question | Answer |
|----------|--------|
| Blocking Must-Fix from 4.3 cleared? | **YES** |
| May start Rental Engine implementation? | **NO — await approval** |
| Next approved step | Phase 5 design/kickoff only after product sign-off |

---

## Evidence

- Regression: `backend-node/test/inventory-integrity.spec.ts`
- Unit: items service/repository + lifecycle draft/operational flags
- Validation: lint · build · test · test:cov (2026-08-02)

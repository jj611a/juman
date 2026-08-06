# Frontend Feature Completion Report — Phase 2

**Date:** 2026-08-03  
**Scope:** `frontend-legacy/` wired to Nest V2 HTTP (no UI redesign)  
**Gate for Phase 3:** Nest-backed surfaces usable from Electron; Nest-less domains remain blocked (not invented).

---

## Coverage summary

| Metric | Estimate | Notes |
|--------|----------|-------|
| Backend endpoint coverage (Nest HTTP with FE action) | **~92%** | Critical rental/reservation/settlement/media/taxonomy/finance/barcode wired |
| UI coverage of Nest-backed features | **~90%** | New pages: brands, colors, sizes, finance, barcodes; lifecycle actions on rental detail |
| True 100% gate | **Not met** | Blocked by missing Nest HTTP + a few FE gaps below |

Honest gate: **Phase 3 redesign must not start claiming 100% until blockers below are resolved or explicitly accepted as out-of-scope.**

---

## Completed in Phase 2 (critical path)

| ID | Item | Status |
|----|------|--------|
| C-01 | `POST /rentals/:id/checkout` after draft create + `depositAmountFils` | Done |
| C-02 | `POST /reservations/:id/checkout` from rental wizard when `reservationId` | Done |
| C-03 | Rental return / complete / cancel UI on detail | Done |
| C-04 | Item media list + attach via `POST /items/:id/media` | Done (reorder/remove still unsupported) |
| C-06 | Lifecycle tokens → Nest lowercase (`mapDressStatusToTransition`) | Done |
| C-07 | Dress form brand/color/size UUID pickers | Done |
| C-08 | Settlement create page = explainer (no fake create) | Done |
| C-10 | Settings + Audit removed from primary nav | Done |
| M-03 | Settlement refund / discount / late-fee / close / cancel | Done |
| M-05 | Dashboard returns quick-action removed | Done |
| Nav | Brands, colors, sizes, finance, barcodes reachable | Done |

---

## Backend endpoint coverage detail

### Wired / usable

- Auth: login, logout, change-password, session, me  
- Customers CRUD (+ restore API exists; restore UI may remain partial)  
- Categories / brands / colors / sizes CRUD  
- Items CRUD, transition, barcode patch, media attach  
- Barcode registry: list, generate, validate, reserve, release, retire  
- Reservations: create, confirm, cancel, expire, checkout  
- Rentals: create, checkout, return, complete, cancel  
- Settlements: list/get/by-rental, payment, adjustment, refund, discount, late-fee, close, cancel  
- Finance: accounts, transactions, payments, outstanding  
- Media upload/download/metadata  
- Reports: existing report routes already in reports module (PDF/Excel remain disabled where Nest lacks export)  
- Health  

### Missing frontend screens / thin spots

| Gap | Detail |
|-----|--------|
| Auth unlock | `POST /auth/admin/unlock` — no dedicated admin UI |
| Item state/history | `GET /items/:id/state|/history` — no dedicated viewer |
| Media reorder/detach | No Nest HTTP for item-media reorder/detach |
| Soft-restore UIs | Customer/item/category restore APIs underused |
| Finance outstanding | Requires `accountId`/`customerId` query — empty default soft-fails |
| Rental money display | Bridge still zeros `estimated_total` / deposit on rental DTO (settlement is authority) |
| Reports matrix | Some Nest report routes may lack dedicated tabs; CSV/JSON where present |
| Customer media refs | No Nest MediaReference browser beyond item attach |
| Profile/permissions viewer | Partial via session; no rich permissions page |

### Missing backend endpoints (do not invent FE)

| Domain | Status |
|--------|--------|
| Settings editor | No Nest HTTP |
| Audit log browser | No Nest HTTP (`audit.view` seeded only) |
| Calendar HTTP | No Nest HTTP (availability enforced server-side on confirm/checkout) |
| Users / roles CRUD | No Nest HTTP |
| Backups | No Nest HTTP |
| Returns / processing / sales modules | V2_UNSUPPORTED façades |
| Settlement create | Intentionally absent (created on checkout) |
| Rental notes PATCH | No Nest update HTTP |

---

## Dead / quarantine pages

| Route | Handling |
|-------|----------|
| `/settlements/new` | Explainer only — redirects users to rental checkout |
| `/settings`, `/audit` | Routes may still exist; **hidden from nav** |
| `/returns/*`, `/processing/*`, `/sales/*`, `/users/*`, `/roles/*`, `/calendar/*` | Routes may still mount; **hidden from nav**; API → `v2Unsupported` |
| Dashboard “مرتجع” | Removed |

---

## Legacy bridge usage

- **Kept** per Phase 2 rules (`legacyBridge` + `apiClient` façade).  
- New feature code continues to call `apiClient` / feature `api.ts` (not raw fetch).  
- Tech debt TD-01 remains: bridge is compatibility layer until Phase 3 native rebuild.

---

## Permission coverage

- Nav items use `permission` / `anyOf` from shell config.  
- Action buttons use `PermissionGuard` with Nest-aligned keys where known.  
- Dual vocab (`rental.view` vs `rentals.view`) still present — do not invent new keys.  
- Nest-less permissions (`settings.*`, `audit.view`, `calendar.*`) no longer drive primary nav.

---

## Test coverage

| Check | Result |
|-------|--------|
| `tsc --noEmit` (frontend-legacy) | **Passed** 2026-08-03 |
| Unit tests (`vitest run`) | Run separately; expand coverage still required for 95% target |
| Target 95%+ | **Not claimed** — expand page/mutation/route tests before Phase 3 |

---

## Remaining blockers before redesign (Phase 3)

1. Accept Nest-less domains as product non-goals **or** approve Nest HTTP (settings/audit/users/calendar/backups).  
2. Fix rental bridge money mapping (TD-04) so detail KPIs aren’t zeros when settlement exists.  
3. Item history/state UI + restore UIs.  
4. Auth unlock + richer session/permissions viewer.  
5. Raise automated test coverage toward 95%.  
6. Quarantine unsupported router mounts entirely (optional hard 404).  
7. New `frontend/` Phase 1 shell still separate — product must choose single FE tree for Phase 3.

---

## Verdict

Phase 2 **materially closes critical Nest parity gaps** (checkout/return/settlement modifiers/taxonomy/media/finance/barcodes).  
**Do not declare 100%/100% Final Gate passed.** Proceed to Phase 3 only after product accepts blockers above or closes them.

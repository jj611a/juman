# Backend V2 Architecture

**Status:** Phase 4.3 Inventory Engineering Certification  
**Branch:** `backend-v2`  
**Spec source:** `backend-python/` (read-only Python FastAPI stack)

## Target runtime

```
Electron (desktop) — Main process owns tokens
    ↓ Bearer access JWT
NestJS (backend-node) — binds HOST (default 127.0.0.1)
    ↓
Prisma ORM + migrate deploy on boot
    ↓
SQLite → data/juman.db (WAL, foreign_keys, busy_timeout)
```

## Design goals

- Desktop-first, single-machine, offline-first
- Zero manual database configuration (no PostgreSQL)
- Single installer packaging path (Electron + Nest sidecar) — Phase 8
- Same business behavior as Python V1, reimplemented cleanly (not ported line-by-line)

## Runtime directories

On first startup the Nest process ensures:

| Directory | Purpose |
|-----------|---------|
| `data/` | SQLite file `juman.db` |
| `logs/` | Application / error / startup / request logs |
| `storage/` | Media and file storage |
| `config/` | `juman.env` runtime configuration |

Then: **Prisma `migrate deploy`** → schema verify → Nest boot. Migration failure aborts startup.

## Configuration

Loaded from `config/juman.env`. Missing files are generated with safe defaults (including a random `JWT_SECRET`, `HOST=127.0.0.1`). Production requires an explicit `JWT_SECRET` (≥32 chars). Startup logs report the **actual** bound host/port.

## Logging

Winston console + daily rotating JSON under `logs/` (application / errors / startup / requests).

## API surface (Phase 2.4)

- `GET /health` — public
- `POST /auth/login` / `POST /auth/logout` / `POST /auth/change-password`
- `POST /auth/admin/unlock` — Bearer + `users.unlock`
- `GET /auth/session` / `GET /auth/me`

See `AuthenticationDesign.md`, `SecurityDesign.md`, and `backend-node/README.md`.

## Layers

```
src/
  main.ts, app.module.ts   ← APP_GUARD registration (not AuthModule)
  config/, core/, database/, health/, logging/, exceptions/, validation/, storage/, shared/
  security/       Argon2 (+ dummy verify), JWT, opaque tokens, password policy
  auth/           guards, strategies, session/refresh, login/logout/unlock/me
  users/          repository internal; service is public boundary
  roles/          system roles + permission resolution (service export only)
  permissions/    catalog seed (service export only)
  shared/         money, pagination, search, soft-delete, errors
  settings/       AppSetting typed config
  audit/          AuditService.record (append-only)
  media/          MediaFile + HTTP /media
  barcode/        reusable platform + HTTP /barcodes
  customers/      Customer domain
  inventory/      Catalog engine (Item + taxonomy + lifecycle)
  rentals/        Rental workflow core (Phase 5.1)
  reservations/   Reservation engine (Phase 5.2)
  availability/   Sole calendar allocator (Phase 5.4)
  finance/        Financial foundation + Settlement (6.1–6.6)
  reports/        Read-only reporting engine (Phase 7.0)
```

## Auth / RBAC

- Argon2id passwords; opaque refresh tokens (hashed); HS256 access JWT bound to session (`sid`)
- Refresh rotation is transactional CAS (one live chain; reuse detection intact)
- Permissions resolved from DB per request (not embedded in JWT)
- System roles Admin / Cashier / Inventory / Laundry seeded on startup
- Full permission catalog preserved from Python V1
- Disable account revokes all sessions + refresh tokens immediately

## What is not in V2 (yet)

- Users/roles admin HTTP CRUD (beyond unlock)
- Availability calendar UI / late-fee **scheduler** / invoices / PDF-Excel report renderers
- Laundry / inspection / sales workflows
- Barcode hardware adapters / label printing
- Electron process management / installer Nest packaging

## Python V1

`backend-python/` remains the official behavioral specification until full parity. Do not modify its application code on this track.

See `SharedFoundation.md` for Phase 3.1 contracts.


## Customer domain (Phase 3.2)

First business module: `src/customers` over Prisma `Customer`.

- Soft delete + restore; primary-phone uniqueness among **active live** rows
- Shared phone normalization (`src/shared/phone`)
- Audit via `AuditService` (create/update/soft_delete/restore; optional view)
- Attachments deferred to shared `MediaReference` (no CustomerAttachment table)
- Docs: `CustomerDomain.md`, `CustomerAPI.md`


## Media domain (Phase 3.3)

Reusable `MediaModule` is the only blob store. Domain modules attach via `MediaReference`. Soft-delete keeps bytes for restore. Docs: `MediaDomain.md`.

## Barcode platform (Phase 3.5)

Reusable `BarcodeModule` is the only barcode authority. Domains bind via `activate(entityType, entityId)`; HTTP is generic registry only (`/barcodes`). Status: reserved → activated → reserved (release) or retired. Values are globally unique for life. Hardware ports are design-only. Docs: `BarcodePlatform.md`.

## Inventory catalog (Phase 4.1)

Generic Item Catalog in `src/inventory` — not a dress-specific engine. Taxonomy: Category (tree-ready), Brand, Color, Size. Items bind barcodes via `ItemBarcode` and media via platform **MediaReference only** (no `ItemMedia`). Catalog statuses only (draft/active/inactive/archived/retired). Soft-delete/restore and create binding are transactional; operational lifecycle delete is guarded. Docs: `InventoryDesign.md`, `PHASE_4_REMEDIATION_REPORT.md`.

## Inventory lifecycle (Phase 4.2)

Authoritative operational `lifecycleState` on `Item` with `ItemStateHistory` and `LifecycleService.transition` (CAS + audit). Availability predicates (`isRentable` / `isSellable` / …) only — no reservations or calendar. Docs: `InventoryDesign.md`.

## Inventory certification (Phase 4.3–4.4)

Non-feature gate then remediation: `PHASE_4_ENGINEERING_CERTIFICATION.md` → `PHASE_4_REMEDIATION_REPORT.md` (integrity **88**). Must-Fix blockers cleared.

## Rental workflow core (Phase 5.1)

`RentalsModule` owns rental documents (`Rental` / `RentalItem` / `RentalStatusHistory`). Inventory lifecycle mutations go **only** through `LifecycleService` inside shared transactions. No payments or settlements. Docs: `RentalDesign.md`.

## Reservation engine (Phase 5.2)

`ReservationsModule` + reusable `AvailabilityService`. Reservations are independent until checkout materializes a `Rental`. Docs: `ReservationDesign.md`.

## Phase 5 engineering certification (5.3)

Non-feature gate: `PHASE_5_ENGINEERING_CERTIFICATION.md` (overall **76**, **PASS WITH WARNINGS**).  
Must-Fix items remediations: `PHASE_5_REMEDIATION_REPORT.md` (integrity **90**).

## Availability / allocation (Phase 5.4)

`AvailabilityModule` (`src/availability`) is the **sole** calendar conflict allocator.  
Walk-in rentals, reservation create/checkout (and future transfers) must call `AvailabilityService` inside `runExclusive` (assert + persist, no TOCTOU).  
Inventory mutations remain exclusive to `LifecycleService`.

## Financial (Phase 6)

`FinanceModule` (`src/finance`) is the sole owner of money.  
**Phase 6.5:** Atomic checkout TX + idempotency + cancel policy.  
**Phase 6.6:** Settlement owns refund / adjustment / discount / late-fee assessment; centralized formulas in `settlement.formula.ts`.  
Docs: `FinancialDesign.md`, `SettlementDesign.md`.

## Reporting engine (Phase 7.0)

`ReportsModule` (`src/reports`) is **read-only**. It aggregates Inventory / Rental / Settlement / Finance via Prisma and never calls domain write services or recalculates settlement formulas. Export: CSV/JSON implemented; PDF/Excel adapters stubbed. Docs: `ReportingDesign.md`.

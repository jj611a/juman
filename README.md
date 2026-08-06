# جمان (Juman)

Professional Dress Rental & Sales Management System

---

## Overview

**Juman (جمان)** is an enterprise Desktop POS and rental management system built for dress stores that both **sell** and **rent** dresses.

- **Client:** Windows Desktop via **Electron** + React + TypeScript
- **UI language:** Arabic (RTL) first — English is reserved for source code, APIs, and database naming
- **Backend:** FastAPI (Python 3.13+), async SQLAlchemy 2.0, Alembic, Pydantic v2
- **Database:** PostgreSQL
- **Currency:** Iraqi Dinar (د.ع)
- **Architecture:** Clean Architecture + Domain-Driven Design, modular and production-oriented

The system is developed **incrementally**. Each backend module plugs into the foundation without rewriting existing code.

---

## Features

### Completed

- Backend foundation (config, async DB, Alembic, JWT/Argon2 infrastructure, logging, exceptions, health/version APIs)
- Settings module (database-driven business configuration + seeds + validation + CRUD)
- Authorization / RBAC module (permissions, roles, role–permission links, system roles, admin CRUD APIs)
- Identity / Users module (login, sessions, refresh tokens, lockout, user admin, RBAC enforcement)
- Media module (generic StoredFile / FileReference storage, local provider, auth-protected APIs)
- Audit module (enterprise change log infrastructure + admin read API)
- Categories module (organizational dress labels, auth-protected, audited)
- Customers module (store parties for rentals/sales; numbered `CUS-########`; auth-protected, audited)
- Inventory / Dresses Phase 1–5 — assets, barcode, photos, Status Engine, search/filter API (auth-protected, audited)
- Calendar Engine — dress availability timelines and conflict APIs (auth-protected, audited)
- Reservations — draft/confirm holds via Calendar + Status engines (auth-protected, audited)
- Rentals — walk-in / reservation handover with estimated total + initial payment (auth-protected, audited)
- Returns — full physical receipt into inspection handoff (auth-protected, audited)
- Inspection — condition assessment → AVAILABLE / PROCESSING / RUINED_PENDING_SALE (auth-protected, audited)
- Processing — laundry batches with mandatory/optional days → AVAILABLE (auth-protected, audited)
- Rental Financial Settlement — post-return fils balances, late/damage, payments (auth-protected, audited)
- Sales — normal + mandatory damage purchase; atomic full payment; SAL-######## (auth-protected, audited)
- Reports — read-only ops + financial aggregates; reports.view / reports.financial.view
- System Administration Phase 1–5 — info, diagnostics, metrics, maintenance, backups, restore, audit/security
- Backend Phase 6 — **v1.0 Production Ready** ([readiness report](docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md))

### In Progress

- None

### Planned

- General POS (`payment.*`)
- Notifications
- Frontend login screen + business modules (Arabic RTL POS UI)
- Hardware: barcode scanner, thermal receipt/label printers, A4 printing

---

## Current Progress

### Backend Foundation

- [x] Clean Architecture
- [x] FastAPI
- [x] Async SQLAlchemy
- [x] Alembic
- [x] JWT Infrastructure (helpers + Identity issuance)
- [x] Argon2 password hashing helpers
- [x] Repository Pattern
- [x] Service Layer
- [x] Structured Logging
- [x] Global Exception Handling
- [x] Configuration System
- [x] Health API
- [x] Version API
- [x] Optional Redis readiness
- [x] Foundation tests

### Settings Module

- [x] Database Model
- [x] Repository / Service
- [x] CRUD APIs
- [x] Validation
- [x] Seed Data
- [x] Typed accessors (`get_int`, `get_bool`, …)
- [x] Tests

### RBAC (Authorization)

- [x] Permission model
- [x] Role model
- [x] RolePermission association
- [x] CRUD APIs
- [x] Assign / remove permissions
- [x] Permission lookup by key
- [x] System roles seed (Admin, Cashier, Inventory, Laundry)
- [x] Comprehensive permission catalog (including `media.*`)
- [x] `require_permission` / `require_any_permission` / `require_all_permissions` (wired to Identity)
- [x] Tests
- [x] Connected to Users / route enforcement

### Users

- [x] User model + sessions + refresh tokens + login history + password history
- [x] Username login / refresh / logout / logout-all
- [x] Admin user CRUD (activate, deactivate, reset, unlock, assign role)
- [x] RBAC wired (`require_permission*`)
- [x] Settings + RBAC APIs protected
- [x] Tests (≥90% Identity coverage)

### Media

- [x] StoredFile + FileReference models (business-agnostic)
- [x] Local storage provider + cloud stubs
- [x] Upload / download / replace / delete + reference CRUD APIs
- [x] Settings-driven validation + `media.*` permissions (enforced)
- [x] Tests (≥90% Media coverage)
- [x] Authenticated APIs (Bearer + `media.upload|view|delete|manage`)

### Audit

- [x] Append-only `AuditLog` model (entity, action, old/new values, user, IP, module, metadata)
- [x] `AuditService` record/list infrastructure for future modules
- [x] Admin `GET /api/v1/audit/logs` (+ by id) behind `audit.view`
- [x] Alembic migration + Admin permission seed
- [x] Tests (≥90% Audit coverage)
- [ ] Wire into existing Settings/RBAC/Identity/Media services (deferred)

### Categories

- [x] Category model (Arabic name unique among live rows, optional English name)
- [x] CRUD + activate / deactivate APIs
- [x] List active / all with search, sort, pagination
- [x] Permissions `categories.view|create|update|delete` enforced
- [x] AuditService integration on mutations
- [x] Soft-delete guard for dress references (live dress COUNT)
- [x] Tests (≥90% Categories coverage)
- [x] Alembic `20260726_0012_categories`

### Inventory

- [x] Dress asset model (serialized garment; IQD prices; size/colour allowlists)
- [x] Barcode NOT NULL + lifetime uniqueness (partial unique among live rows)
- [x] `BarcodeService` sequential generation (`DR-00000001`) via `barcode_counters`
- [x] Settings `inventory.barcode.prefix|separator|padding`
- [x] Auto-generate on create; manual entry when format-valid
- [x] `GET /dresses/barcode/{barcode}` lookup
- [x] Admin-only `PATCH /dresses/{id}/barcode` (regenerate / override; history stub)
- [x] Category FK `ON DELETE RESTRICT` + soft-delete guard wired
- [x] Status stored enum only (default `AVAILABLE`; no transitions)
- [x] CRUD + activate / deactivate APIs under `/api/v1/dresses`
- [x] List search / filter / sort / pagination
- [x] Permissions `inventory.*` + Admin role for barcode change
- [x] AuditService integration (incl. barcode events)
- [x] DressPhoto gallery links to Media `StoredFile` (no Inventory bytes)
- [x] Cover / reorder / soft-delete reference APIs
- [x] DressStatusService — sole status writer; Phase 4 transition graph
- [x] `POST /dresses/{id}/status`; CRUD locked against direct status mutation
- [x] Phase 5 search API — filters, sorts, page meta; search indexes migration
- [x] Tests (≥95% Inventory coverage)
- [x] Alembic through `20260727_0018_dress_search`
- [x] Docs [`docs/DRESS_ASSET_MODULE.md`](docs/DRESS_ASSET_MODULE.md)
- [ ] Availability / calendar hooks (future domain modules)

### Customers

- [x] Customer model (full_name, phone required; address, national_id, notes optional)
- [x] Immutable auto `customer_number` (`CUS-00000001`) via settings
- [x] Optional alternative_phone, gender, birth_date
- [x] Duplicate phones allowed; soft delete only
- [x] CRUD + activate / deactivate APIs
- [x] Search by number / name / phone / national ID + sort + pagination
- [x] Lookup `GET /customers/number/{customer_number}`
- [x] Permissions `customer.view|create|update|delete` enforced
- [x] AuditService integration on mutations
- [x] Tests (≥95% Customers coverage)
- [x] Alembic `20260726_0013_customers`, `20260726_0016_customers_v2`
- [x] Docs [`docs/CUSTOMER_MODULE.md`](docs/CUSTOMER_MODULE.md)

### Reservations

- [x] Draft / Confirm / Cancel / Expire lifecycle
- [x] Calendar + Status Engine integration
- [x] Numbered `RSV-########` reservations
- [x] Agreed daily rental price snapshot per item
- [x] Permissions `reservation.view|create|update|cancel`
- [x] Tests (≥95% Reservations coverage)
- [x] Alembic `20260727_0020_reservations`
- [x] Docs [`docs/RESERVATIONS.md`](docs/RESERVATIONS.md)
- [x] Convert to rental via Rentals (`POST /rentals` + `mark_converted_to_rental`)

### Rentals

- [x] Walk-in + from Confirmed reservation handover
- [x] Estimated total + FIXED_AMOUNT/PERCENTAGE initial payment (remaining derived)
- [x] Calendar `RENTAL` + Status `RENTED`
- [x] Numbered `RENT-########` rentals
- [x] Permissions `rental.view|create|update|cancel`
- [x] Cancel stub (always ValidationError until Returns)
- [x] Tests (≥95% Rentals coverage)
- [x] Alembic `20260727_0021_rentals`, `20260728_0022_rentals_align`
- [x] Docs [`docs/RENTALS.md`](docs/RENTALS.md)

### Returns

- [x] Full return of ACTIVE rental → `PENDING_INSPECTION`
- [x] Status Engine `RENTED → INSPECTION`
- [x] Rental `ACTIVE → RETURN_PENDING`
- [x] Calendar blocks untouched
- [x] Numbered `RET-########` returns
- [x] Permissions `return.view|create`
- [x] Tests (≥95% Returns coverage)
- [x] Alembic `20260728_0023_returns`
- [x] Docs [`docs/RETURNS.md`](docs/RETURNS.md)

### Inspection

- [x] PENDING scaffold from return → COMPLETED condition assessment
- [x] Conditions GOOD / MINOR_DAMAGE / MAJOR_DAMAGE
- [x] Status Engine `INSPECTION → AVAILABLE|PROCESSING|RUINED_PENDING_SALE`
- [x] Return `PENDING_INSPECTION → INSPECTION_COMPLETED`
- [x] Repair penalties recorded (not collected)
- [x] Numbered `INS-########` inspections
- [x] Permissions `inspection.view|create|update`
- [x] Tests (≥95% Inspection coverage)
- [x] Alembic `20260728_0024_inspection`
- [x] Docs [`docs/INSPECTION.md`](docs/INSPECTION.md)

### Laundry / Processing

- [x] PENDING batch from laundry-bound inspection items → start → complete
- [x] Mandatory / optional processing days (Settings)
- [x] Calendar `PROCESSING` blocks; related RENTAL truncate on start
- [x] Status Engine `PROCESSING → AVAILABLE`
- [x] Numbered `PRC-########` batches
- [x] Permissions `processing.view|create|update|complete`
- [x] Tests (≥95% Processing coverage)
- [x] Alembic `20260728_0025_processing`
- [x] Docs [`docs/PROCESSING.md`](docs/PROCESSING.md)

### Sales

- [x] Normal sale of AVAILABLE dresses (NORMAL_SALE)
- [x] Mandatory damage purchase from Inspection (MANDATORY_DAMAGE_PURCHASE)
- [x] Atomic create with full payment (no partial / void v1)
- [x] Price snapshot + optional override via Settings
- [x] Future reservation calendar guard
- [x] Status Engine exit to SOLD
- [x] Numbered SAL-######## sales
- [x] Permissions sale.view|create
- [x] Tests (>=95% Sales coverage)
- [x] Alembic 20260728_0027_sales
- [x] Docs [docs/SALES.md](docs/SALES.md)


### Payments / Rental Settlement

- [x] Post-return settlement (`STL-########`) after inspection
- [x] Late penalty + minor-damage lines; initial payment as credit
- [x] Payments + Admin adjustments; concurrency lock
- [x] Permissions `rental.settlement.view|create|collect|adjust`
- [x] Tests (≥95% Settlements coverage)
- [x] Alembic `20260728_0026_settlements`
- [x] Docs [`docs/RENTAL_FINANCIAL_SETTLEMENT.md`](docs/RENTAL_FINANCIAL_SETTLEMENT.md)
- [ ] General POS / `payment.*` (future)

### Calendar

- [x] Dress timeline / availability engine
- [x] Conflict detection (abutting allowed)
- [x] Calendar APIs (`calendar.view` / `calendar.manage`)

### Reports

- [x] Dashboard + inventory/rentals/reservations/customers/inspection/processing summaries
- [x] Sales + named financial metrics (`reports.financial.view`)
- [x] Tests (>=95% Reports coverage)
- [x] Alembic 20260729_0028_reports
- [x] Docs [docs/REPORTS.md](docs/REPORTS.md)


### System Administration

- [x] System info + diagnostics (admin-only)
- [x] Maintenance framework + execute/history (Phase 4)
- [x] Permissions system.view|maintenance|backup|restore
- [x] Tests (>=95% system_admin coverage)
- [x] Alembic 20260729_0029_system_admin
- [x] Alembic 20260730_0030_system_backups
- [x] Alembic 20260731_0031_system_restores
- [x] Alembic 20260801_0032_system_maintenance_runs (maintenance history)
- [x] System Admin Phase 4 — metrics + maintenance execute/history
- [x] Alembic 20260802_0033_system_backups_duration
- [x] System Admin Phase 5 — audit & security integration
- [x] docs/BACKUP_ENGINE.md
- [x] docs/RESTORE_ENGINE.md
- [x] Docs [docs/SYSTEM_ADMINISTRATION.md](docs/SYSTEM_ADMINISTRATION.md)
- [x] Backup Engine Phase 2 (.juman packages, history, download)
- [x] Restore Engine Phase 3 (validate, safety backup, apply, rollback)

### Notifications

- [ ] Not Started

### Frontend (Electron)

- [x] Foundation — Electron Main/Preload/Renderer separation
- [x] Secure contextIsolation + IPC whitelist
- [x] Main-owned Axios + JWT session (`safeStorage` refresh)
- [x] Arabic RTL providers, theme, error boundary
- [x] ProtectedRoute + PermissionGate (UI only)
- [x] Vitest foundation tests
- [x] Docs `docs/frontend/`
- [ ] Login screen
- [ ] Business modules (Inventory, Customers, …)

---

## Architecture

**Authoritative backend:** [`backend-node/`](backend-node/) — NestJS + Prisma + SQLite (V2).  
Python FastAPI (`backend-python/`) has been **removed** from the repository (2026-08-04).

```text
backend-node/
├── prisma/                  # Schema + migrations
├── src/
│   ├── auth/                # JWT sessions, login history
│   ├── customers/
│   ├── inventory/           # Items, taxonomy, lifecycle
│   ├── rentals/ · reservations/
│   ├── finance/             # Ledger + settlements
│   ├── media/ · barcode/ · reports/
│   ├── database/            # PrismaService
│   └── main.ts
├── docs/ (see docs/backend-v2/)
└── package.json
```

Living status docs: [`PROJECT_STATUS.md`](PROJECT_STATUS.md) · [`CHANGELOG.md`](CHANGELOG.md) · [`docs/backend-v2/`](docs/backend-v2/)

### Top-level folders

| Path | Purpose |
|---|---|
| `backend-node/` | NestJS V2 API (Prisma + SQLite) — **source of truth** |
| `frontend-legacy/` | Electron + React product UI (Phase 2 parity) |
| `frontend/` | Phase 1 shell rebuild (optional / future) |
| `docs/backend-v2/` | Nest architecture, domains, roadmap |
| `docs/frontend/` | Frontend maps, gap analysis, progress |
| `deployment/` | Installer / packaging (Python staging scripts retired) |
| `start-dev.bat` | Local Nest + Electron launcher |

### Dependency flow (Nest)

1. Controllers → services → repositories → Prisma  
2. Domain modules own invariants; finance/settlement formulas stay in Nest  
3. Electron Main owns HTTP to Nest (`JUMAN_API_BASE_URL`); renderer uses `apiClient` / `services/v2`

---

## Technology Stack

### Frontend

- Electron + React + TypeScript (Arabic RTL)

### Backend

- NestJS (TypeScript)
- Prisma ORM
- SQLite (desktop single-writer; WAL)

### Database

- SQLite → `data/juman.db` under `JUMAN_DATA_DIR`

### Authentication / Authorization

- JWT access + refresh (Electron Main owns tokens)
- Argon2 password hashing
- Seeded RBAC permissions on Nest
- Default bind: `http://127.0.0.1:8787` (no `/api/v1` prefix)

### Testing

- Vitest (backend-node + frontend)

### Tooling

- pnpm
- Prisma CLI (`migrate deploy` / `generate`)
- `start-dev.bat` for local Nest + Electron

---

## Coding Standards

From the Project Constitution:

- Never generate demo, fake, or placeholder APIs
- Never simplify architecture for convenience
- Never break existing modules; extend instead
- Never rename APIs unless explicitly requested
- Never refactor unless requested
- Arabic RTL UI first; English for code/DB/APIs
- Every business entity: UUID, `created_at`, `updated_at`, `created_by`, `updated_by`, soft delete
- SOLID, Clean Architecture, Repository Pattern, Service Layer, DI
- Async everywhere; type hints and docstrings required
- Implement **only** the requested module

---

## Development Progress

Calculated from 18 backend building blocks (Foundation + 17 domain modules including Audit).  
**Completed:** Foundation, Settings, RBAC, Users, Media, Audit, Categories, Customers, Inventory Phase 1–5, Calendar, Reservations, Rentals, Returns, Inspection, Processing, Rental Settlement, Sales, Reports → **18 / 18 ≈ 100% domain modules (Notifications remaining)**

```text
Backend Foundation     ██████████ 100%
Settings               ██████████ 100%
RBAC                   ██████████ 100%
Users                  ██████████ 100%
Media                  ██████████ 100%
Audit                  ██████████ 100%
Categories             ██████████ 100%
Customers              ██████████ 100%
Inventory              █████████░  90%   (Phase 1–5 through Search)
Calendar               ██████████ 100%
Reservations           ██████████ 100%
Rentals                ██████████ 100%
Returns                ██████████ 100%
Inspection             ██████████ 100%
Processing             ██████████ 100%
Sales                  ██████████ 100%
Payments / Settlement  ██████████ 100%   (rental settlement v1; POS later)
Reports                ██████████ 100%
Notifications          ░░░░░░░░░░   0%

Overall Backend        ██████████ ~98%
```

Frontend (Electron): **~15%** (foundation complete; no business UI yet)

---

## Upcoming Milestone

### Notifications / general POS (recommended next)

**Why next**

1. Sales and Settlement complete commercial money exits for rentals and forced purchases  
2. Notifications unlock operational alerts  
3. General POS (`payment.*`) remains for future non-rental checkout  

**Expected outcomes**

- Basic sales/rental reporting surfaces  
- Clear separation between domain payments and future general POS  

---

## Backend Quick Start

```powershell
cd backend-node
$env:JUMAN_DATA_DIR = "C:\Users\moham\Desktop\juman"   # repo root
$env:DATABASE_URL = "file:C:/Users/moham/Desktop/juman/data/juman.db"
pnpm prisma:generate
pnpm start:dev
```

Or double-click [`start-dev.bat`](start-dev.bat) (Nest + Electron).

- Health: `http://127.0.0.1:8787/health`
- Docs: [`docs/backend-v2/Architecture.md`](docs/backend-v2/Architecture.md) · [`backend-node/README.md`](backend-node/README.md)

### Frontend (dev)

```powershell
cd frontend-legacy
$env:JUMAN_API_BASE_URL = "http://127.0.0.1:8787"
pnpm dev
```

Docs: [`docs/frontend/`](docs/frontend/)

---

## Foundation Verification (2026-07-26)

Version 0.1 integration audit of Settings + RBAC + Identity + Media. See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) and [`CHANGELOG.md`](CHANGELOG.md).

| Verdict | Detail |
|---|---|
| **JUMAN BACKEND v1.0 PRODUCTION READY** | Phase 6 GO (2026-07-29). See [`docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md`](docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md). Next product: **Notifications**, general POS, or Electron. |
| Critical foundation redesign | None after Alembic asyncpg seed bind fix |
| Production deploy note | Set strong `SECRET_KEY`; do not use example credentials |

Interactive report: [`juman-foundation-verification.canvas.tsx`](C:/Users/moham/.cursor/projects/c-Users-moham-Desktop-juman/canvases/juman-foundation-verification.canvas.tsx)

---

## Changelog

### 2026-07-29

- Frontend Foundation started — Electron + React + TypeScript monorepo package `@juman/frontend`; IPC proxy auth; Arabic RTL shell; docs `docs/frontend/`.
- Backend Phase 6 certified — **Juman Backend v1.0 Production Ready**; Layer1 573 passed / 95% cov; Layer2 Postgres cert green; report `docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md`.
- Version bump to **1.0.0**; Phase 6 validation orchestrator + `tests/postgres_cert`.

### 2026-07-28

- Sales module completed — normal + mandatory damage purchase; atomic full payment; SAL-########; docs SALES.md; coverage >=95%.
- Reports module completed — read-only dashboard and financial reports; docs REPORTS.md; coverage >=95%.
- System Administration Phase 1 completed — info/diagnostics/maintenance framework; docs SYSTEM_ADMINISTRATION.md.
- Full backend integration audit executed — 385/385 tests passed; PostgreSQL migration chain verified on `juman_audit`; decision **READY TO CONTINUE WITH DOCUMENTED RISKS**; report `docs/FULL_BACKEND_INTEGRATION_AUDIT.md`.
- Corrected outdated `backend/docs/setup.md` Alembic head + Identity notes.
- Rental Financial Settlement completed — post-return fils settlement; late/damage; payments; docs `RENTAL_FINANCIAL_SETTLEMENT.md`.
- Processing module completed — laundry batches; Calendar PROCESSING; Status → AVAILABLE; docs `PROCESSING.md`.
- Inspection module completed — condition assessment; Status AVAILABLE/PROCESSING/RUINED_PENDING_SALE; docs `INSPECTION.md`.
- Returns module completed — full receipt → PENDING_INSPECTION; Status + rental handoff; docs `RETURNS.md`.

### 2026-07-27

- Rentals module completed — walk-in / reservation handover; estimated total + initial payment; cancel stub; docs `RENTALS.md`.
- Reservations module completed — Draft/Confirm/Cancel/Expire; Calendar + Status Engine; docs `RESERVATIONS.md`.
- Calendar Engine completed — dress timelines, conflicts, availability; docs `CALENDAR_ENGINE.md`.
- Inventory Phase 5 (Search & Filtering) completed — page meta, rich filters/sorts, `20260727_0018_dress_search`.

### 2026-07-26

- Inventory Phase 4 (Status Engine) completed — `DressStatusService`, `POST /dresses/{id}/status`, CRUD status lock.
- Inventory Phase 3 (Photo Management) completed — `DressPhoto` → Media `StoredFile`, gallery/cover/reorder, `20260726_0017_dress_photos`.
- Customers v2 completed — immutable `CUS-########`, alt phone/gender/birth date, sort/search, docs `CUSTOMER_MODULE.md`.
- Inventory Phase 2 (Barcode Engine) completed — auto-generate, Admin change, lifetime uniqueness, `BarcodeService`.
- Inventory Phase 1 (Dress asset core) completed — `/api/v1/dresses`, Category delete guard, IQD prices, docs `DRESS_ASSET_MODULE.md`.
- Customers module completed (CRUD, activate/deactivate, search, audit, `customer.*` permissions).
- Categories module completed (CRUD, activate/deactivate, audit, permissions).
- Audit module completed; Identity Phases 1–7 application auth live.
- Foundation Version 0.1 integration verified (Settings, RBAC, Identity, Media).
- Media module completed; Alembic asyncpg seed bind fix for fresh upgrades.
- Docs refreshed for Nest V2 (`docs/backend-v2/*`, `PROJECT_STATUS.md`, `CHANGELOG.md`, root `README.md`).
- Backend Foundation, Settings, and RBAC modules completed earlier.
- Production config validation; Alembic-only settings seeds; RBAC permission helpers consolidated.

---

## License / Ownership

Private project — Juman (جمان) POS & Rental Management System.

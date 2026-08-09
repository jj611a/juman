# جمان (Juman)

Professional Dress Rental & Sales Management System

---

## Overview

**Juman (جمان)** is an enterprise Desktop POS and rental management system built for dress stores that both **sell** and **rent** dresses.

- **Client:** Windows Desktop via **Electron** + React + TypeScript
- **UI language:** Arabic (RTL) first — English is reserved for source code, APIs, and database naming
- **Backend:** NestJS (TypeScript) + Prisma ORM + SQLite
- **Currency:** Iraqi Dinar (د.ع)
- **Architecture:** Clean Architecture + Domain-Driven Design, modular and production-oriented

The system is developed **incrementally**. Each backend module plugs into the foundation without rewriting existing code.

---

## Current Stack (2026-08)

| Layer | Technology |
|-------|------------|
| **Desktop Client** | Electron 28+ + React 18 + TypeScript 5 |
| **Backend API** | NestJS 10 + Prisma 5 + SQLite (WAL mode) |
| **Auth** | JWT (access + refresh) + Argon2 password hashing |
| **Database** | SQLite → `data/juman.db` under `JUMAN_DATA_DIR` |
| **Testing** | Vitest (unit + integration) |
| **Package Manager** | pnpm |

---

## Features

### Backend (NestJS V2) — ✅ Production Ready

| Module | Status | Description |
|--------|--------|-------------|
| **Auth / Identity** | ✅ | JWT sessions, login history, account lockout, password policy |
| **RBAC** | ✅ | Permissions, roles, role–permission links, system roles (Admin, Cashier, Inventory, Laundry) |
| **Users** | ✅ | Admin CRUD (create, edit, activate/deactivate, unlock, reset password, soft-delete/restore) |
| **Permissions** | ✅ | Catalog API, seeded permissions, role-based access |
| **Customers** | ✅ | CRUD, search, `CUS-########` numbering, audit |
| **Inventory / Dresses** | ✅ | Assets, barcode (`DR-#######`), photos, status engine, lifecycle transitions, search/filter |
| **Categories / Brands / Colors / Sizes** | ✅ | Taxonomy management with permissions |
| **Reservations** | ✅ | Draft/Confirmed/Cancelled/Expired, calendar integration, `RSV-########` |
| **Rentals** | ✅ | Walk-in & reservation handover, `RENT-########`, checkout/return/complete/cancel |
| **Returns** | ✅ | Full receipt → inspection handoff, `RET-########` |
| **Inspection** | ✅ | Condition assessment → AVAILABLE / PROCESSING / RUINED_PENDING_SALE |
| **Processing (Laundry)** | ✅ | Batches, mandatory/optional days, `PRC-########` |
| **Rental Settlement** | ✅ | Post-return fils settlement, late/damage, payments, adjustments |
| **Sales** | ✅ | Normal + mandatory damage purchase, atomic full payment, `SAL-########` |
| **Finance / Ledger** | ✅ | Accounts, transactions, payments, outstanding |
| **Settlements** | ✅ | Rental settlement management (payment, refund, discount, late-fee, close/cancel) |
| **Reports** | ✅ | Dashboard, financial, inventory, rental, customer-scoped, export (CSV/JSON) |
| **Media** | ✅ | StoredFile/FileReference, local provider, upload/download/integrity |
| **Barcodes** | ✅ | Registry, generate, reserve, release, retire |
| **System Admin** | ✅ | Info, diagnostics, maintenance, backups, restore |
| **Employees** | ✅ | **New** — User management portal (list, create, edit, activate/deactivate, unlock, reset password, soft-delete/restore, view role permissions) |

### Frontend (Electron + React) — Phase 9.11

| Area | Status |
|------|--------|
| Foundation (Electron Main/Preload/Renderer, IPC, JWT session) | ✅ |
| Arabic RTL shell, theme, error boundary | ✅ |
| Protected routes + PermissionGate | ✅ |
| TopBar with portal dropdown (view switcher) | ✅ |
| Navigation with permission-gated items | ✅ |
| **Employees page** | ✅ |
| Customers page | ✅ |
| Inventory page | ✅ |
| Categories / Brands / Colors / Sizes | ✅ |
| Reservations / Rentals / Returns | ✅ |
| Sales / POS | ✅ |
| Finance / Settlements | ✅ |
| Reports | ✅ |
| System Admin | ✅ |
| Unit tests (Vitest) | ✅ 66 tests passing |

---

## Project Structure

```text
juman/
├── backend-node/              # NestJS V2 API (Prisma + SQLite) — source of truth
│   ├── prisma/                # Schema + migrations
│   ├── src/
│   │   ├── auth/              # JWT sessions, login history, lockout
│   │   ├── users/             # User admin + RBAC
│   │   ├── roles/             # Roles + permissions
│   │   ├── permissions/       # Permission catalog
│   │   ├── customers/
│   │   ├── inventory/         # Items, taxonomy, lifecycle, barcode
│   │   ├── rentals/ · reservations/ · returns/ · inspection/ · processing/
│   │   ├── finance/           # Ledger + settlements
│   │   ├── sales/             # Sales + POS
│   │   ├── media/ · barcode/ · reports/ · categories/
│   │   ├── database/          # PrismaService
│   │   └── main.ts
│   └── package.json
├── frontend/                  # Phase 9 Electron + React (new shell)
│   ├── electron/              # Main + Preload (IPC, session, hardware)
│   ├── src/
│   │   ├── features/          # Feature modules (employees, customers, inventory, etc.)
│   │   ├── layouts/shell/     # AppShell, TopBar, Sidebar, ShellBreadcrumbs
│   │   ├── router/            # AppRouter + RouteGuard
│   │   ├── navigation/        # nav.config.ts + nav items
│   │   ├── shared/            # constants, hooks, utils, components
│   │   └── main.tsx
│   └── package.json
├── docs/
│   ├── backend-v2/            # Nest architecture, domains, roadmap
│   └── frontend/              # Frontend maps, gap analysis, progress
├── deployment/                # Installer / packaging (NSIS)
├── config/                    # Runtime config (juman.env)
├── data/                      # SQLite database (juman.db)
├── logs/                      # Runtime logs
├── start-dev.bat              # Local Nest + Electron launcher
├── package.json               # Root workspace (pnpm)
├── pnpm-workspace.yaml
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+

### Backend (NestJS)

```powershell
cd backend-node
$env:JUMAN_DATA_DIR = "C:\path\to\juman"   # repo root
$env:DATABASE_URL = "file:C:/path/to/juman/data/juman.db"
pnpm install
pnpm prisma:generate
pnpm start:dev
```

- Health: `http://127.0.0.1:8787/health`
- API base: `http://127.0.0.1:8787` (no `/api/v1` prefix)

### Frontend (Electron)

```powershell
cd frontend
$env:JUMAN_API_BASE_URL = "http://127.0.0.1:8787"
pnpm install
pnpm dev
```

### Combined (Dev)

Double-click `start-dev.bat` to launch both NestJS and Electron.

---

## Key Backend Endpoints

| Module | Base Path | Key Permissions |
|--------|-----------|-----------------|
| Auth | `/auth` | `@Public()` for login; JWT for others |
| Users | `/users` | `users.view`, `users.create`, `users.update`, `users.delete`, `users.unlock` |
| Roles | `/roles` | `roles.view` |
| Permissions | `/permissions` | `permissions.view` |
| Customers | `/customers` | `customer.*` |
| Inventory | `/items` | `inventory.*`, `categories.*` |
| Reservations | `/reservations` | `reservations.*` |
| Rentals | `/rentals` | `rentals.*` |
| Returns | `/returns` | `return.*` |
| Inspection | `/inspections` | `inspection.*` |
| Processing | `/processing` | `processing.*` |
| Settlements | `/settlements` | `finance.settlement.*` |
| Sales | `/sales` | `sales.*` |
| Finance | `/finance` | `finance.*` |
| Reports | `/reports` | `reports.*`, `reports.financial.view` |
| Media | `/media` | `media.*` |
| Barcodes | `/barcodes` | `barcode.*` |
| System | `/system` | `system.*` |

---

## Development

### Commands

```bash
# Backend
cd backend-node
pnpm start:dev        # Dev server with hot reload
pnpm build            # Production build
pnpm test             # Vitest unit + integration
pnpm lint             # ESLint
pnpm prisma:generate  # Generate Prisma Client
pnpm prisma:migrate   # Run migrations

# Frontend
cd frontend
pnpm dev              # Vite dev server (renderer)
pnpm build            # Electron production build
pnpm test             # Vitest unit tests
pnpm lint             # tsc --noEmit + ESLint
pnpm validate:arch    # Architecture validation script
```

### Architecture Validation

The frontend has a validation script that enforces:
- No `legacyBridge` imports
- No `@/core/` imports
- Feature folders exist for required domains
- Clean dependency boundaries

```bash
cd frontend && pnpm validate:arch
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| `docs/backend-v2/Architecture.md` | NestJS architecture overview |
| `docs/backend-v2/DomainModules.md` | Domain module patterns |
| `docs/frontend/BACKEND_FEATURE_MAP.md` | Backend endpoint ↔ Frontend feature map |
| `docs/frontend/FRONTEND_FEATURE_COMPLETION_REPORT.md` | Completion status & gaps |
| `docs/frontend/FRONTEND_GAP_ANALYSIS.md` | Missing features analysis |
| `docs/frontend/PHASE_9_FRONTEND_REBUILD.md` | Phase 9 rebuild plan |
| `PROJECT_STATUS.md` | Current project status |
| `CHANGELOG.md` | Full changelog |
| `JUMAN_CHANGELOG.md` | Product-track changelog |

---

## License / Ownership

Private project — Juman (جمان) POS & Rental Management System.
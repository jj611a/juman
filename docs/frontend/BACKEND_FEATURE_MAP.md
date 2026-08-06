# Backend V2 Feature Map

**Generated:** 2026-08-03 (Frontend rebuild Phase 1)  
**Phase 9 note:** Frontend rebuild adapts to this map only — **do not add Nest routes from FE work.**  
**Refined with:** full controller scan  
**Source of truth:** `backend-node/` · **No global `/api` prefix** · Paths from host root  
**Contract:** Frontend consumes camelCase Nest DTOs only.

---

## Global auth / money

| Concern | Behavior |
|--------|----------|
| JWT | All non-`@Public()` routes |
| Permissions | `@RequirePermissions` when present; else any authenticated user |
| Password gate | If `mustChangePassword`, only change-password / logout / me / session |
| Money | Integer **fils** (IQD × 1000) |

---

## HTTP modules (16 controllers · ≈112 routes)

### Health — `GET /health` (`@Public`)

`{ status, version, database, uptime, environment }`

### Auth — `/auth`

| Method | Path | Auth |
|--------|------|------|
| POST | `/login` | Public |
| POST | `/logout`, `/change-password` | JWT |
| POST | `/admin/unlock` | `users.unlock` |
| GET | `/session` | Public (Bearer / refresh) |
| GET | `/me` | JWT |

Login returns `accessToken`, `refreshToken`, `user{id,username,fullName,roleId,roleName,mustChangePassword,permissions,…}`.

### Customers — `/customers` · `customer.*`

List / search / by number / get / create / patch / soft-delete / restore.

### Media — `/media` · `media.view|upload|delete|restore`

List / get / integrity / multipart upload / delete / restore.  
**No binary download route.** Attach-to-entity is via **`POST /items/:id/media`**, not a media-reference controller.

### Barcodes — `/barcodes` · `barcode.*`

List / get / generate / validate / reserve / release / retire.  
**No HTTP activate** — bind on item create/update TX. Status: reserved → activated → reserved (release) → retired.

### Taxonomy

| Prefix | Permissions |
|--------|-------------|
| `/categories` | `categories.*` |
| `/brands`, `/colors`, `/sizes` | `inventory.*` |

Each: list / get / create / patch / delete / restore.  
List whitelist: `q`, `deleted`, `parentId?`, `offset`, `limit` (no sort/status).

### Items + lifecycle — `/items`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/`, `/search`, `/code/:internalCode`, `/:id` | `inventory.view` |
| POST | `/` | `inventory.create` |
| PATCH | `/:id` | `inventory.update` |
| DELETE | `/:id` | `inventory.delete` |
| POST | `/:id/restore` | `inventory.restore` |
| POST | `/:id/media` | `inventory.update` |
| GET | `/:id/state`, `/:id/history` | `inventory.view` |
| POST | `/:id/transition` | `inventory.transition` |

Create: `barcode` **or** `generateBarcode`. Transition body uses **lowercase** `ITEM_LIFECYCLE` values (`available`, `rented`, `inspection`, …). Soft-delete blocked in outbound lifecycle states.

### Reservations — `/reservations` · `reservations.*`

List / get / create / `/:id/checkout` / cancel / expire.  
**No PATCH.** Create confirms under availability lock. Checkout → rental via RentalsService.

### Rentals — `/rentals` · `rentals.*`

List / get / create / `/:id/checkout` / return / complete / cancel.  
Checkout opens settlement + deposit (idempotent). Status: draft → checked_out/active → return_pending → completed | cancelled.

### Finance — `/finance` · `finance.view|payment`

Accounts / transactions / payments GET / payments POST / outstanding.

### Settlements — `/settlements` · `finance.settlement.*` (+ `finance.adjustment`)

List / get / payment / refund / adjustment / discount / late-fee / close / cancel.  
**No create** — spawned on rental checkout.

### Reports — `/reports`

Dashboard, financial, rentals (current/overdue/returns/reservations/history), inventory (value/availability/category/brand/color/size/lifecycle/retired/maintenance), customer-scoped (rentals/outstanding/payments/reservations), export (csv/json; pdf/excel stubs).

---

## Service-only (no HTTP)

| Module | Role |
|--------|------|
| `AvailabilityModule` | Sole overlap allocator (`runExclusive`) |
| `AuditModule` | Append-only write; **no list HTTP** |
| `SettingsModule` | Boot defaults; **no settings HTTP** |
| `UsersModule` / `RolesModule` / `PermissionsModule` | Seed + auth internals; **no CRUD HTTP** |

---

## Seeded permissions without Nest HTTP

`users.*` (except unlock), `roles.*`, `permissions.*`, `settings.*`, `audit.view`, `calendar.*`, `return.*`, `inspection.*`, `processing.*`, `sale.*`, `system.*`, singular `reservation.*` / `rental.*` aliases, …

---

## Target FE navigation (HTTP-backed only)

`/login` · `/` · `/customers` · `/inventory` · `/categories` · `/brands` · `/colors` · `/sizes` · `/media` · `/barcodes` · `/reservations` · `/rentals` · `/settlements` · `/finance` · `/reports` · `/hardware` · `/diagnostics`  

**Blocked until Nest HTTP:** users, roles, settings editor, audit browser, calendar, backups.

---

## Explicit non-goals for V2 FE

- Invent calendar / audit / settings / users HTTP  
- Reintroduce snake_case envelopes as the long-term contract  
- Duplicate settlement formulas or availability rules in the renderer

### Phase 2 note (2026-08-03)

`frontend-legacy` now exercises Nest-backed modules for primary ops. Coverage: `FRONTEND_FEATURE_COMPLETION_REPORT.md`. Nest-less domains remain FE non-goals.

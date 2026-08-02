# Backend V2 Architecture

**Status:** Phase 3.4 Engineering Certification  
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
  media/          MediaFile abstraction (no upload HTTP)
  barcode/        generate/validate/reserve
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
- Business modules (customers, inventory, rentals, sales, reports)
- Hardware bridges
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

# Backend V2 Architecture

**Status:** Phase 2.2 Authentication Implementation  
**Branch:** `backend-v2`  
**Spec source:** `backend-python/` (read-only Python FastAPI stack)

## Target runtime

```
Electron (desktop) — Main process owns tokens
    ↓ Bearer access JWT
NestJS (backend-node)
    ↓
Prisma ORM
    ↓
SQLite → data/juman.db
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

## Configuration

Loaded from `config/juman.env`. Missing files are generated with safe defaults (including a random `JWT_SECRET`). Production requires an explicit `JWT_SECRET` (≥32 chars).

## Logging

Winston console + daily rotating JSON under `logs/` (application / errors / startup / requests).

## API surface (Phase 2.2)

- `GET /health` — public
- `POST /auth/login` / `POST /auth/logout` / `POST /auth/change-password`
- `GET /auth/session` / `GET /auth/me`

See `AuthenticationDesign.md` and `SecurityDesign.md`.

## Layers

```
src/
  main.ts, app.module.ts
  config/, core/, database/, health/, logging/, exceptions/, validation/, storage/, shared/
  security/       Argon2, JWT, opaque tokens, password policy
  auth/           guards, strategies, session/refresh, login/logout/refresh/me
  users/          repository + service (no CRUD HTTP yet)
  roles/          system roles + permission resolution
  permissions/    catalog seed + repository
```

## Auth / RBAC

- Argon2id passwords; opaque refresh tokens (hashed); HS256 access JWT bound to session (`sid`)
- Permissions resolved from DB per request (not embedded in JWT)
- System roles Admin / Cashier / Inventory / Laundry seeded on startup
- Full permission catalog preserved from Python V1

## What is not in V2 (yet)

- Users/roles admin HTTP APIs, change-password HTTP
- Business modules (customers, inventory, rentals, sales, reports)
- Hardware bridges
- Electron process management / installer Nest packaging

## Python V1

`backend-python/` remains the official behavioral specification until full parity. Do not modify its application code on this track.

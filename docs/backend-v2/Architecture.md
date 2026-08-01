# Backend V2 Architecture

**Status:** Foundation (Phase 1.1)  
**Branch:** `backend-v2`  
**Spec source:** `backend-python/` (read-only Python FastAPI stack)

## Target runtime

```
Electron (desktop)
    ↓
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

Canonical env:

- `JUMAN_DATA_DIR` — root for `data/`, `logs/`, `storage/`, `config/`
- `DATABASE_URL` — Prisma SQLite URL (`file:…/data/juman.db`)
- `PORT` — HTTP listen port (dev default **8787**)
- `APP_VERSION` — reported by `/health` (default `2.0.0`)
- `APP_ENV` — `development` | `production` | `test`

## Configuration file

Runtime config is loaded from `config/juman.env` under `JUMAN_DATA_DIR`. Missing files are generated with safe defaults on first startup.

## Logging

Centralized Winston logger writes console + daily rotating JSON files under `logs/` for channels: application, errors, startup, requests.

## API (Phase 1)

Only:

`GET /health`

```json
{
  "status": "ok",
  "version": "2.0.0",
  "database": "connected",
  "uptime": 12.34,
  "environment": "development"
}
```

No `/api/v1` prefix in Phase 1. Electron still targets Python V1 until Phase 8.

## Layers (Clean Architecture)

```
src/
  main.ts                 bootstrap + graceful shutdown
  app.module.ts
  config/                 juman.env + validated configuration
  core/                   constants
  database/               PrismaService
  health/                 health module (presentation)
  logging/                Winston logger
  exceptions/             global filter + process handlers
  validation/             ValidationPipe factory
  storage/                ensure runtime dirs
  shared/                 shared types
```

Domain modules are added from Phase 2 onward. Persistence goes through Prisma only.

## What is not in V2 (yet)

- Authentication / JWT
- Business modules
- Hardware bridges
- Electron process management
- Installer NSIS changes for Nest packaging

## Python V1

`backend-python/` remains in the repository as the **official behavioral specification** until full parity. Do not modify its application code on this track.

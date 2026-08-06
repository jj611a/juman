# Backend V2 Folder Structure

## Repository (target)

```
juman/
  backend-node/       # NestJS + Prisma + SQLite (V2) — only backend
  frontend-legacy/    # Electron product UI
  frontend/           # Phase 1 shell (optional rebuild)
  docs/backend-v2/
  docs/frontend/
  deployment/
  start-dev.bat
```

> `backend-python/` was removed 2026-08-04.

## `backend-node/` (Phase 2.1)

```
backend-node/
  prisma/
    schema.prisma
    migrations/
  src/
    main.ts
    app.module.ts
    config/
    core/                 # app + auth constants
    database/
    health/
    logging/
    exceptions/
    validation/
    storage/
    shared/
    security/             # Argon2, JWT, opaque tokens, password policy
    auth/                 # module, controller, guards, strategies, services, dto
    users/
    roles/
    permissions/
    settings/
    audit/
    media/
    barcode/            # Phase 3.5 platform (+ hardware ports design-only)
    customers/          # Phase 3.2
    media/              # Phase 3.3 (providers, validation, HTTP)
    inventory/          # Phase 4.1 catalog (items + taxonomy)
  test/
  package.json
```

## Runtime data (not committed)

```
<data-root>/
  data/juman.db
  logs/{application,errors,startup,requests}-YYYY-MM-DD.log
  storage/
  config/juman.env
```

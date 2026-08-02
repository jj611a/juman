# Backend V2 Folder Structure

## Repository (target)

```
juman/
  backend-python/     # READ ONLY — Python V1 specification
  backend-node/       # NestJS + Prisma + SQLite (V2)
  frontend/
  docs/backend-v2/
  installer/
  deployment/
```

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
    barcode/
    customers/          # Phase 3.2
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

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

## `backend-node/` (Phase 1.1)

```
backend-node/
  prisma/schema.prisma
  src/
    main.ts
    app.module.ts
    config/           # paths, juman.env loader, configuration, validation
    core/             # constants
    database/         # Prisma module/service
    health/           # GET /health only
    logging/          # Winston rotating JSON logger
    exceptions/       # global filter + process handlers
    validation/       # global ValidationPipe factory
    storage/          # ensure runtime directories
    shared/           # shared types
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

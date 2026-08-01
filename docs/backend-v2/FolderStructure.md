# Backend V2 Folder Structure

## Repository (target)

```
juman/
  backend-python/     # READ ONLY — Python V1 specification
  backend-node/       # NestJS + Prisma + SQLite (V2)
  frontend/           # Electron + React
  docs/
    backend-v2/       # This documentation set
  installer/
  deployment/         # Packaging for V1; V2 packaging evolves in Phase 8–10
  shared/             # Optional cross-cutting TS types (future)
```

## `backend-node/` (Phase 1)

```
backend-node/
  prisma/
    schema.prisma
  src/
    main.ts
    app.module.ts
    config/
      configuration.ts
      env.validation.ts
    bootstrap/
      ensure-dirs.ts
    database/
      prisma.service.ts
      prisma.module.ts
    health/
      health.controller.ts
      health.module.ts
      health.service.ts
    common/
      filters/http-exception.filter.ts
      logger/app-logger.service.ts
  test/
    health.e2e-spec.ts
  package.json
  tsconfig.json
  tsconfig.build.json
  nest-cli.json
  vitest.config.ts
  eslint.config.mjs
  .prettierrc
  .env.example
```

## Runtime data (not committed)

```
<data-root>/
  data/juman.db
  logs/
  storage/
  config/
```

`JUMAN_DATA_DIR` selects `<data-root>`. Defaults to process cwd / install root during desktop integration.

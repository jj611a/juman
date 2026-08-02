# Backend V2 Shared Business Foundation (Phase 3.1)

**Branch:** `backend-v2`  
**Scope:** Reusable infrastructure only — no customers, inventory, rentals, sales, or reports.

## Principles

1. Domain modules consume shared services; they do not reimplement money/pagination/audit/media/barcode.
2. Feature modules export **services only** (repositories stay private).
3. Soft-delete standard: nullable `deletedAt` (live rows = `null`).
4. Money is **integer fils** (1000 fils = 1 IQD). Never floats.
5. Audit writes go through `AuditService.record(...)` only.

## Packages

| Area | Path | Responsibility |
|------|------|----------------|
| Shared primitives | `src/shared/**` | Money, pagination, search, filter, sort, soft-delete, UUID, datetime, validation, phone, result, i18n, domain errors |
| Settings | `src/settings/**` | `AppSetting` typed get/set + seed defaults |
| Audit | `src/audit/**` | Central `AuditService` + append-only `AuditLog` |
| Media | `src/media/**` | `MediaFile` + `MediaReference` abstraction (no HTTP upload yet) |
| Barcode | `src/barcode/**` | Generate / validate / uniqueness / reserve / allocate / release |

## Prisma models (shared)

- `AppSetting`
- `MediaFile`, `MediaReference`
- `Barcode`, `SequenceCounter`
- `AuditLog` (append-only)

## Coverage

```bash
pnpm test:cov:shared
```

Gate: lines/statements/functions ≥ 95%, branches ≥ 85% on shared infrastructure.
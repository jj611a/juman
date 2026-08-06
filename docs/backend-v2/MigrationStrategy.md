# Backend V2 Migration Strategy

**Update (2026-08-04):** `backend-python/` has been **removed** from the repository. Nest `backend-node/` is the only backend source of truth.

Historical context (for docs / ADRs that still mention Python):

## Former flow per module

```
Python backend-python (removed)
        ↓
Analyze behavior (routes, invariants, edge cases, tests)
        ↓
Reimplement cleanly in Nest + Prisma + SQLite
        ↓
Verify behavior (automated + manual parity)
```

## Rules (current)

1. Do not revive FastAPI / SQLAlchemy / Alembic / uv packaging paths.
2. Do not invent Nest HTTP for domains that were never shipped on V2 without product approval.
3. SQLite schema is designed for desktop single-writer workloads.
4. Installer cutover (Phase 8.2+) must stage **Nest**, not Python `juman-api.exe`.

## Schema migrations (Nest)

1. Prefer `prisma migrate deploy` for all environments (including tests / CI).
2. Ban `prisma db push` for application startup and CI proof of schema.
3. `backend-node` runs migrate deploy **before** Nest boots; failure aborts with diagnostics.
4. Fresh install: dirs → `juman.env` → SQLite file → migrate deploy → verify status → Nest.

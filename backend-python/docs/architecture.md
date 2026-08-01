# Architecture

Juman's backend follows **Clean Architecture** boundaries with **Domain-Driven Design** modular packaging.

## Layers

```text
Presentation   → api/, middleware/, dependencies/
Application    → services/, schemas/
Domain shared  → common/, exceptions/, security contracts
Infrastructure → database/, repositories/, config/, redis readiness
Modules        → modules/<bounded_context>/
```

## Current modules

| Module | Responsibility |
|---|---|
| `settings` | Database-driven business/system configuration |
| `rbac` | Permissions, roles, role–permission links, fail-closed guards |
| `identity` | Users, login sessions, refresh tokens, password policy, principal resolution |
| `media` | Generic file storage metadata + opaque file references (no business entity knowledge) |

## Dependency rules

1. Routers never use SQLAlchemy sessions directly — only via dependencies/services.
2. Repositories never import FastAPI.
3. Models never import services or API layers.
4. Future modules may import foundation packages; foundation must **not** import modules (except composition roots: `api/v1/router.py`, Alembic `env.py`, and thin `dependencies/auth.py` re-exports).
5. Each business entity uses UUID, timestamps, audit fields, and soft delete via `AuditedSoftDeleteModel`.
6. Media never imports Inventory/Dress/Company domain logic; callers supply opaque `module_name` / `entity_type` / `purpose`.

## Request flow

```text
Client
  → Middleware (request id, timing, CORS)
  → API Router
  → Dependencies (db / auth / services)
  → Service
  → Repository
  → PostgreSQL
```

## Future module integration

Example layout:

```text
app/modules/<name>/
  models/
  schemas/
  repositories/
  services/
  api/
```

Integration steps:

1. Inherit `AuditedSoftDeleteModel`.
2. Extend `AsyncRepository`.
3. Implement a service subclassing `BaseService`.
4. Expose an `APIRouter`.
5. Register one include in `app/api/v1/router.py`.
6. Add an Alembic revision for that module's tables only.
7. Use permission codes from the RBAC catalog / `require_permission*`.

## Security posture

- JWT create/decode utilities are ready and used by Identity.
- Argon2 password hashing is ready and used by Identity.
- Production startup validates secrets and critical config.
- RBAC data model and admin APIs exist and are permission-guarded.
- `get_current_user` / `require_permission*` resolve Identity principals and fail closed.
- Settings, RBAC, Media, and Identity admin routes require authentication + permissions.

## Soft-delete + uniqueness note

Hard unique constraints on business keys (`settings.key`, `permissions.key`, `roles.name`, …) interact with soft delete: a soft-deleted row still occupies the unique key. Users use a **partial unique index** on username. Role–permission assignment restores soft-deleted links. Future Inventory barcodes/SKUs should use **partial unique indexes** (`WHERE is_deleted = false`) or an equivalent pattern.

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "…",
    "details": {}
  },
  "request_id": "…"
}
```

Messages are Arabic-facing; codes remain English.

## Related docs

- [`docs/API_STANDARDS.md`](../../docs/API_STANDARDS.md)
- [`docs/DATABASE_GUIDELINES.md`](../../docs/DATABASE_GUIDELINES.md)
- [`docs/IDENTITY_RULES.md`](../../docs/IDENTITY_RULES.md)
- [`docs/MEDIA_MODULE.md`](../../docs/MEDIA_MODULE.md)
- [`docs/DRESS_DOMAIN.md`](../../docs/DRESS_DOMAIN.md)

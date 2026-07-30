# Project Structure

```text
backend/
├── alembic/                 # Async migration environment
│   ├── versions/
│   │   ├── 20260726_0001_settings.py
│   │   ├── 20260726_0002_rbac.py
│   │   ├── 20260726_0003_identity.py
│   │   └── 20260726_0004_media.py
│   ├── env.py
│   └── script.py.mako
├── app/
│   ├── api/                 # HTTP presentation layer
│   │   └── v1/endpoints/    # health, version, root
│   ├── common/              # Mixins, shared enums
│   ├── config/              # pydantic-settings + production validation
│   ├── core/                # Constants + lifespan
│   ├── database/            # Engine, session, Base, Redis
│   ├── dependencies/        # FastAPI DI providers (auth, db)
│   ├── exceptions/          # Exception taxonomy + handlers
│   ├── middleware/          # Request ID, timing
│   ├── models/              # Abstract AuditedSoftDeleteModel ONLY
│   ├── modules/
│   │   ├── settings/        # Business configuration module
│   │   ├── rbac/            # Roles & permissions module
│   │   ├── identity/        # Users, auth sessions, tokens
│   │   └── media/           # Generic file storage & references
│   ├── repositories/        # Generic AsyncRepository
│   ├── schemas/             # Shared Pydantic DTOs
│   ├── security/            # JWT, Argon2, auth protocols
│   ├── services/            # BaseService
│   ├── utils/               # logging, datetime
│   └── main.py              # Application factory (+ startup validation)
├── docs/
├── tests/
│   ├── modules/settings/
│   ├── modules/rbac/
│   ├── modules/identity/
│   └── modules/media/
├── .env.example
├── alembic.ini
├── pyproject.toml
└── README.md
```

## Folder responsibilities

| Path | Why it exists |
|---|---|
| `api/` | Versioned HTTP surface; modules register routers here |
| `common/` | Reusable mixins/enums shared across modules |
| `config/` | Environment settings + production startup validation |
| `core/` | App identity and lifespan hooks |
| `database/` | Async SQLAlchemy engine/session and optional Redis |
| `dependencies/` | Thin DI adapters for FastAPI (composition root may delegate to Identity) |
| `exceptions/` | Unified error codes and global handlers |
| `middleware/` | Cross-cutting HTTP concerns |
| `models/` | Abstract bases — concrete entities live in modules |
| `modules/` | Bounded contexts (`settings`, `rbac`, `identity`, `media`, future domains) |
| `repositories/` | Persistence abstraction (repository pattern) |
| `schemas/` | Shared API contracts |
| `security/` | Auth primitives (JWT/Argon2) |
| `services/` | Application service base for use cases |
| `utils/` | Logging and datetime helpers |
| `tests/` | Foundation and module verification |
| `docs/` | Operator and developer documentation |

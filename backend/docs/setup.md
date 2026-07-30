# Backend Setup Guide

## Prerequisites

- Python **3.13+**
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL 14+ (16+ recommended)
- Redis (optional)

## 1. Install dependencies

```bash
cd backend
uv sync
```

This creates `.venv` and installs runtime + development dependencies from `pyproject.toml` / `uv.lock`.

## 2. Configure environment

```bash
cp .env.example .env
```

Required values to review:

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` \| `production` \| `testing` |
| `SECRET_KEY` | JWT signing secret (**required long random value in production**) |
| `DATABASE_URL` | Async SQLAlchemy URL (`postgresql+asyncpg://...`) |
| `CORS_ORIGINS` | Explicit origins (no `*` in production) |
| `REDIS_ENABLED` / `REDIS_URL` | Optional Redis |

### Production safety

When `APP_ENV=production`, application startup **aborts** if:

- `SECRET_KEY` is missing, empty, an example/default value, or shorter than 32 characters
- `DATABASE_URL` is missing, not async PostgreSQL, or uses placeholder credentials
- JWT/CORS/debug settings violate production rules

Development may keep example secrets; production must not.

## 3. Create the database

```sql
CREATE USER juman WITH PASSWORD 'juman';
CREATE DATABASE juman OWNER juman;
```

Apply migrations (creates Settings + RBAC tables and seeds):

```bash
uv run alembic upgrade head
uv run alembic current
```

Current head: `20260802_0033_system_backups_duration`.

## 4. Run the API

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 5. Verify

```bash
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/version
curl http://127.0.0.1:8000/api/v1/settings
curl http://127.0.0.1:8000/api/v1/roles
```

OpenAPI (non-production): `http://127.0.0.1:8000/docs`

## 6. Tests

```bash
uv run pytest
uv run pytest --cov=app
```

## Environments

| Profile | Behavior |
|---|---|
| `development` | Debug-friendly; example secrets allowed |
| `production` | Debug off; JSON logs; docs disabled; strict config validation |
| `testing` | Used by pytest |

## Notes

- Do not commit `.env`.
- Redis is optional; the API boots with `REDIS_ENABLED=false`.
- Identity authentication is live (Phases 1–7). Business APIs require Bearer tokens + RBAC permissions.
- Default settings and RBAC seeds are applied by Alembic — the app does not reseed on startup.

## 7. Phase 6 production validation (optional)

Isolated PostgreSQL certification **never** uses the application database. It creates `juman_validation_<uuid>`, runs Alembic + Layer 2, then drops the DB (unless kept).

| Variable | Purpose |
|---|---|
| `DATABASE_ADMIN_URL` | Admin DSN with `CREATEDB` (often `postgres` superuser against `postgres` DB) |
| `DATABASE_URL` | App DSN — used only to derive host/user/password and to refuse name collisions |
| `JUMAN_KEEP_VALIDATION_DB=1` | Keep validation DB after run (`--keep-validation-db`) |
| `JUMAN_POSTGRES_CERT=1` | Enable `tests/postgres_cert` (set automatically by orchestrator) |
| `JUMAN_POSTGRES_CERT_ALLOW_ANY=1` | Allow cert suite against a non-`juman_validation_*` URL (debug only) |
| `PG_DUMP` / `PGDUMP` | Optional absolute path to `pg_dump` if not on `PATH` |
| `JUMAN_PHASE6_ALLOW_PRODUCTION=1` | Override orchestrator block when `APP_ENV=production` |

```bash
cd backend
# PowerShell example
$env:DATABASE_ADMIN_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
$env:DATABASE_URL="postgresql+asyncpg://juman:juman@localhost:5432/juman"
$env:APP_ENV="testing"
uv run python scripts/phase6_validate.py
# Flags: --skip-layer1 | --skip-layer2 | --keep-validation-db
```

Summary JSON: `backend/.phase6/last_run.json` (gitignored).


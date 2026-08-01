# Juman Backend

Backend package for **Juman (جمان)** — Desktop POS & Rental Management System.

For the full project documentation (progress, architecture, changelog, audit), see the root README:

**[../README.md](../README.md)**

## Quick start

```bash
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Implemented in this package

| Area | Status |
|---|---|
| Foundation | Complete |
| Settings module | Complete (Bearer + `settings.*`) |
| RBAC module | Complete (Bearer + `roles.*` / `permissions.*`) |
| Media module | Complete (Bearer + `media.*`) |
| Identity (Phases 1–7) | Complete — login / refresh / logout / me + protected admin APIs |
| Audit module | Complete — append-only logs + admin read API (`audit.view`); Categories/Customers/Dresses write audit rows |
| Categories module | Complete — CRUD / activate / deactivate; Bearer + `categories.*`; audited |
| Customers module | Complete v2 — numbered customers, CRUD / activate / deactivate / search/sort; Bearer + `customer.*`; audited |
| Inventory / Dresses | Phase 1–5 — asset CRUD + barcode + photos + status + search; Bearer + `inventory.*` |
| Rental Financial Settlement | Complete (see root docs) |
| Sales | Complete (see root docs) |

## Auth (Phase 7)

Public: `POST /api/v1/login`, `POST /api/v1/refresh`  
Bearer: `POST /api/v1/logout`, `POST /api/v1/logout-all`, `GET|PATCH /api/v1/me`, plus Sessions / Users / Settings / RBAC / Media.

## Docs

- [setup.md](docs/setup.md)
- [structure.md](docs/structure.md)
- [architecture.md](docs/architecture.md)

> Prefer the root [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) and [`CHANGELOG.md`](../CHANGELOG.md) for current progress.

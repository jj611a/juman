# Architecture Decision Records (ADR)

Juman records significant architecture and product-platform decisions as **Markdown Any Decision Records (MADR)**.

> **Note (2026-08-04):** FastAPI/`backend-python` ADRs below are **historical**. Runtime backend is Nest `backend-node/` only (see `docs/backend-v2/DecisionLog.md` ADR-V2-034).

## Location

```text
docs/ADR/
├── README.md                 ← this file
├── adr-template.md           ← copy for new ADRs
├── 0000-use-madr.md
├── 0001-….md
└── …
```

## Format

We use **[MADR 3.x](https://adr.github.io/madr/)** with one Juman-specific addition:

| MADR section | Purpose |
|---|---|
| Status / date (YAML) | Lifecycle of the decision |
| Context and Problem Statement | Why a decision was needed |
| Decision Drivers | Forces and constraints |
| Considered Options | Alternatives |
| Decision Outcome | What we chose and why |
| Consequences | Good / bad / neutral effects |
| Validation | How we know we comply |
| **Future Impact** | How later modules must behave |
| Pros and Cons of the Options | Option analysis |
| More Information | Links to related docs |

## Status values

| Status | Meaning |
|---|---|
| `proposed` | Under discussion |
| `accepted` | Normative for the project |
| `deprecated` | No longer recommended |
| `superseded` | Replaced by a newer ADR (link it) |

## How to add an ADR

1. Copy `adr-template.md` to `NNNN-short-title-with-dashes.md` (next free number).  
2. Fill every required section; keep English technical prose.  
3. Set `status: accepted` only when the decision is binding.  
4. Link related docs (`IDENTITY_RULES`, `DRESS_DOMAIN`, etc.).  
5. Mention the ADR in `CHANGELOG.md` when it changes project direction.  
6. **Do not** reverse an `accepted` ADR silently — supersede it with a new ADR.

## Index

| ADR | Title | Status |
|---|---|---|
| [0000](0000-use-madr.md) | Use MADR for architecture decisions | accepted |
| [0001](0001-clean-architecture-and-ddd.md) | Clean Architecture and DDD modules | accepted |
| [0002](0002-fastapi-python-async-stack.md) | FastAPI, Python 3.13+, async stack | accepted |
| [0003](0003-postgresql-system-of-record.md) | PostgreSQL as system of record | accepted |
| [0004](0004-uuid-audit-soft-delete.md) | UUID PKs, audit fields, soft delete | accepted |
| [0005](0005-alembic-schema-and-seeds.md) | Alembic owns schema and reference seeds | accepted |
| [0006](0006-jwt-argon2-auth-primitives.md) | JWT and Argon2 auth primitives | accepted |
| [0007](0007-database-driven-rbac.md) | Database-driven RBAC | accepted |
| [0008](0008-closed-directory-identity.md) | Closed-directory identity model | accepted |
| [0009](0009-dress-as-serialized-asset.md) | Dress as serialized physical asset | accepted |
| [0010](0010-dress-state-machine.md) | Canonical dress state machine | accepted |
| [0011](0011-versioned-rest-api-envelope.md) | Versioned REST API and envelopes | accepted |
| [0012](0012-partial-unique-indexes-soft-delete.md) | Partial unique indexes with soft delete | accepted |
| [0013](0013-electron-arabic-rtl-desktop.md) | Electron desktop, Arabic RTL first | accepted |
| [0014](0014-database-driven-settings.md) | Database-driven Settings | accepted |
| [0015](0015-uv-package-management.md) | uv for Python package management | accepted |

## Related documentation

- [`docs/IDENTITY_RULES.md`](../IDENTITY_RULES.md)
- [`docs/DRESS_DOMAIN.md`](../DRESS_DOMAIN.md)
- [`docs/DRESS_STATE_MACHINE.md`](../DRESS_STATE_MACHINE.md)
- [`docs/API_STANDARDS.md`](../API_STANDARDS.md)
- [`docs/DATABASE_GUIDELINES.md`](../DATABASE_GUIDELINES.md)
- [`backend-python/docs/architecture.md`](../../backend-python/docs/architecture.md)

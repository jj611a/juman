---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0005. Alembic owns schema and reference seeds

## Context and Problem Statement

Schema drift and duplicated seed logic cause production incidents. Who owns DDL and reference data (settings defaults, RBAC catalog)?

## Decision Drivers

* Reproducible deploys
* No demo/fake startup data (constitution)
* Avoid dual sources of truth (Python defaults vs SQL seeds)
* Async migration environment already in foundation

## Considered Options

* SQLAlchemy `create_all` on startup + in-app seeders
* Alembic migrations for schema; optional in-app seed on boot
* Alembic owns schema **and** idempotent reference seeds

## Decision Outcome

Chosen option: "Alembic owns schema and idempotent reference seeds", because Settings already moved to Alembic-only seeding and RBAC seeds ship in migrations.

### Consequences

* Good, because environments converge via `alembic upgrade head`
* Good, because seed idempotency can be enforced in SQL
* Bad, because seed fixes need new revisions after deploy
* Neutral, because test suites may apply seed helpers mirroring migration rows

### Future Impact

* Module tables ship with their own Alembic revision
* Runtime `ensure_defaults()` style reseeders are rejected for reference catalogs
* Bootstrap admin user follows Identity Rules (controlled path), not ad-hoc demo seeds

## Validation

* Settings/RBAC migrations and docs
* Startup must not recreate production schema

## Pros and Cons of the Options

### create_all + in-app seeders

* Good, because fast local hacking
* Bad, because drift and non-reproducible prod

### Alembic schema + boot seed

* Good, because schema versioned
* Bad, because defaults can diverge from migration history

### Alembic schema + seeds

* Good, because single ownership
* Bad, because slightly heavier migration files

## More Information

* [`docs/DATABASE_GUIDELINES.md`](../DATABASE_GUIDELINES.md)
* ADR [0014](0014-database-driven-settings.md)

---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0003. PostgreSQL as system of record

## Context and Problem Statement

Juman needs a durable store for assets, rentals, payments, RBAC, and audit history. Which database engine is the system of record?

## Decision Drivers

* Relational integrity (FKs, partial unique indexes)
* Concurrent POS usage
* JSONB when needed without abandoning SQL
* Operational familiarity and Windows/LAN deployability
* Async driver support (`asyncpg`)

## Considered Options

* PostgreSQL
* SQLite as primary production DB
* Document DB (MongoDB) as primary

## Decision Outcome

Chosen option: "PostgreSQL", because dress/rental domains need strong constraints, transactions, and partial indexes; SQLite remains acceptable only for isolated tests.

### Consequences

* Good, because partial unique indexes and `timestamptz` fit soft-delete and audit designs
* Good, because transactions protect status + document atomicity
* Bad, because operators must run/maintain PostgreSQL
* Neutral, because Redis stays optional cache/support, not source of truth

### Future Impact

* All business modules persist to PostgreSQL
* Partitioning/backup strategies assume PostgreSQL
* Replacing the engine requires a superseding ADR

## Validation

* `DATABASE_URL` uses `postgresql+asyncpg://…`
* Production validation rejects non-async PostgreSQL URLs

## Pros and Cons of the Options

### PostgreSQL

* Good, because enterprise-grade constraints and tooling
* Bad, because heavier than SQLite for tiny demos

### SQLite as production primary

* Good, because zero-admin local files
* Bad, because weaker concurrency and operational limits for multi-station POS

### Document DB primary

* Good, because flexible documents
* Bad, because weak multi-row transactional integrity for rental/payment flows

## More Information

* [`docs/DATABASE_GUIDELINES.md`](../DATABASE_GUIDELINES.md)

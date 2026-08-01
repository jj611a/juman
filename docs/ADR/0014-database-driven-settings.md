---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0014. Database-driven Settings

## Context and Problem Statement

Stores need tunable business parameters (barcode prefix/length, rental payment rules, company profile) without code deploys. Where do settings live?

## Decision Drivers

* Per-store configuration
* Typed accessors and validation
* Avoid hardcoded business values in services
* Admin-editable with future permission guards

## Considered Options

* Environment variables only for all business knobs
* Config files on disk (JSON/YAML) edited manually
* Database-driven Settings module with Alembic-seeded defaults

## Decision Outcome

Chosen option: "Database-driven Settings module with Alembic-seeded defaults", already implemented as the first business module.

### Consequences

* Good, because runtime changes without redeploy
* Good, because validation centralized
* Bad, because mutating APIs must be authenticated (Users)
* Neutral, because true secrets (SECRET_KEY, DB URL) remain environment-based

### Future Impact

* Business tunables prefer Settings keys over new env vars
* Security-critical process config stays in env + startup validation
* New keys ship via migration seeds + constants enum

## Validation

* Settings module tests and migration seeds
* ADR [0005](0005-alembic-schema-and-seeds.md)

## Pros and Cons of the Options

### Environment variables only

* Good, because simple ops for infra
* Bad, because poor fit for frequent business toggles

### Disk config files

* Good, because visible on host
* Bad, because multi-station sync and validation are weaker

### Database-driven Settings

* Good, because admin UX and typed validation
* Bad, because requires careful seed/migration discipline

## More Information

* Settings module under `backend-python/app/modules/settings/`
* [`docs/DATABASE_GUIDELINES.md`](../DATABASE_GUIDELINES.md) seed policy

---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0004. UUID primary keys, audit fields, and soft delete

## Context and Problem Statement

ERP entities must remain attributable over years of rentals and sales. How should identity, audit, and deletion work at the row level?

## Decision Drivers

* Project Constitution mandates UUID, timestamps, audit actors, soft delete
* Historical rentals must still resolve who/what
* Safe client-side id generation / non-enumerable PKs
* Desktop multi-station merges later

## Considered Options

* Integer serial PKs + hard deletes
* UUID v4 PKs + soft delete + audit columns on all business entities
* UUID PKs without soft delete (hard delete + archive tables only)

## Decision Outcome

Chosen option: "UUID v4 PKs + soft delete + audit columns on all business entities", implemented via `AuditedSoftDeleteModel` mixins.

### Consequences

* Good, because consistent entity shape across modules
* Good, because soft delete preserves accountability
* Bad, because unique constraints interact with soft-deleted rows (see ADR-0012)
* Bad, because UUID indexes are larger than ints
* Neutral, because audit FK to users may be added after Users module

### Future Impact

* New business tables inherit the mixin base unless an ADR grants an exception (e.g. pure append-only logs)
* Hard delete of core entities in production is forbidden
* API lists exclude soft-deleted rows by default

## Validation

* `app/common/mixins.py` and `AuditedSoftDeleteModel`
* Database guidelines + code review

## Pros and Cons of the Options

### Integer serial + hard delete

* Good, because compact indexes
* Bad, because breaks constitution and historical attribution

### UUID v4 + soft delete + audit

* Good, because constitution-aligned and history-safe
* Bad, because requires partial unique strategies

### UUID without soft delete

* Good, because simpler uniqueness
* Bad, because accidental hard deletes destroy ERP history

## More Information

* [`docs/DATABASE_GUIDELINES.md`](../DATABASE_GUIDELINES.md)
* ADR [0012](0012-partial-unique-indexes-soft-delete.md)

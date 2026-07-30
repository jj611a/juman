---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0012. Partial unique indexes with soft delete

## Context and Problem Statement

Soft-deleted rows still occupy hard `UNIQUE` constraints, blocking recreation of usernames/barcodes/keys. How should uniqueness work for recreatable business keys?

## Decision Drivers

* Soft delete is mandatory for business entities (ADR-0004)
* Inventory barcodes and usernames may need reuse after offboarding (policy-dependent)
* Database must enforce integrity, not only Python
* Settings/permission keys may intentionally remain globally unique even when soft-deleted

## Considered Options

* Hard UNIQUE only; never reuse keys
* Soft-delete rename on delete (`barcode__deleted__<uuid>`)
* Partial unique indexes (`WHERE is_deleted = false`) for recreatable keys

## Decision Outcome

Chosen option: "Partial unique indexes (`WHERE is_deleted = false`) for recreatable keys", while allowing hard UNIQUE for immutable catalog keys (e.g. permission keys) when permanent reservation is desired.

### Consequences

* Good, because live uniqueness without blocking legitimate reuse
* Good, because PostgreSQL enforces the rule
* Bad, because developers must choose hard vs partial per key deliberately
* Neutral, because operational policy may still forbid barcode reuse even if the index allows it

### Future Impact

* Dress barcodes and usernames should use partial uniques unless a tighter policy ADR says otherwise
* New modules document uniqueness type in migrations
* Foundation note in architecture docs remains applicable

## Validation

* [`docs/DATABASE_GUIDELINES.md`](../DATABASE_GUIDELINES.md)
* Migration review for Inventory/Users

## Pros and Cons of the Options

### Hard UNIQUE only

* Good, because simple
* Bad, because soft-deleted rows block recreating the same business key

### Rename on delete

* Good, because keeps hard UNIQUE
* Bad, because mutates identity keys and complicates history searches

### Partial unique indexes

* Good, because expresses “unique among live rows”
* Bad, because slightly more complex DDL

## More Information

* ADR [0004](0004-uuid-audit-soft-delete.md)
* [`docs/DRESS_DOMAIN.md`](../DRESS_DOMAIN.md)

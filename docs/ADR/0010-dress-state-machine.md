---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0010. Canonical dress state machine

## Context and Problem Statement

A dress moves through reservation, rental, return, inspection, processing, sale, and write-off. How are legal status transitions defined so modules do not invent conflicting statuses?

## Decision Drivers

* Single canonical status per dress
* Prevent illegal shortcuts (e.g. RENTED → AVAILABLE)
* Align Calendar, Rentals, Inspection, Laundry, Sales
* Terminal finality for SOLD and RUINED

## Considered Options

* Free-form status strings per module
* Document-only status (derive dress state from open documents)
* Explicit canonical state machine with enforced transitions

## Decision Outcome

Chosen option: "Explicit canonical state machine with enforced transitions", documented in `docs/DRESS_STATE_MACHINE.md` with states: AVAILABLE, RESERVED, RENTED, RETURNED, INSPECTION, PROCESSING, SOLD, RUINED.

### Consequences

* Good, because one authority for rentability/sellability
* Good, because side effects/events are specified per transition
* Bad, because engine implementation must be careful and transactional
* Neutral, because UI badges like OVERDUE stay derived, not new states

### Future Impact

* Dress Status Engine / Inventory must enforce the matrix server-side
* New states require updating the state-machine doc and this ADR (or supersession)
* Modules request transitions; they do not silently patch status

## Validation

* [`docs/DRESS_STATE_MACHINE.md`](../DRESS_STATE_MACHINE.md)
* Future automated tests for allowed/forbidden transitions

## Pros and Cons of the Options

### Free-form statuses

* Good, because flexible
* Bad, because inconsistent modules and broken calendars

### Derive-only from documents

* Good, because fewer stored fields
* Bad, because expensive/error-prone queries and unclear “current” state

### Explicit state machine

* Good, because auditable and enforceable
* Bad, because upfront design cost (already paid in docs)

## More Information

* [`docs/DRESS_STATE_MACHINE.md`](../DRESS_STATE_MACHINE.md)
* ADR [0009](0009-dress-as-serialized-asset.md)

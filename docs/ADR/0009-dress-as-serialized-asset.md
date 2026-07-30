---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0009. Dress as serialized physical asset

## Context and Problem Statement

Dress stores rent and sell individual gowns that look alike but differ in condition, calendar, and liability. Is a Dress a quantity SKU or a unique asset?

## Decision Drivers

* Per-dress calendar conflicts
* Barcode scanning on hangers
* Damage liability per garment
* Inspection and laundry queues
* Sale must remove one specific asset from the rental fleet

## Considered Options

* Quantity-based product SKU inventory
* Serialized physical asset per dress (UUID + barcode)
* Hybrid: style SKU with optional serials

## Decision Outcome

Chosen option: "Serialized physical asset per dress (UUID + barcode)", as normative domain law in `docs/DRESS_DOMAIN.md`.

### Consequences

* Good, because calendar, rental, inspection, and sale models stay coherent
* Good, because avoids a future foundational rewrite
* Bad, because more rows than SKU quantity models
* Neutral, because categories/styles remain classification only
* Bad, because accessories may later need a different quantity model (explicitly non-dress)

### Future Impact

* Inventory module creates one row per physical dress
* No `quantity` meaning fungible dresses
* All downstream modules reference `dress_id`

## Validation

* [`docs/DRESS_DOMAIN.md`](../DRESS_DOMAIN.md) acceptance criteria
* Architecture review of Inventory designs against this ADR

## Pros and Cons of the Options

### Quantity SKU

* Good, because familiar retail POS
* Bad, because cannot express per-gown calendar/damage truth

### Serialized asset

* Good, because correct for rental ERP
* Bad, because heavier master data entry

### Hybrid SKU + optional serials

* Good, because flexible
* Bad, because dual paths invite bugs and inconsistent availability

## More Information

* [`docs/DRESS_DOMAIN.md`](../DRESS_DOMAIN.md)
* ADR [0010](0010-dress-state-machine.md)

# Backend V2 Inventory Design (Phase 4.1–4.2)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/inventory`  
**Role:** Generic Item Catalog + authoritative operational lifecycle.

## Scope

**In scope:** Category, Brand, Color, Size, Item CRUD; soft delete/restore; search/filter; ItemMedia + ItemBarcode; **lifecycle state machine** + history + availability predicates.

**Out of scope:** reservations, rentals, availability calendar, penalties, laundry/inspection workflows, payments/sales execution.

## Two status dimensions

| Dimension | Field | Purpose |
|-----------|--------|---------|
| Catalog | `status` | draft / active / inactive / archived / retired |
| Lifecycle | `lifecycleState` | Operational machine used by future rentals/sales |

Future modules **must** call `LifecycleService.transition` — never invent parallel state machines.

## Lifecycle states

`available` · `reserved` · `rented` · `return_pending` · `inspection` · `cleaning` · `maintenance` · `for_sale` · `sold` · `retired` · `lost` · `damaged`

### Primary path

```mermaid
stateDiagram-v2
  [*] --> available
  available --> reserved
  reserved --> rented
  rented --> return_pending
  return_pending --> inspection
  inspection --> cleaning
  cleaning --> available
  available --> for_sale
  for_sale --> sold
  available --> maintenance
  maintenance --> available
  available --> retired
  available --> lost
  available --> damaged
  damaged --> maintenance
  damaged --> retired
  lost --> available
  lost --> retired
  sold --> retired
```

Invalid edges are rejected (409). Concurrent transitions use CAS (`updateMany` where current state matches).

## Service

`transition` · `canTransition` · `currentState` · `history` · `recordCreated`

Availability helpers (no booking):

- `isOperational()`
- `isRentable()` — active catalog + `available`
- `isSellable()` — active + `available` | `for_sale`
- `isEditable()` — catalog fields when lifecycle allows

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| GET | `/items/:id/state` | inventory.view |
| GET | `/items/:id/history` | inventory.view |
| POST | `/items/:id/transition` | inventory.transition |

Body: `{ newState, reason?, referenceType?, referenceId?, expectedState? }`

## History

`ItemStateHistory`: old/new state, reason, user, optional reference entity, timestamp.

## Architecture

```
Item ──► Category / Brand / Color / Size
     ──► ItemMedia ──► MediaFile
     ──► ItemBarcode ──► Barcode
     ──► ItemStateHistory (append-only)
```

## Coverage

```bash
pnpm test:cov:inventory
```

# Backend V2 Rental Design (Phase 5.1)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/rentals`  
**Role:** Rental workflow engine foundation (no settlements).

## Scope

**In scope:** Draft → checkout → active → return_pending / cancel; inventory synchronization via `LifecycleService`; customer reuse; RBAC; audit.

**Out of scope:** Reservations, payments, late fees, penalties, financial settlement, inspection/cleaning workflows, reports, overdue automation.

## Architecture rule

Inventory owns `Item.lifecycleState`.

`RentalsService` **must** call `LifecycleService.transition` (optionally inside a shared Prisma transaction).  
It must **never** write `Item.lifecycleState` directly.

## Models

### Rental
- `rentalNumber` (RENT-########)
- `customerId` → Customer
- `rentalDate`, `expectedReturnDate`, `actualReturnDate?`
- `status`, `notes`
- soft delete + audit actors + UUID

### RentalItem
- `itemId` → Item
- `barcodeValue` snapshot
- `agreedRentalPrice` (fils snapshot)
- unique `(rentalId, itemId)`

### RentalStatusHistory
- append-only rental status transitions

## Rental statuses

`draft` · `checked_out` · `active` · `return_pending` · `completed` · `cancelled` · `overdue` (foundation only)

### Transitions

```
draft → checked_out | cancelled
checked_out → active | return_pending | cancelled
active → return_pending | overdue | cancelled
overdue → return_pending | cancelled
return_pending → completed
completed → ∅
cancelled → ∅
```

## Checkout

Single transaction:

1. Validate draft + rentable items + active customer
2. Per item: `available → reserved → rented` via LifecycleService
3. Rental: `draft → checked_out → active`
4. Audit `checkout`

## Return (foundation)

Outbound (`checked_out` | `active` | `overdue`) → `return_pending`  
Inventory: `rented → return_pending`  
Sets `actualReturnDate`. No inspection/cleaning yet.

## Cancel

- Draft: status → cancelled (inventory untouched)
- Outbound: inventory `rented → return_pending → inspection → available`, then rental cancelled

## Create validation / finance

On checkout, `RentalsService.syncCheckoutFinance` requests `FinanceService.createCharge` (sum of `agreedRentalPrice`) and optional `registerDeposit`. Rentals never write financial tables.

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| POST | `/rentals` | rentals.create |
| GET | `/rentals` | rentals.view |
| GET | `/rentals/:id` | rentals.view |
| POST | `/rentals/:id/checkout` | rentals.checkout |
| POST | `/rentals/:id/return` | rentals.return |
| POST | `/rentals/:id/cancel` | rentals.cancel |

## Coverage

```bash
pnpm test:cov:rentals
```

## Known limitations (post Phase 5.4)

- Create/checkout call `AvailabilityService` under `runExclusive` (Must-Fix cleared).
- Public DTO includes `reservationId` when linked.
- `overdue` and `return_pending → completed` remain transition-map foundations only (no HTTP yet).
- Cert: `PHASE_5_ENGINEERING_CERTIFICATION.md` · Remediation: `PHASE_5_REMEDIATION_REPORT.md`.

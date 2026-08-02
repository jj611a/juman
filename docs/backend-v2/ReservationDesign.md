# Backend V2 Reservation Design (Phase 5.2)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/reservations`  
**Role:** Reservation engine — independent from rentals until explicit checkout.

## Scope

**In scope:** Create/confirm, conflict detection, checkout → rental, cancel, expire foundation, AvailabilityService, RBAC, audit.

**Out of scope:** Payments, late fees, penalties, settlement, reports, inspection, cleaning, calendar UI, scheduler.

## Architecture

- A reservation is **not** a rental.
- Checkout is the only path that materializes a `Rental` and mutates inventory.
- Inventory ownership remains with `LifecycleService` (via `RentalsService.materializeActiveFromReservation` inside a shared TX).

## Models

### Reservation
- `reservationNumber` (RSV-########)
- `customerId`
- `startDate`, `expectedCheckoutDate`, `expectedReturnDate`
- `status`, `notes`, soft delete, audit actors, UUID

### ReservationItem
- `itemId`, `barcodeValue` snapshot, `agreedRentalPrice`

### ReservationStatusHistory
- append-only status transitions

`Rental.reservationId` optional unique FK when created from checkout.

## Statuses

`draft` · `confirmed` · `checked_out` · `cancelled` · `expired` · `completed`

Create flow: draft → confirmed (same request; audits Created + Confirmed).

### Transitions

```
draft → confirmed | cancelled | expired
confirmed → checked_out | cancelled | expired
checked_out → completed
cancelled / expired / completed → ∅
```

## AvailabilityService

Reusable conflict detector (calendar-ready):

- Overlapping **reservations** in `draft|confirmed`
- Overlapping **rentals** in `draft|checked_out|active|return_pending|overdue`
- Ignores cancelled / expired / completed reservations
- Ignores cancelled / completed rentals
- Half-open interval overlap `[start, end)`

Window for reservations: `startDate` → `expectedReturnDate`.

## Checkout

Single transaction:

1. Validate confirmed + rentable items + active customer + availability (exclude self)
2. `RentalsService.materializeActiveFromReservation` → rental active + inventory `available→reserved→rented`
3. Reservation → `checked_out`
4. Audit checkout

## Expiration

`expireReservation(id)` — foundation only, no scheduler. HTTP `POST /reservations/:id/expire`.

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| POST | `/reservations` | reservations.create |
| GET | `/reservations` | reservations.view |
| GET | `/reservations/:id` | reservations.view |
| POST | `/reservations/:id/checkout` | reservations.checkout |
| POST | `/reservations/:id/cancel` | reservations.cancel |
| POST | `/reservations/:id/expire` | reservations.expire |

## Coverage

```bash
pnpm test:cov:reservations
```

## Known limitations (post Phase 5.4)

- Concurrent create is serialized via `AvailabilityService.runExclusive` (TOCTOU Must-Fix cleared).
- Walk-in rentals share the same allocator (symmetry restored).
- Expire has no scheduler; ops/jobs must call HTTP/service.
- Full cert + remediation: `PHASE_5_ENGINEERING_CERTIFICATION.md`, `PHASE_5_REMEDIATION_REPORT.md`.

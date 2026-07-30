# Reservations Module — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients, future Rentals module  
**Status:** Implemented  
**Scope:** Customer holds on one or more dresses for a future rental window — no payments, totals, rentals, or receipts

Related: [`CALENDAR_ENGINE.md`](CALENDAR_ENGINE.md), [`DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md), [`CUSTOMER_MODULE.md`](CUSTOMER_MODULE.md).

---

## 1. Purpose

Reservations let the shop **draft** and then **confirm** that specific dresses are held for a customer’s rental period.

- Availability is decided **only** by the Calendar Engine  
- Dress operational state changes **only** via the Status Engine  
- Agreed **daily** rental prices are snapshotted per item; no totals/deposits/penalties  

---

## 2. Lifecycle

```text
Draft ──confirm──► Confirmed ──cancel──► Cancelled
  │                    │
  │                    ├──expire──► Expired
  │                    └──(via POST /rentals)──► CONVERTED_TO_RENTAL
  └──cancel──► Cancelled
```

| Status | Calendar | Dress status |
|---|---|---|
| `DRAFT` | none | unchanged |
| `CONFIRMED` | one `RESERVATION` block per item | `AVAILABLE → RESERVED` |
| `CANCELLED` / `EXPIRED` | blocks removed | `RESERVED → AVAILABLE` |
| `CONVERTED_TO_RENTAL` | blocks removed by Rentals; RENTAL blocks owned by rental | `RESERVED → RENTED` (Rentals) |

**Draft** is editable (`PATCH`). Confirmed/Cancelled/Expired headers are immutable except cancel/expire actions. Conversion is owned by the Rentals module.

---

## 3. Database schema

### `reservations`

| Column | Notes |
|---|---|
| `reservation_number` | Immutable `RSV-########` (settings-driven) |
| `customer_id` | FK → customers |
| `reservation_at` | Shop timestamp (must precede rental start) |
| `rental_start_at` / `expected_return_at` | Reserved window → calendar `[start, end)` |
| `status` | `DRAFT` / `CONFIRMED` / `CANCELLED` / `EXPIRED` / `CONVERTED_TO_RENTAL` |
| `notes` | optional |
| audit + soft delete | mixins |

### `reservation_items`

| Column | Notes |
|---|---|
| `dress_id` | FK → dresses |
| `reserved_daily_rental_price` | Agreed daily price (fils) snapshot |
| `calendar_block_id` | Set on confirm; cleared on cancel/expire |
| `notes` | optional |

Migration: `20260727_0020_reservations`.  
Settings: `reservations.number.prefix/separator/padding` (defaults `RSV` / `-` / `8`).

---

## 4. Calendar integration

On **confirm**, for each live item:

1. `CalendarService.is_available(dress_id, rental_start_at, expected_return_at)`  
2. `CalendarService.create_block(block_type=RESERVATION, reference_module="reservation", reference_id=reservation.id)`  
3. Persist `calendar_block_id` on the item  

On **cancel** (confirmed) / **expire**:

- `CalendarService.remove_block(calendar_block_id)` per item  

Reservations never compute overlaps themselves.

---

## 5. Status transitions

| Event | Status Engine |
|---|---|
| Confirm | `AVAILABLE → RESERVED` per dress |
| Cancel / Expire (from Confirmed) | `RESERVED → AVAILABLE` per dress |
| Draft create/update/cancel | none |

Never write `Dress.status` directly.

---

## 6. API

Permissions (seeded): `reservation.view`, `reservation.create`, `reservation.update`, `reservation.cancel`.

| Method | Path | Perm |
|---|---|---|
| `POST` | `/api/v1/reservations` | create — Draft |
| `GET` | `/api/v1/reservations` | view |
| `GET` | `/api/v1/reservations/{id}` | view |
| `PATCH` | `/api/v1/reservations/{id}` | update — Draft only |
| `POST` | `/api/v1/reservations/{id}/confirm` | update |
| `POST` | `/api/v1/reservations/{id}/cancel` | cancel |
| `POST` | `/api/v1/reservations/{id}/expire` | update |

No convert-to-rental HTTP route on Reservations. Convert by `POST /api/v1/rentals` with `reservation_id`.  
`ReservationService.mark_converted_to_rental()` is called by Rentals after successful handover (status + clear item block ids + audit `convert`).  
`convert_to_rental()` redirects callers with Arabic `ValidationError` (`use_rentals_create`).

Audit: `module="reservations"`, `entity_type="Reservation"`; actions create / update / confirm / cancel / expire / convert.

---

## 7. Explicit non-goals

Returns, Payments, Inspection, Laundry, Sales; payment collection; totals/deposits/penalties/taxes; receipts. Rental commercial flow lives in [`RENTALS.md`](RENTALS.md).

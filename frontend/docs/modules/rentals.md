# Rentals module (5.6 Checkout)

Arabic RTL feature under `src/features/rentals/`.

## Transport

- Domain: `apiClient.rentals.*`
- Convert: `POST /rentals` with `reservation_id` (no reservations convert route)

## Surfaces

| Route | Behavior |
|---|---|
| `#/rentals` | List with estimated_total / remaining_balance from DTO |
| `#/rentals/new` | Checkout wizard (walk-in or `?reservationId=`) |
| `#/rentals/:id` | Detail; notes edit on ACTIVE; no working cancel |

## Permissions

- `rental.view|create|update`
- Cancel endpoint exists but always 422 — not offered as working UI

## Locks

- `estimated_total` / `remaining_balance` / `expected_rental_days` only from API
- Pricing step shows daily prices only (no client sum)
- Payment: FIXED_AMOUNT value or PERCENTAGE rate; backend computes

# Rental Settlements module (5.9)

Arabic RTL feature under `src/features/settlements/`.

## Transport

- Domain: `apiClient.settlements.*` → `/rental-settlements`
- Collect: `POST .../payments`; Adjust: `POST .../adjustments`

## Surfaces

| Route | Behavior |
|---|---|
| `#/settlements` | List + outstanding preset (OPEN + PARTIALLY_PAID) |
| `#/settlements/new` | Create from RETURN_PENDING rental |
| `#/settlements/:id` | Money snapshot, charges, payment history, collect/adjust |

## Permissions

- `rental.settlement.view|create|collect|adjust`

## Locks

- Display `remaining_balance` / `total_due` / `total_paid` from API only
- No standalone Payments module; no refunds
- Nested `payments[]` is the payment history

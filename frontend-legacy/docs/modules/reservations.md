# Reservations module (5.5)

Arabic RTL feature under `src/features/reservations/`.

## Transport

- Domain: `apiClient.reservations.*`
- Availability preview: `apiClient.calendar.availability` / `conflicts`
- Audit: `entity_type=Reservation`

## Surfaces

| Route | Behavior |
|---|---|
| `#/reservations` | List: offset/limit; customer lookup filter; status |
| `#/reservations/new` | Wizard: customer → dresses → dates → availability → summary → draft/confirm |
| `#/reservations/:id` | Detail + confirm/cancel/expire/convert CTA |
| `#/reservations/:id/edit` | Draft only |

## Permissions

- `reservation.view|create|update|cancel`
- Confirm/expire use `reservation.update`
- Convert uses `rental.create` → `#/rentals/new?reservationId=`

## Locks

- No reservation totals; daily price only
- Availability enforced by backend on confirm; FE preview only
- Overlapping drafts allowed

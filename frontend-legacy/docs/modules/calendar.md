# Calendar module (5.4)

Arabic RTL feature under `src/features/calendar/`.

## Transport

- Timeline: `GET /calendar/dress/{id}?from=&to=` via `apiClient.calendar.timeline`
- Availability / conflicts: calendar endpoints only — **no client overlap math for free/busy**
- Manual blocks: `calendar.manage` creates/edits/deletes **MAINTENANCE** only

## Surfaces

| Route | Behavior |
|---|---|
| `#/calendar` | Dress picker (search inventory) |
| `#/calendar/:dressId` | Month / Week / Day for that dress; block drawer; maintenance form; availability panel |

## Permissions

- View: `calendar.view`
- Manage maintenance blocks: `calendar.manage`

## Query keys

- `['calendar', 'timeline', dressId, from, to]`
- `['calendar', 'availability', …]` / `['calendar', 'conflicts', …]`

## Locks

- **Per-dress only** — no store-wide multi-dress month feed
- Block colors are FE tokens mapped from `block_type`
- Reservation/rental/processing references show “وحدة الواجهة لاحقاً” — no fake routes

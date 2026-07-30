# Users module (5.11)

Arabic RTL feature under `src/features/users/`.

## Transport

- `apiClient.users.*` — offset/limit list; activate/deactivate; soft delete
- Admin reset: `POST /admin/reset-password` (`users.manage`)

## Locks

- No unlock UI (no HTTP route)
- Username immutable after create

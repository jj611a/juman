# Settings module (5.11)

Arabic RTL feature under `src/features/settings/`.

## Transport

- `apiClient.settings.list/get/update/patchValue`
- Categories from backend enum; security/media/backup are `system` key prefixes

## Locks

- Only seeded keys; respect `is_editable`
- Unsaved changes guard before leave

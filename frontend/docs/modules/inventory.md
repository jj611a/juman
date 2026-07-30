# Inventory module (5.3)

Arabic RTL feature under `src/features/inventory/`.

## Transport

- Domain: `apiClient.dresses.*` / `apiClient.dressPhotos.*`
- Media: upload via `apiClient.media.upload` → `POST /dresses/{id}/photos` with `stored_file_id`
- Download: media data-URL helper for gallery `src`
- Audit: `apiClient.audit.listLogs` with `entity_type=Dress`
- Availability panel: `apiClient.calendar.availability` / `conflicts` (read-only)

## Surfaces

| Route | Behavior |
|---|---|
| `#/inventory` | List: barcode, name, category, status chip, prices; `page`/`page_size`; row selection UI-only |
| `#/inventory/new` | Create form (status not on body) |
| `#/inventory/:id` | EntityHeader, BarcodeDisplay, photos, status dialog, audit, availability |
| `#/inventory/:id/edit` | Edit form + dirty guard |

## Permissions

- Nav / list / detail: `inventory.view`
- Mutations: `inventory.create|update|delete`
- Barcode PATCH: **Admin role** (API); UI gated via `system.*` approximation
- Status: `POST .../status` only — never invent transitions
- Audit: `audit.view`
- Media: `media.view` / `media.upload` / `media.manage`

## Query keys

- `['inventory', 'list', params]`
- `['inventory', 'detail', id]`
- `['inventory', 'detail', id, 'photos']`
- `['inventory', 'detail', id, 'audit']`

## Locks

- List pagination uses **page / page_size** (not offset/limit)
- Status display via `DRESS_STATUS_MAP` only
- Money as integer fils via `MoneyDisplay`

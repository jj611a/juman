# Customers module (5.2)

Arabic RTL feature under `src/features/customers/`.

## Transport

- Domain: `apiClient.customers.*`
- Media: `apiClient.media.*` via thin `customerMediaApi` (FileReference — **no** image fields on Customer DTO)
- Audit: `apiClient.audit.listLogs` with `entity_type=Customer`

## Surfaces

| Route | Behavior |
|---|---|
| `#/customers` | List: number, name, phone, status; create drawer |
| `#/customers/:id` | EntityHeader (+ profile MediaThumbnail), RecordInfoPanel, MediaGallery, AuditTimeline, edit drawer |

## Media conventions

- `module_name=customers`, `entity_type=customer`, `entity_id=<uuid>`
- Profile: `purpose=profile`, `is_primary=true`
- Gallery: other purposes (e.g. `gallery`)
- Download returns a **data URL** from Main for `<img src>`

**Note:** Creating a FileReference requires backend `media.manage`. Upload alone is `media.upload`. Gate UI with `media.view` / `media.upload|manage`.

## Permissions

- Nav / list / detail: `customer.view` (**singular** — not `customers.view`)
- Mutations: `customer.create|update|delete`
- Audit timeline: `audit.view` (empty / info if missing)
- Media: `media.view` / `media.upload` / `media.manage`

## Query keys

- `['customers', 'list', params]`
- `['customers', 'detail', id]`
- `['customers', 'detail', id, 'media']`
- `['customers', 'detail', id, 'audit']`

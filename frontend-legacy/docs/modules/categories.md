# Categories module (5.1)

Arabic RTL feature under `src/features/categories/`.

## Transport

- Renderer calls `apiClient.categories.*` only (IPC `juman:api:invoke` → Main Axios + JWT).
- Never Axios/JWT in the renderer.

## Surfaces

| Route | Behavior |
|---|---|
| `#/categories` | Server-mode list: `q`, `active_only`, `sort_by`, `sort_dir`, offset/limit |
| Drawer create/edit | Zod form mirrors backend; dirty close confirm |
| Drawer details | Read-only + activate / deactivate / delete (permission-gated) |

## Permissions

- `categories.view` — list/details + nav
- `categories.create` / `update` / `delete` — mutations

## Delete

Backend may return `409` with `category_in_use`. UI surfaces the API message via toast + confirmation dialog.

## Query keys

- `['categories', 'list', params]`
- `['categories', 'detail', id]`

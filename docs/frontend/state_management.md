# State Management

Zustand stores in the renderer:

| Store | Contents | Persistence |
|---|---|---|
| `authStore` | `SessionView` (no JWTs), `ready` | Memory; synced via `auth:changed` IPC |
| `settingsStore` | locale (`ar`), UI scale | `localStorage` (non-secret) |
| `themeStore` | light/dark/system | `localStorage` |
| `notificationStore` | toast queue | Memory |
| `windowStore` | maximized hint | Memory |

## Rules

- Never put access or refresh tokens in Zustand.
- Permission checks use `session.permissions` (fail closed if empty).
- Server data belongs in TanStack Query; call `apiClient` from `queryFn`.

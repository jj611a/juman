# Authentication UI (Phase 4.0)

Renderer never holds JWTs. All auth goes through Electron Main IPC via `apiClient.auth`.

## IPC surface

| Method | Role |
|---|---|
| `login({ username, password, remember })` | Authenticate; remember controls CredentialStore persistence |
| `changePassword({ currentPassword, newPassword })` | Self-service / force-change |
| `getSession` / `onChanged` | Session restore + live updates |
| `logout` / `logoutAll` / `refresh` | Session lifecycle |

`SessionView` includes `mustChangePassword` (no tokens).

## Screens

| Route | Layout | Notes |
|---|---|---|
| `#/login` | `AuthLayout` | Username, password (show toggle), remember me, connection + versions |
| `#/force-password-change` | `AuthLayout` | Required when `mustChangePassword` |
| `#/` (shell) | `AppShell` | Behind `ProtectedRoute` |

## Behavior

- Bootstrap waits for `authStore.ready`
- Session expiry (`onChanged` → unauthenticated) toasts and navigates to `#/login`
- 403 UX: `#/forbidden`
- Offline: login panel + status bar
- Fail-closed permissions via `PermissionGuard` / `authStore`

## Showcase

`#/dev/auth` — visual states without exposing tokens.

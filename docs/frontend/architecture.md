# Frontend Architecture

Juman’s primary client is an **Electron** desktop app (ADR 0013) with a **React + TypeScript** renderer. The frontend foundation implements a strict process boundary:

| Layer | Responsibility |
|---|---|
| Electron Main | Window lifecycle, Axios HTTP, JWT session, credential store, native stubs |
| Preload | `contextIsolation` bridge → `window.juman` |
| Renderer | UI, Zustand, TanStack Query, i18n; **IPC only** |
| Shared | IPC channel names, DTOs, `AppError`, `SessionView` |

## Constitution rules

- Arabic RTL UI; English for source, JSON keys, permission keys, error codes.
- UI is **not** the authorization authority (`PermissionGate` is UX only).
- Backend remains system of record for authn/authz (Bearer JWT, RBAC).

## API transport

Renderer → typed SDK (`apiClient`) → preload → IPC → Main Axios → `http://127.0.0.1:8000/api/v1` (configurable via `JUMAN_API_BASE_URL`).

The renderer never knows the Base URL and never sets `Authorization` headers.

## Feature integration (future)

```text
src/features/<module>/
  api.ts      # SDK methods only
  routes.tsx
  pages/
```

Main registers matching IPC handlers. Do not add Axios to feature code.

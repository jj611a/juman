# Frontend V2 Architecture — Phase 9

## Decision

Phase 9 rebuilds `frontend/` as the sole product UI against frozen Nest V2. `frontend-legacy/` remains read-only.

## Stack

| Layer | Choice |
|-------|--------|
| Shell | Electron 35 + electron-vite |
| UI | React 19 + daisyUI 5 theme `juman` |
| Data | TanStack Query |
| Routing | React Router 7 |
| Contract | Nest camelCase DTOs via IPC `api.invoke` |
| Auth | Main `SessionManager` + `safeStorage` — renderer never holds JWT |

## Folder map (Phase 9.1+)

```
src/
  app/providers/          Session · Query · Toast · Dialog · Theme · Shortcuts
  app/ErrorBoundary.tsx
  router/                 AppRouter · RequireAuth · routes.ts
  navigation/             nav.config · permissions filter
  layouts/shell/          AppShell · Sidebar · TopBar · Workspace · StatusBar
  features/<domain>/      pages · hooks · api · dialogs (filled per 9.x)
  shared/components/      logo · feedback · dialogs · cards
  shared/constants/       routes · permissions · app
  services/api/           health (+ domain clients later)
  ipc/                    auth · api · window
  theme/globals.css       juman tokens + glass
```

## Security boundary

```
Renderer → preload (contextBridge) → IPC → SessionManager / Axios (Main) → Nest
```

Window chrome IPC (`window:minimize|maximize|close`) stays in Main — never exposes Node to renderer.

## Forbidden

- Nest contract changes from frontend work  
- Mock domain APIs / fabricated business data  
- `legacyBridge`, snake_case domain DTOs  
- Renderer-side Authorization headers  
- Copying legacy page components  

## Design system

- Theme id: `juman`  
- Primary: `#c6a75e`  
- Base: `#0a0a0b` … `#161618`  
- Font: IBM Plex Sans Arabic  
- RTL default · dark · glass utility where surfaces float  

## Phase 9.1 scope

Shell only: navigation, chrome, toasts, dialogs, skeletons, error boundary, health/session indicators, shortcuts foundation, placeholder feature routes. No operational CRUD.

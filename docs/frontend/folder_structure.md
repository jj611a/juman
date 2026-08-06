# Frontend Folder Structure — Phase 9

```
frontend/
  electron/                 Main · preload · shared IPC contracts
  src/
    app/                    Providers · ErrorBoundary
    router/                 Routes · auth guard
    navigation/             Nav config · permission filter
    layouts/shell/          AppShell · Sidebar · TopBar · StatusBar
    features/<domain>/      pages · hooks · api · dialogs (per 9.x)
    shared/
      components/           logo · feedback · dialogs · cards
      constants/            routes · permissions · app
      hooks/
      utils/
    services/api/           Nest DTO clients via IPC
    ipc/                    Renderer wrappers
    theme/                  daisyUI juman globals
  tests/unit/
  scripts/validate-architecture.mjs
```

`frontend-legacy/` is read-only compatibility history.

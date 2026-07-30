# Frontend Folder Structure

```text
frontend/
├── electron/
│   ├── main/          # Main process
│   ├── preload/       # contextBridge
│   └── shared/        # IPC contracts (safe for renderer types)
├── src/
│   ├── app/           # Providers, router, gates, error boundary
│   ├── features/      # Empty — business modules later
│   ├── components/ui/ # shadcn primitives
│   ├── layouts/
│   ├── routes/        # Foundation routes only
│   ├── services/      # Renderer ApiClient
│   ├── stores/        # Zustand
│   ├── hooks/
│   ├── i18n/
│   ├── styles/
│   └── types/
├── tests/
└── package.json
```

Root monorepo:

```text
juman/
├── backend/           # FastAPI (uv)
├── frontend/          # this package (@juman/frontend)
├── installer/         # reserved
├── docs/frontend/
├── package.json
└── pnpm-workspace.yaml
```

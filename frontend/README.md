# Juman Frontend (Electron)

Desktop client foundation for **جمان** — Electron + React + TypeScript.

## Requirements

- Node.js 20+
- pnpm 10+
- Backend running at `http://127.0.0.1:8787` (Nest Backend V2; required for login/health)

## Commands

From repo root:

```bash
pnpm install
pnpm --filter @juman/frontend dev
pnpm --filter @juman/frontend test
pnpm --filter @juman/frontend build
```

## Architecture (short)

- Renderer never imports Axios and never sees JWT strings.
- Electron Main owns HTTP (`JUMAN_API_BASE_URL`), access token (memory), refresh token (Electron `safeStorage`).
- Preload exposes `window.juman` only.

See `docs/frontend/` for full documentation.

# @juman/frontend (V2 rewrite)

Backend V2–native Electron + React client.

- **Contract:** NestJS camelCase DTOs only — no `legacyBridge`, no snake_case adapters.
- **Security:** Electron Main owns JWT / refresh; renderer never stores tokens.
- **UI:** daisyUI 5 + theme `juman` (gold `#c6a75e` on black).
- **Phase 1:** architecture, design system, application shell — feature modules require approval.

Legacy UI is frozen at `../frontend-legacy/` (read-only).

```bash
pnpm install
pnpm dev
```

Docs: `../docs/frontend/`

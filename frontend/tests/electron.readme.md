# Electron testing readiness

Foundation ships Vitest unit tests for renderer gates and Main error mapping.

Full Electron e2e (Spectron / Playwright Electron) is deferred. Suggested later:

```bash
pnpm --filter @juman/frontend exec playwright install
# add tests/e2e with _electron.launch({ args: ['.'] })
```

Dev smoke: `pnpm --filter @juman/frontend dev` with backend on `http://127.0.0.1:8000`.

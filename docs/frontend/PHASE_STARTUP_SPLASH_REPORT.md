# PHASE — STARTUP SPLASH + BACKEND-READY GATE REPORT

## Verdict
**PASS** — All quality gates green. Juman now shows a branded startup splash while the Main process waits for the real Nest backend on `127.0.0.1:8787`, and the renderer is **locked** until the backend reports healthy — eliminating the previous race where `SessionManager.bootstrap()` and renderer auth/session calls could hit a not-yet-ready backend.

---

## What was wrong
Before this phase:
- Main called `await session.bootstrap()` (→ `GET /auth/session`) immediately, before the backend was reachable.
- The renderer mounted `AppProviders`/`AppRouter` immediately; `SessionProvider` restored the session and the shell loaded without knowing whether Nest was actually up.
- Dev launcher (`start-dev.bat`) waits only 3s after starting Nest watch, which on a cold start can still be mid-build → session restore could silently fail or land on a network error.

## What was built

### 1. Shared contract — `electron/shared/startup.ts`
- `StartupState`: `booting | starting_backend | waiting_for_health | ready | failed | timeout`.
- `StartupStatus` (sanitized): `state`, `message`, `healthy`, `errorCode`, `attempt`, `startedAt`, `elapsedMs`.
- Arabic labels + `STARTUP_DATABASE_LABEL` + default timeout (`60s`) and poll interval (`1.5s`).
- **Security**: the renderer only ever sees this status surface — never the backend process object, env vars, paths, raw errors, or tokens.

### 2. Main authority — `electron/main/startup/StartupManager.ts` (pure, testable)
- Pure TypeScript, **no Electron imports** → unit-testable in Node.
- Injectable `probe`, clock (`now`), timeouts, `onReady` hook.
- State machine: `booting → starting_backend → waiting_for_health → ready | failed | timeout`.
- Probe classification against the real `/health`:
  - `status === 'ok'` **and** `database === 'connected'` → `ready`.
  - `status` string present but not fully healthy → `degraded` (keeps polling, message = "جاري التحقق من قاعدة البيانات...").
  - Network error / not reachable → `not_ready` (keeps polling).
  - HTTP response that is **not** Juman `/health` → `failed` with stable `errorCode: BACKEND_FOREIGN_SERVICE` (port occupied by a foreign service).
- Timeout only fires when the deadline (start of attempt + `timeoutMs`) passes → `timeout`.
- `retry()` performs a genuine new attempt (fresh deadline, `attempt++`).
- `onReady` hook is **awaited before READY is emitted** → `session.bootstrap()` runs against the now-healthy backend, then the renderer is unlocked. No restore race.
- Honest lifecycle: Electron does **not** spawn the Nest sidecar (production packaging does not bundle it; `start-dev.bat` starts Nest in its own window). The manager's `startBackend` hook is supported but unused by default, and `starting_backend` correctly reflects the "attempting to contact/start" phase. Splash therefore honestly reports: backend already running (quick `ready`), backend starting (waiting), backend unavailable (timeout), or port occupied by another program (`failed`).

### 3. IPC + preload
- Channels: `startup:getStatus`, `startup:changed` (push), `startup:retry`, `app:quit`.
- Handlers in `registerIpcHandlers(...)` (startup optional param).
- Preload exposes `window.juman.startup.{getStatus,retry,onChanged}` and `window.juman.app.quit`.

### 4. Main integration — `electron/main/index.ts`
- Window is created and loaded **first** (splash paints immediately).
- `StartupManager.start()` probes health; every state change is broadcast to all windows.
- `session.bootstrap()` is deferred into `onReady`, so it runs only after `ready` — the race is gone at the source.

### 5. Renderer feature — `src/features/startup/`
- `startup.types.ts` (shared-status re-export + hints).
- `hooks/useStartupStatus.ts` — subscribes to status pushes + initial snapshot.
- `components/StartupSplash.tsx` — branded splash (juman mark, gold `#c6a75e`), animated indeterminate gold progress line (respects `prefers-reduced-motion`), attempt/elapsed readout, and a terminal error card (retry + quit + expandable sanitized diagnostics).
- `components/StartupGate.tsx` — renders children only when `state === 'ready'`.
- `main.tsx` — sets `data-theme="juman"` before first paint (splash is themed before `ThemeProvider` mounts) and wraps `<AppProviders>`/`<AppRouter>` in `StartupGate`; no renderer code runs until the backend is ready.

## Verification

| Gate | Result |
|------|--------|
| `pnpm lint` | PASS |
| `pnpm test` | PASS (66 — added `startup.test.ts` + `startup-gate.test.tsx`) |
| `pnpm validate:arch` | PASS |
| `pnpm build` | PASS |

Tests added:
- `tests/unit/startup.test.ts` — 8 state-machine tests: happy path, already-up, degraded→db-check message→ready, foreign→failed, timeout, retry (new attempt + counter), `onReady` runs **before** READY, `dispose()` stops polling.
- `tests/unit/startup-gate.test.tsx` — 4 component tests: splash until READY then unlock, failure card with retry/quit/sanitized code, attempt counter, ready message render.

## Skills used
- **daisyui** (mandatory UI reference) — semantic colors (`bg-base-*`, `text-base-content`, `btn`, `rounded-box/field`) from the custom `juman` theme; no hardcoded theme colors in the splash.
- **fixing-accessibility** — `role="status"` + `aria-live="polite"` on status text, `autoFocus` on the retry action, `aria-hidden` on the decorative progress line, native `<button>`/`<summary>` elements, `prefers-reduced-motion` respected.
- **better-typography** (indirect) — Arabic copy consistent with app voice; splash keeps the app font.

## Notes / limitations
- Electron does **not** start the backend sidecar in this packaging. If a production installer later bundles Nest, hook it into `StartupManager`'s `startBackend` option so the splash can surface a genuine `failed` on process exit before health.
- Timeout is configurable at runtime via `JUMAN_STARTUP_TIMEOUT_MS` (default 60s).

# Backend V2 Decision Log

## ADR-V2-001 - Replace Python stack with Nest + Prisma + SQLite

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Desktop-first product; PostgreSQL and Alembic increase install friction.
- **Decision:** Backend V2 uses Node.js LTS, TypeScript, NestJS, Prisma, SQLite (`data/juman.db`).
- **Consequences:** Reimplement behavior; dual backends until parity; Electron still on Python until Phase 8.

## ADR-V2-002 - Rename `backend/` to `backend-python/`

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Clear separation of V1 spec vs V2 implementation.
- **Decision:** On branch `backend-v2`, rename source tree to `backend-python/`. Installer *runtime* folder name `%INSTDIR%\backend\` stays for V1 packaging until Phase 8.
- **Consequences:** Repo scripts that stage from source must use `backend-python`.

## ADR-V2-003 - Dev HTTP port 8787

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Avoid colliding with Python API on `:8000` during dual-run development.
- **Decision:** Nest listens on `8787` by default.
- **Consequences:** Electron must be retargeted in Phase 8.

## ADR-V2-004 - Health contract without `/api/v1`

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Foundation-only surface; V1 used `/api/v1/health`.
- **Decision:** V2 Phase 1 exposes `GET /health` with `{ status, version, database, uptime, environment }`.
- **Consequences:** Clients must adapt at integration time; versioned prefix can return later if needed.

## ADR-V2-005 - Long-lived branch `backend-v2`

- **Date:** 2026-08-01
- **Status:** Accepted
- **Decision:** All V2 work lands on `backend-v2`; do not modify `main` for V2 features until merge policy is defined.

## ADR-V2-006 - Phase 1.1 production foundation hardening

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Initial scaffold needed production logging, config/juman.env bootstrap, and fuller lifecycle handling.
- **Decision:** Winston + daily rotate JSON logs (application/errors/startup/requests); load/generate `config/juman.env`; global filter + process handlers; health returns `database: connected|disconnected` and `environment`.
- **Consequences:** Tests silence file transports under `VITEST=true`; Electron still on Python until Phase 8.

## ADR-V2-007 - Authentication foundation (Phase 2.1)

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Desktop-only Electron client; Python identity uses session-bound JWT + opaque refresh + Argon2id + RBAC.
- **Decision:** Reimplement auth cleanly in Nest with Prisma models (User/Role/Permission/Session/RefreshToken/LoginHistory/PasswordHistory); Argon2id; JWT `aud=juman-desktop`; opaque refresh with reuse detection; permissions from DB; `GET /api/v1/auth/me` returns permissions; seed full RBAC catalog.
- **Consequences:** No business modules yet; Electron path aliases deferred to Phase 8; intentional deviations documented in AuthenticationDesign.md.

## ADR-V2-008 - Authentication implementation (Phase 2.2)

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Phase 2.1 foundation needed a complete Electron-compatible auth surface.
- **Decision:** Ship `/auth/{login,logout,change-password,session,me}`; audit events LOGIN/LOGOUT/LOGIN_FAILED/PASSWORD_CHANGED/ACCOUNT_LOCKED; seed Administrator; keep refresh rotation behind session restore header for cold start.
- **Consequences:** Electron path mapping required in Phase 8; admin user/role HTTP CRUD deferred; coverage gates enforced via Vitest+SWC.

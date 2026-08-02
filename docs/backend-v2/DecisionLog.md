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

## ADR-V2-009 - Phase 2 architecture audit gate

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Auth/foundation code complete; entering business domain without audit would freeze defects.
- **Decision:** Mandatory Phase 2.3 audit produced `docs/backend-v2/AUDIT_PHASE_2.md` with overall **56/100 FAIL**. Phase 3 blocked until Must-fix items are remediated and re-audited. No features in audit commit.
- **Consequences:** Next work is hardening (2.4), not customers/inventory.

## ADR-V2-010 - Phase 2.4 release blocker remediation

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Phase 2.3 audit FAILED (56/100) with packaging and security Must-Fix items blocking Phase 3.
- **Decision:** Remediate only Must-Fix items: loopback bind + HOST, migrate-on-boot, timed lockout + unlock API, atomic refresh rotation, pinned deps, disable→revoke, dummy Argon2, expanded coverage, APP_GUARD/repo boundary cleanup, docs. Optional SQLite PRAGMAs included. No business modules.
- **Consequences:** Re-audit in `AUDIT_PHASE_2_RETEST.md`; Phase 3 still requires PASS gate.

## ADR-V2-011 - Shared business foundation (Phase 3.1)

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Domain modules must not duplicate cross-cutting logic; Phase 3 needs a stable substrate.
- **Decision:** Introduce shared primitives (`src/shared`) plus Settings/Audit/Media/Barcode modules with Prisma models `AppSetting`, `MediaFile`, `MediaReference`, `Barcode`, `SequenceCounter`, `AuditLog`. Money = integer fils (1000 = 1 IQD). Soft-delete = `deletedAt`. Audit writes only via `AuditService.record`. No domain HTTP for media/barcode/search yet.
- **Consequences:** Customers/inventory must import these services; coverage gate `pnpm test:cov:shared` enforces ≥95% on shared infra.
## ADR-V2-012 - Customer domain (Phase 3.2)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** First business module after shared foundation; Python V1 allows duplicate phones and has no restore/city.
- **Decision:** Implement Nest `CustomersModule` with Prisma `Customer` (soft delete, restore, city, status, normalized phones). Block duplicate **active** primary phones. Reuse shared Audit/Settings/SequenceCounter/phone/pagination. No CustomerAttachment/CustomerAudit/CustomerNote tables ? use shared media/audit and a notes column. Permissions remain singular `customer.*` (+ `customer.restore`). HTTP under `/customers` without `/api/v1`.
- **Consequences:** Categories/settings HTTP still pending; inventory blocked. Coverage gate `pnpm test:cov:customers` ?95%.

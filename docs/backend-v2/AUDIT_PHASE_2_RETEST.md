# Backend V2 — Phase 2.4 Re-Audit (Retest)

**Date:** 2026-08-01  
**Branch:** `backend-v2`  
**Compared against:** `docs/backend-v2/AUDIT_PHASE_2.md`  
**Mode:** Verification of Must-Fix remediation only — no business modules  
**Auditor stance:** Critical. Do not inflate scores.

---

## Overall score

| Metric | Phase 2.3 | Phase 2.4 |
|--------|----------:|----------:|
| **Overall** | **56 / 100 FAIL** | **77 / 100 PASS** |
| Architecture | 55 | 72 |
| Database | 52 | 78 |
| Security | 48 | 82 |
| Performance | 65 | 72 |
| Code Quality | 58 | 75 |
| Tests | 55 | 80 |

**Gate decision:** **PASS for Must-Fix clearance** — Phase 3 may proceed **only after explicit product approval**. Remaining Can-Wait debt is tracked below and must not be ignored.

Validation run: `pnpm lint`, `pnpm build`, `pnpm test` (74), `pnpm test:cov` (thresholds met).

---

## Must-Fix resolution matrix

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | Bind HTTP to `127.0.0.1` / `HOST`; accurate logs | **Resolved** | `AppConfig.host`, `main.ts` `listen(port, host)`, startup log uses `appConfig.host` |
| 2 | Prisma migrate on startup; abort on failure | **Resolved** | `runPendingMigrations` before Nest create; deploy + status verify; abort diagnostics |
| 3 | Timed lockout + unlock recovery | **Resolved** | Default 15 minutes; `POST /auth/admin/unlock`; README recovery (wait / API / SQLite) |
| 4 | Atomic refresh rotation (SQLite TX + CAS) | **Resolved** | `RefreshTokenService.rotate` transaction + `updateMany` CAS; expired ≠ reuse |
| 5 | Pin dependency versions (no `latest`) | **Resolved** | Exact pins in `package.json`; upgrade strategy in README |
| 6 | Disable account revokes sessions + refresh; JWT fails | **Resolved** | `UsersService.disableAccount` transactional revoke; regression test |
| 7 | Dummy Argon2 on unknown username | **Resolved** | `PasswordHasherService.verifyDummy` in login miss path |
| 8 | Expand coverage + regression tests | **Resolved** | Vitest include identity stack; branch floor 72%; concurrent refresh / disable / lockout / unlock / session / migrate tests |
| 9 | Docs consistency + README | **Resolved** | `backend-node/README.md`; Architecture/Security/Auth/ADR/Roadmap/Progress updated |
| 10 | APP_GUARD outside AuthModule; stop exporting repos | **Resolved** | Guards in `AppModule`; modules export services only; `@Public` in `core/` |

---

## Optional items

| Item | Status |
|------|--------|
| SQLite PRAGMAs (WAL, busy_timeout, foreign_keys) | **Resolved** |
| Seed fingerprint | **Deferred** |
| Auth repositories / PrismaClient compose | **Deferred** |
| Retention strategy | **Deferred** |

---

## Category notes (honest)

### Architecture — 72
Guards and repository exports fixed; Health no longer imports auth decorator. Dual persistence style (auth services → Prisma vs users repos) remains **TD-01** — acceptable for gate but must be standardized before many domain modules.

### Database — 78
Migrate-on-boot + PRAGMAs close packaging holes. Soft-delete / missing FKs / seed thrash remain.

### Security — 82
All Phase 2.3 security Must-Fixes addressed. Residual: bootstrap default password in source (forced change helps); `PasswordChangeGuard` absolute paths; Electron argon2 ABI still Phase 8.

### Performance — 72
WAL + busy_timeout help concurrency. Full RBAC rewrite every boot still noisy.

### Code Quality — 75
Pinned deps and README remove packaging landmines. One-off rewrite scripts and minor dead paths still present.

### Tests — 80
Coverage gate no longer auth-only theater; regression suite proves concurrent refresh, disable→401, unlock, migrate, session restore. Branch coverage ~73% on expanded include — honest, not 95% marketing.

---

## Technical debt still open

| ID | Debt | Priority |
|----|------|----------|
| TD-01 | Dual repository vs direct-Prisma styles | High before Phase 3 growth |
| TD-03 | Soft-delete / revoke / isActive triad | High |
| TD-04 | Seed thrash every boot | Medium |
| TD-08 | Argon2 native Electron ABI | High at Phase 8 |

---

## YOU ARE HERE

```
Phase 0  Architecture          DONE
Phase 1  Foundation            DONE
Phase 2  Identity & Security   2.4 REMEDIATED · RE-AUDIT PASS (77/100)
Phase 3  Core Business         WAITING EXPLICIT APPROVAL
```

**Next:** Approve Phase 3 scope. Do not implement customers/inventory/rentals/sales until approved.

---

*End of Phase 2.4 re-audit. No business modules were implemented in this phase.*
# Backend V2 — Phase 2 Full Architecture Audit

**Date:** 2026-08-01  
**Branch:** `backend-v2`  
**Scope:** Foundation + Authentication (Phases 0–2.2)  
**Mode:** Review only — **no features implemented in this phase**  
**Auditor stance:** Critical. Assume 10-year maintenance. Do not approve weak architecture because the project is early.

---

## Overall score

| Metric | Score |
|--------|------:|
| **Overall** | **56 / 100** |
| Architecture | 55 |
| Database | 52 |
| Security | 48 |
| Performance | 65 |
| Code Quality | 58 |
| Tests | 55 |

**Gate decision:** **FAIL — do not enter Phase 3** until **Must-fix** items are resolved (or explicitly waived with ADR).

Phase 2 delivered a recognizable Nest auth substrate, but several claimed security and packaging properties are incomplete or contradicted by the code. Freezing this as the ERP foundation would cement debt for a decade.

---

## Category scores

### Architecture — 55/100

**Strengths**
- Clear Nest feature folders (`auth`, `users`, `roles`, `permissions`, `security`, `config`, `database`, `health`).
- Controllers do not call Prisma directly.
- No Nest `forwardRef` circular modules today.
- Typed config pipeline + global validation pipe + exception filter exist.

**Weaknesses**
- Repository discipline already broken: auth “services” talk to `PrismaService` while users/roles use repositories (`CodingStandards.md` violated on day one of features).
- Global `APP_GUARD`s registered inside `AuthModule` (feature module mutates app-wide security).
- `PrismaModule` is `@Global` with `PrismaService extends PrismaClient` — god-client access pattern.
- Repositories exported from feature modules (callers can bypass services/invariants).
- `HealthController` imports `@Public` from `auth/` (cross-feature metadata coupling).
- Dual folder conventions (`auth/services|guards|strategies` vs flat `users/`).

**Layer / dependency graph (simplified)**

```
AppModule
  ConfigModule (global)
  LoggerModule
  PrismaModule (global)     ← everyone can inject Prisma
  PermissionsModule
  RolesModule → Permissions
  UsersModule → Security
  AuthModule → Security, Users, Roles + APP_GUARD×3
  HealthModule → Prisma; decorator import from auth
```

---

### Database — 52/100

**Strengths**
- Coherent auth schema (User/Role/Permission/Session/RefreshToken/LoginHistory/PasswordHistory).
- UUID PKs on domain tables; useful indexes on token hash / session expiry.
- Single SQLite migration exists (`20260801095418_auth_foundation`).
- SQLite choice remains correct for desktop-first ERP.

**Weaknesses**
- **No migrate-on-boot** — dirs + `juman.env` created; schema not applied. Electron fresh install will fail closed against empty DB.
- Integration tests use `prisma db push`, not `migrate deploy` — migrations are not what CI proves.
- Soft-delete fields largely theater (`User.deletedAt` filtered but rarely written; revoke uses `revokedAt`).
- Username `@unique` ignores soft-delete (rehire/recycle blocked).
- `RefreshToken.replacedById`, `LoginHistory.sessionId`, `User.createdBy/updatedBy` lack real FKs.
- Soft-delete on `RolePermission` composite PK is fragile.
- No SQLite PRAGMAs (`foreign_keys`, `WAL`, `busy_timeout`) on connect.
- No retention/purge for history/tokens; RESTRICT cascades make hard-delete painful.
- Missing operational indexes (`isActive`, `isLocked`, session revoke composites).

---

### Security — 48/100

**Strengths**
- Argon2id with configurable costs.
- Access JWT session-bound (`sid`); opaque refresh stored hashed; rotation + reuse intent documented.
- Generic login errors; forced password-change allowlist; RBAC permissions resolved from DB (not JWT).
- Electron Main ownership model documented; `/auth/me` returns permissions (fixes V1 `roles.view` trap).

**Weaknesses (must treat as product defects)**
1. **`app.listen(port)` binds all interfaces** while logs claim `127.0.0.1` (`main.ts`). Desktop JWT API must default to loopback.
2. **Default lockout duration = 0 → permanent lock** with **no unlock API** — seeded admin can brick the install.
3. **Refresh rotation is non-atomic** (issue then revoke; no CAS transaction) — race/crash can leave multiple live refresh tokens.
4. **Disable account does not revoke sessions/refresh** — live tokens until next principal resolve; enable/disable test only asserts `setActive`.
5. **Missing-user login skips Argon2** — contradicts SecurityDesign timing claim (enumeration oracle).
6. **Expired refresh treated as “reuse”** — over-revokes family; pollutes audit meaning.
7. Hardcoded bootstrap password `Juman!Bootstrap1` in source (forced change helps; production must refuse default).
8. `PasswordChangeGuard` matches absolute Express paths — will break under future `/api` prefix.

---

### Performance — 65/100

**Strengths**
- Adequate for single-store desktop workload.
- Winston file transports silenced under Vitest.
- Graceful shutdown hooks present.

**Weaknesses**
- Every authenticated request: session + user + role permissions DB round-trips (no cache; acceptable for now, watch Phase 3).
- RBAC seed/replace on **every** boot (soft-delete + upsert churn) — startup cost and DB noise.
- No WAL/busy_timeout for concurrent tooling + sidecar.
- Permission catalog is large; full Admin grant rewrites are heavy for boot.

---

### Code Quality — 58/100

**Strengths**
- Strict TypeScript; little/no intentional `any`.
- Centralized auth constants; validation DTOs with whitelist pipe.
- Structured logging channels.

**Weaknesses**
- Many Nest packages pinned as **`"latest"`** in `package.json` — unreproducible builds (unacceptable for 10-year product).
- `start` vs `start:prod` script inconsistency (`dist/main` vs `dist/main.js`).
- Dead/near-dead: unused `tsx`, unused `OpaqueTokenService.matches` in prod path, unused `findActiveByToken`, unreachable `deletedAt` login branch, unused `JWT_ALGORITHM`.
- Unsafe Prisma include casts (`as Promise<UserWithRole>`).
- `UsersService.createUser` throws raw `Error` (will become 500s under HTTP).
- One-off rewrite scripts under `scripts/write-phase22*.mjs` are process landmines.
- Doc drift: Architecture/Security still claim change-password “not in V2” in places.

---

### Tests — 55/100

**Strengths**
- Real Nest + SQLite integration suite for `/auth/*` happy paths, lockout events, logout invalidation.
- Unit coverage for hasher, JWT, guards, session TTL, refresh reuse unit cases.
- Auth coverage gate reports **~96.5% lines / 100% functions** on sliced `src/auth/**`.

**Weaknesses**
- Coverage `include` is **auth-only**; users/roles/permissions/security/bootstrap/config/packaging ungated.
- Branch threshold **75%** is too weak for auth logic.
- Bootstrap admin excluded from coverage while it creates production identity.
- Specs named `auth-coverage` smell like threshold padding.
- `users-enable-disable` does not assert session/token revocation.
- No concurrent refresh-rotation test; integration uses `db push` not migrate.
- Foundation tests exist but do not enforce packaging migrate path.

**Honest reading of “>95%”:** met only for a narrowed auth file set — **not** for the identity stack as a whole.

---

## Packaging / Electron compatibility

| Check | Status |
|-------|--------|
| Runtime folder creation (`data/logs/storage/config`) | OK |
| `config/juman.env` auto-generate | OK (incl. JWT secret) |
| SQLite path `data/juman.db` under `JUMAN_DATA_DIR` | OK by design |
| Schema migrate on first start | **FAIL** — missing |
| Loopback-only listen | **FAIL** — binds all interfaces |
| Argon2 native rebuild / Electron ABI story | **FAIL** — undocumented landmine |
| Installer NSIS path for Nest sidecar | Not started (Phase 8) |
| `start`/`start:prod` script correctness | Risky |
| Dependency reproducibility (`latest`) | **FAIL** |

**Installer risks:** first-run DB empty; LAN exposure if host not locked; argon2 `.node` mismatch bricks login; unpinned deps break CI/repro installs.

---

## Documentation review

| Doc | Status |
|-----|--------|
| Architecture.md | Exists; **drift** on change-password “not yet” |
| AuthenticationDesign.md | Current for 2.2 |
| SecurityDesign.md | Partially stale residuals |
| DecisionLog.md | ADR-001…008 present |
| DevelopmentRoadmap.md | Audit gate stated |
| FolderStructure.md | Thin vs real `auth/*` tree |
| MigrationStrategy.md | Strategy OK; missing migrate-on-boot / ban `db push` |
| CodingStandards.md | Exists; **not enforced** in auth persistence |
| Canvas | Exists; updated with this audit |
| **backend-node/README.md** | **MISSING** |
| Repo root README | Exists (product); not Nest-runbook |

---

## Git history (V2 commits)

Consistent prefixes on V2 work: `docs(v2)`, `feat(v2-foundation)`, `feat(v2-auth)`. Older packaging commits on ancestry use free-form messages (pre-policy). Acceptable.

---

## Strengths (keep)

1. Desktop-first stack choice (Nest + Prisma + SQLite) is strategically sound.
2. Auth model (session-bound JWT + opaque refresh + Argon2id + DB permissions) matches Electron ownership.
3. Foundation lifecycle (dirs, env, logging, validation, shutdown) is a good skeleton.
4. Integration tests prove the HTTP auth surface exists end-to-end.
5. RBAC permission catalog preserved from Python behavioral spec.

---

## Risks (if Phase 3 starts now)

1. Business modules will copy the wrong persistence pattern (service→Prisma).
2. Disable/lock/admin operations will ship without session revocation semantics.
3. Packaged desktop builds will fail first-run without migrate-on-boot.
4. Floating `latest` deps will make regressions unbisectable.
5. Security assumptions in docs will diverge further from code under feature pressure.

---

## Technical debt register

| ID | Debt | Cost if deferred |
|----|------|------------------|
| TD-01 | Dual repository vs direct-Prisma styles | High |
| TD-02 | Global guards inside AuthModule | Medium→High |
| TD-03 | Soft-delete / revoke / isActive triad | High |
| TD-04 | Seed thrash every boot | Medium |
| TD-05 | Unpinned dependencies | High |
| TD-06 | Coverage scope gaming | Medium |
| TD-07 | Missing backend-node README / runbook | Medium |
| TD-08 | Argon2 native packaging | High at Phase 8 |

---

## Must-fix (before Phase 3)

1. **Bind HTTP to `127.0.0.1` by default** (configurable `HOST`); fix log to match reality.
2. **Apply Prisma migrations on startup** (deterministic `migrate deploy` after dirs/env).
3. **Fix lockout defaults** — timed lock by default; unlock path or admin recovery; never permanent-by-default without unlock.
4. **Atomic refresh rotation** in a SQLite transaction with compare-and-swap on `revokedAt`.
5. **Pin dependency versions** (remove `"latest"` from `package.json`).
6. **Disable/soft-delete must revoke all sessions + refresh** in one transactional use-case; test it.
7. **Dummy Argon2 verify on unknown username** (align code with SecurityDesign).
8. **Expand coverage gate** to identity stack (`users`/`roles`/`permissions`/`security`/`bootstrap`) and raise branch floor; add refresh concurrency + disable→401 tests.
9. **Add `backend-node/README.md`** and fix Architecture/Security doc drift.
10. **Move APP_GUARDs to AppModule / security shell**; stop exporting repositories.

---

## Can-wait (track, do not ignore)

- Compose PrismaClient instead of extends (refactor port).
- Auth repositories for session/refresh/history.
- SQLite WAL + busy_timeout + foreign_keys PRAGMAs.
- Seed fingerprint in `AppMeta` to skip rewrite.
- Retention jobs for login_history / expired tokens.
- Path-prefix-safe password-change allowlist (route metadata).
- Delete one-off `scripts/write-phase22*.mjs`.
- Standardize folder layout before many domain modules.
- Electron argon2 rebuild docs (required by Phase 8, plan now).

---

## Recommended fix order (suggested Phase 2.4 hardening)

1. Listen host + migrate-on-boot (packaging blockers)  
2. Lockout/unlock + disable→revoke (security blockers)  
3. Atomic refresh rotation + timing-safe login  
4. Pin deps + README + doc drift  
5. Guard registration + repository boundary cleanup  
6. Coverage gate expansion  

**Then** re-audit (Phase 2.5) before any customer/inventory module.

---

## YOU ARE HERE

```
Phase 0  Architecture          DONE
Phase 1  Foundation            DONE
Phase 2  Identity & Security   CODE COMPLETE · AUDIT FAIL (56/100)
Phase 3  Core Business         BLOCKED
```

**Next:** Approve Must-fix remediation plan → implement hardening → re-audit → only then Phase 3.

---

## Appendix — commits reviewed

- `cfbe226` docs(v2): architecture docs and backend-python rename  
- `fc9491b` / `d481f51` feat(v2-foundation)…  
- `e5ae2a0` feat(v2-auth): authentication foundation  
- `c595331` feat(v2-auth): implement authentication and RBAC  

---

*End of Phase 2 audit. No business modules were implemented in this phase.*

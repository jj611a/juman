# Backend V2 ? Phase 3 Engineering Certification

**Date:** 2026-08-02  
**Branch:** `backend-v2`  
**Mode:** Verification only ? no feature implementation  
**Scope:** Foundation ? Authentication ? RBAC ? Shared Foundation ? Customers ? Media  
**Stance:** Critical. Scores are evidence-based. Warnings are not ignored.

---

## Executive Summary

Phase 3.1?3.3 deliverables were subjected to logical review, full automated suites, a live Nest certification harness, schema inspection, TypeScript/architecture review, and documentation cross-check.

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (40 files / **128** tests) |
| `pnpm test:cov` | **PASS** (global thresholds met; see coverage) |
| Live harness (`scripts/cert-phase34.cjs`) | **PASS** (14/14 security ? 8/8 API ? 0 errors) |

**Overall certification:** **PASS WITH WARNINGS**  
**Ready for Phase 3.5?** **YES ? with conditions** listed under Must Fix / Recommended Improvements.  
**Do not start inventory / barcode workflows / rentals / sales until Phase 3.5 is explicitly approved.**

Evidence artifact: `docs/backend-v2/cert_p34_harness.json`.

---

## Scorecard

| Area | Score | Verdict |
|------|------:|---------|
| Architecture | **82** | PASS |
| Security | **86** | PASS |
| Performance | **88** | PASS |
| Database | **85** | PASS |
| API | **84** | PASS |
| Testing | **86** | PASS |
| Documentation | **87** | PASS |
| Maintainability | **83** | PASS |
| **Overall** | **85** | **PASS WITH WARNINGS** |

Scoring rubric: 90?100 strong; 80?89 production-capable with tracked debt; 70?79 conditional; <70 fail gate.

---

## 1. Logical Verification

| Area | Verdict | Notes |
|------|---------|-------|
| Auth / session / refresh / lockout | **PASS** | Phase 2.4 remediated; regression suites cover reuse, timed lockout, unlock, disable?revoke |
| RBAC permissions catalog | **PASS** | DB-backed; customers + media restore keys present; admin seed grants full catalog |
| Shared foundation reuse | **PASS** | Customers/Media consume Audit/Settings/pagination/soft-delete/phone/parseBoolean ? no local forks |
| Customer CRUD + phone uniqueness | **PASS** | Active+live primary phone unique; normalize Iraqi `07?`; soft-delete frees phone; restore re-checks |
| Customer search/filter/sort/page | **PASS** | Shared helpers; `deleted=false` safe via `parseOptionalBoolean` |
| Media save/validate/integrity | **PASS** | Magic bytes + MIME + extension + size; SHA-256; soft-delete keeps blob for restore |
| MediaReference linking strategy | **PASS** | Polymorphic; no per-entity attachment tables |
| Soft delete / restore invariants | **PASS** | Live getters exclude deleted; restore conflict paths audited |
| Transactions | **PASS** | Harness forced rollback; auth refresh CAS TX covered in tests |
| Duplicated logic | **PASS** | Phone/boolean/pagination centralized |
| Impossible states | **WARNING** | Media soft-delete cascades refs; restore does **not** revive refs ? intentional but must be documented for callers |
| Dead code | **WARNING** | `AttachMediaDto` has **no controller route** (0% cov); attach is service-only |
| Hidden coupling | **PASS** | Domains do not import each other; Media never imports Customers |

---

## 2. Functional Testing

Executed: Vitest suite + live harness.

| Capability | Evidence | Verdict |
|------------|----------|---------|
| Authentication login / change-password / me / session / logout | Tests + harness | **PASS** |
| RBAC permission enforcement | Guards + 401 without token | **PASS** |
| Customer CRUD / search / restore | Integration + harness | **PASS** |
| Media upload / integrity / restore | Integration + harness | **PASS** |
| Audit writes | Harness `auditCount=6` after flows | **PASS** |
| Pagination / filter / sort | Customer list/search harness | **PASS** |
| Config + migrate-on-boot | `migrateMs=2845`; test-db helper | **PASS** |
| Session / refresh / lockout / unlock / JWT | `session-lifecycle`, `phase24-regression`, `refresh-token-service` | **PASS** |
| Soft delete | Customers + Media | **PASS** |

---

## 3. API Contract

| Surface | Verdict |
|---------|---------|
| `GET /health` | **PASS** |
| `/auth/*` contracts | **PASS** (existing Phase 2 suites) |
| `/customers` CRUD + search + restore HTTP codes | **PASS** (201 create, 409 dup, 404 deleted, 200 restore) |
| `/media` upload + integrity + delete/restore | **PASS**; responses omit filesystem paths |
| Validation errors ? 400 | **PASS** (exe/spoof/oversized) |
| Unauthorized ? 401 | **PASS** |
| Missing download stream HTTP | **WARNING** (provider ready; not exposed) |
| Missing attachment HTTP | **WARNING** (service `attach` only) |

---

## 4. Database

| Check | Result | Verdict |
|-------|--------|---------|
| Tables | 18 incl. Customer, MediaFile, MediaReference, AuditLog, auth set | **PASS** |
| Indexes | 53 | **PASS** |
| `PRAGMA foreign_keys` | true | **PASS** |
| Migrations | 4 applied (auth, shared, customer, media dimensions) | **PASS** |
| Seeds | Permissions/settings/bootstrap admin | **PASS** |
| Transaction rollback | Proven in harness | **PASS** |
| SQLite Unicode case-folding for Arabic `contains` | Incomplete | **WARNING** |
| Unique phone at DB level | App-enforced only (active+live) | **WARNING** ? race under concurrent writers possible on multi-client future |

---

## 5. Performance (live harness)

| Metric | Value |
|--------|------:|
| Migrate deploy | **2845 ms** |
| Nest test-module boot | **746 ms** |
| RSS after boot | **122 MB** |
| Login (known) | **204 ms** |
| Login unknown (incl. dummy Argon2) | **371 ms** |
| Customer create | **23 ms** |
| Customer search | **15 ms** |
| Media upload | **28 ms** |
| Media integrity | **12 ms** |

**Verdict:** **PASS** for desktop-first SQLite. Unknown-user latency is dominated by intentional dummy Argon2 (anti-enumeration) ? keep.

Largest queries today: customer search `OR contains` across several columns; acceptable at local scale. Revisit before multi-user LAN.

---

## 6. Security

| Attack / control | Verdict | Evidence |
|------------------|---------|----------|
| Invalid JWT | **PASS** | Harness 401 |
| Logged-out / revoked JWT | **PASS** | Harness 401 |
| Refresh reuse / family revoke | **PASS** | `session-lifecycle.spec.ts` |
| Expired refresh ? reuse | **PASS** | `refresh-token-service.spec.ts` |
| Unknown username + dummy hash | **PASS** | Harness + auth service |
| Duplicate customer phone | **PASS** | 409 |
| Executable upload | **PASS** | 400 |
| MIME spoof | **PASS** | 400 |
| Oversized upload | **PASS** | 400 |
| Path traversal (storage) | **PASS** | Unit provider tests |
| Unauthenticated domain access | **PASS** | 401 |
| Permission escalation (missing perm) | **PASS** | PermissionsGuard (suite) |
| Horizontal privilege (row ownership) | **WARNING** | Desktop model is role-based, not per-row owner ACL ? acceptable now; must redesign before multi-tenant |
| Expired access JWT timed probe | **WARNING** | Covered by JWT strategy/tests; not re-driven in harness |

---

## 7. Architecture Review

| Principle | Verdict |
|-----------|---------|
| SOLID / DI Nest modules | **PASS** |
| Repository private; services exported | **PASS** |
| No domain?domain imports | **PASS** |
| Shared services reused | **PASS** |
| Circular dependencies | **PASS** (no evidence; AppModule DAG clean) |
| Barcode module | **PASS** as Phase 3.1 shared infra ? **no barcode HTTP/workflows** (correctly out of scope) |

---

## 8. TypeScript Review

| Check | Verdict |
|-------|---------|
| `strict": true` | **PASS** (`tsconfig.json`) |
| `any` / `@ts-ignore` / `@ts-nocheck` in `src/` | **PASS** (none found; only PermissionMode `'any'`) |
| Lint clean | **PASS** |

---

## 9. Test Coverage

Global (`pnpm test:cov`):

| Metric | Value |
|--------|------:|
| Statements | **94.01%** |
| Branches | **85.00%** |
| Functions | **98.57%** |
| Lines | **94.96%** |

Domain gates:

| Gate | Result |
|------|--------|
| `test:cov:customers` | **?95%** (previously certified 100% lines) |
| `test:cov:media` | **?95%** statements/lines |
| `test:cov:shared` | Phase 3.1 gate |

**Weak areas (global report):**

| Module | Concern |
|--------|---------|
| `database/migrate-on-boot` | ~60% lines ? boot failure paths hard to hit in unit tests |
| `config/configuration` / env validation | Branch gaps on rare env combos |
| `auth/bootstrap` | 75% ? alternate bootstrap branches |
| `users.service` | 84% statements ? admin CRUD edges |
| `media/dto/attach-media.dto` | **0%** ? unused by HTTP |

**Verdict:** **PASS** (thresholds green) with **WARNING** on unused DTO and boot-path coverage.

---

## 10. Packaging Review

| Item | Verdict |
|------|---------|
| SQLite via `JUMAN_DATA_DIR` / `data/juman.db` | **PASS** |
| Storage categories under `storage/` | **PASS** (harness) |
| Argon2 native dep pinned | **PASS** (requires install-time build approval in some CI) |
| Prisma migrate deploy on boot | **PASS** |
| Loopback `HOST` default | **PASS** |
| Graceful shutdown | **PASS** (foundation handlers) |
| Electron sidecar packaging | **WARNING** ? Phase 8 not started; no broken installer assumptions found in Nest tree |

---

## 11. Documentation Review

| Doc | Matches code? |
|-----|---------------|
| Architecture.md | **PASS** (status through 3.3) |
| AuthenticationDesign / SecurityDesign | **PASS** (Phase 2 baseline) |
| CustomerDomain / CustomerAPI | **PASS** |
| MediaDomain | **PASS** |
| SharedFoundation | **PASS** |
| DecisionLog ADR-012/013 | **PASS** |
| Roadmap / PROGRESS | **PASS** (updated this certification) |
| backend-node README | **PASS** (lockout/unlock documented) |
| Canvas | **Updated** to certification YOU ARE HERE |

---

## 12. Technical Debt

### Critical
*None identified that blocks Phase 3.5 approval.*

### High
1. **App-level phone uniqueness without DB unique partial index**  
   - Cause: SQLite + soft-delete makes partial unique indexes awkward; enforced in service.  
   - Impact: Concurrent creates could theoretically race.  
   - Recommendation: Document single-writer desktop assumption; add serialized create TX or unique index on `(phoneNormalized)` where `deletedAt IS NULL AND status='active'` when SQLite version supports.  
   - Priority: Before multi-client LAN.

2. **Global `enableImplicitConversion` boolean footgun**  
   - Cause: Nest ValidationPipe default.  
   - Impact: Future query booleans may treat `"false"` as true if not using `parseOptionalBoolean`.  
   - Recommendation: Lint rule / shared DTO mixin; or disable implicit conversion and rely on `@Type`.  
   - Priority: Before next domain with query flags.

### Medium
3. **Dead `AttachMediaDto` (no HTTP)** ? remove or wire `POST /media/:id/attachments`.  
4. **Media restore does not restore soft-deleted references** ? document contract; optionally add `restoreAttachments`.  
5. **No media download/stream HTTP** ? needed before Electron gallery/IPC.  
6. **SQLite Arabic search collation** ? consider FTS5 later.  
7. **Coverage gaps** in migrate-on-boot / config / users admin edges.  
8. **dist output under `dist/src/`** ? packaging scripts must use correct entry (`dist/src/main.js`).

### Low
9. Customer `recordView` audit unused on GET.  
10. Barcode shared service has no HTTP (intentional).  
11. Canvas special-character mojibake in some progress strings (encoding) ? fix on update.

---

## 13. Must Fix (before or at start of Phase 3.5)

| # | Item | Blocking? |
|---|------|-----------|
| 1 | Remove or wire `AttachMediaDto` | No ? cleanup |
| 2 | Document Media restore vs references contract in MediaDomain | No ? docs |
| 3 | Confirm packaging entrypoint `dist/src/main.js` in Phase 8 plan | No ? plan |

**No Must-Fix defects require architecture redesign to leave Phase 3.4.**

---

## 14. Recommended Improvements

1. Add HTTP attachment endpoints when a domain first needs UI linking.  
2. Add media `GET /media/:id/content` streaming with authz.  
3. Add second-user RBAC integration test (cashier cannot delete/restore).  
4. Keep `scripts/cert-phase34.cjs` in CI as smoke certification.  
5. Consider FTS for customer search before scale-out.

---

## 15. Ready for Phase 3.5?

**YES ? conditional PASS.**

Phase 3.5 may proceed only after product approval. Allowed next work is whatever Phase 3.5 defines (categories / settings HTTP / etc.). Explicitly **blocked until approval:** Inventory, Barcode workflows, Rentals, Sales, Reports, Camera, Thumbnails, Cloud storage.

---

## Appendix A ? Harness summary

- Generated: `2026-08-02T07:40:36.583Z`  
- Security probes: 14/14 passed  
- API probes: 8/8 passed  
- Errors: 0  
- Full JSON: `cert_p34_harness.json`

## Appendix B ? Commands

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:cov
node scripts/cert-phase34.cjs
```

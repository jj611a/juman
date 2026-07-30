# Feature Reconciliation Report

**Product:** Juman (Arabic RTL dress rental & sales desktop ERP)
**Audit date:** 2026-07-30
**Method:** Read-only reconciliation against roadmap, decisions, changelog, backend APIs, Alembic, frontend routes, Electron IPC, tests, and docs.
**Constraint:** No new requirements invented; uncertain items marked UNKNOWN. No code was modified.

**Authoritative sources used (in order):**

1. `docs/JUMAN_MASTER_ROADMAP.md`
2. `docs/JUMAN_DECISIONS.md`
3. `docs/JUMAN_CHANGELOG.md`
4. Product ADRs / module docs under `docs/` and `frontend/docs/`
5. Backend routers (`backend/app/api/v1/router.py`, modules)
6. Alembic HEAD `20260802_0033_system_backups_duration`
7. Frontend routes (`frontend/src/app/router.tsx`, feature `routes.tsx`)
8. Electron IPC (`frontend/electron/shared/channels.ts`, preload, hardware)
9. Backend services / RBAC defaults
10. Frontend unit tests under `frontend/tests/unit/`

---

# Executive Summary

| Field | Assessment |
|---|---|
| **Overall Completion %** | **~82%** product-usable surface (roadmap claims ~95%; that figure overstates installer deliverability and treats residual stubs as complete) |
| **Overall Risk** | **High** for production store install; **Medium** for LAN-dev operation of business modules |
| **Release Readiness** | **NOT READY** for Release Candidate |

**Headline findings**

1. Core business modules (Categories through Admin/Audit/System) largely exist with routes, nav, IPC API proxy, and unit tests.
2. **Ops Dashboard on shell is MISSING** ? home is still `FoundationHomePage` (health JSON). Reports already has `/reports/dashboard` against `GET /reports/dashboard`, but roadmap YOU ARE HERE remains Dashboard.
3. **Hardware adapters exist** with intentional residuals (network ESC/POS send stub).
4. **Installer is scaffolding, not a verified shippable artifact** ? no frozen `juman-api.exe` in repo, no WinSW/PG binaries, NSIS does not create DB/role or run Alembic migrations, first-run does not persist company/admin/storage into `config/juman.env`.
5. Documented intentional placeholders remain: TopBar search/command/notifications, company switcher, report/audit export, cloud updates, desktop FS stub, unlock UI (no HTTP route), Notifications/POS (backend absent).

---

# Module Matrix

| Module | Status | Completion | Notes |
|---|---|---|---|
| Authentication | COMPLETE | ~95% | Login, force-password, session via Main IPC; no JWT in renderer (verified by search). Profile `/me` PATCH not exposed in apiClient. |
| Application Shell | PARTIAL | ~85% | Chrome/nav/shortcuts/status present; TopBar search/command/notifications + company switcher + user profile are disabled stubs (documented). |
| Dashboard (Ops home) | MISSING | ~10% | Roadmap not started; `FoundationHomePage` is not ops dashboard. Reports dashboard page exists separately. |
| Categories | COMPLETE | ~95% | List/CRUD routes + nav + perms + unit test. |
| Customers | COMPLETE | ~95% | List/detail + media/camera; unit test. |
| Inventory | COMPLETE | ~95% | List/create/edit/detail + photos/barcode/status; unit test. |
| Calendar | PARTIAL | ~85% | Dress-centric UI; stale drawer copy claims reservations/rentals not built; `availability/next` not in apiClient. |
| Reservations | COMPLETE | ~90% | List/new/detail/edit + convert path per decisions; unit test. |
| Rentals | PARTIAL | ~88% | Checkout/list/detail; `POST /rentals/{id}/cancel` not in apiClient. |
| Returns | COMPLETE | ~90% | Create/list/detail per Returns API v1 decisions; unit test. |
| Processing (Inspection + Batches) | COMPLETE | ~90% | Hub + inspections + batches; unit tests for mutations. |
| Sales | COMPLETE | ~90% | List/new/detail; unit test. |
| Rental Financial Settlements | COMPLETE | ~90% | List/new/detail/collect; unit tests. |
| Reports | PARTIAL | ~80% | All report routes + charts; export/print placeholders; saved filters noop. |
| Users | PARTIAL | ~85% | CRUD UI; unlock intentionally absent (perm only, no route). |
| Roles | COMPLETE | ~90% | Matrix assign/remove; unit test. |
| Permissions | COMPLETE | ~90% | Via roles UI + `apiClient.permissions`; no standalone permissions page (N/A). |
| Settings | COMPLETE | ~90% | Category settings UI; station hardware stored in userData by design. |
| Audit | PARTIAL | ~85% | List/detail; export placeholder. |
| Maintenance | COMPLETE | ~90% | Under `/system` maintenance. |
| Backup | COMPLETE | ~90% | System backups UI + API. |
| Restore | COMPLETE | ~90% | System restore UI + API. |
| Health | COMPLETE | ~95% | `system.health` + home health display. |
| System | COMPLETE | ~90% | Status/backups/restore/maintenance routes. |
| Hardware | PARTIAL | ~85% | USB ESC/POS, HID scan, drawer, camera, settings page; network print NOT_IMPLEMENTED; no hardware page unit test. |
| Installer | PARTIAL | ~55% | Specs/NSIS/docs/first-run/offline gate exist; binaries absent; DB bootstrap/migrate not in NSIS; not production-verified. |
| Notifications | MISSING | 0% | Roadmap deferred; perms seeded only. |
| POS / general Payments | MISSING | 0% | Roadmap later; `payment.*` perms without module. |

Status values: COMPLETE | PARTIAL | PLACEHOLDER | MISSING | BLOCKED BY BACKEND | NOT APPLICABLE

---

# Missing Features

## Dashboard

### Ops Dashboard on Application Shell

- **Description:** Roadmap Phase 5 Dashboard ? Ops Dashboard UI on shell + IPC.
- **Expected behavior:** Authenticated home shows operational KPIs/queues from backend (at minimum consume `GET /reports/dashboard` or dedicated ops home).
- **Current behavior:** `/` renders `FoundationHomePage` ? logo, session line, raw health JSON.
- **Source document:** `docs/JUMAN_MASTER_ROADMAP.md` (YOU ARE HERE); `docs/JUMAN_DECISIONS.md` (Ops Dashboard deferred after Admin/System).
- **Priority:** Critical
- **Estimated effort:** M

## Notifications

### Notifications module UI + backend

- **Description:** Backend residual + FE Phase 5 Notifications UI.
- **Expected behavior:** In-app notifications when backend module exists.
- **Current behavior:** TopBar notifications button disabled; perms `notifications.view|manage` seeded; no API module.
- **Source document:** Roadmap Backend residual; Phase 5 checklist.
- **Priority:** Medium (explicitly deferred)
- **Estimated effort:** XL (backend + FE)

## Users

### Account unlock UI

- **Description:** Unlock locked users.
- **Expected behavior:** Admin unlock action when API exists.
- **Current behavior:** No UI; decision forbids inventing UI because HTTP route missing.
- **Source document:** `JUMAN_DECISIONS.md` ? No account unlock UI.
- **Priority:** Medium
- **Estimated effort:** S after backend route (currently BLOCKED BY BACKEND)

## Shell

### Global search / command palette / multi-company / user profile page

- **Description:** TopBar and company switcher affordances.
- **Expected behavior:** UNKNOWN beyond stubs ? roadmap marks shell complete with stub chrome documented in Visual QA.
- **Current behavior:** Disabled placeholders.
- **Source document:** Visual QA / shell decisions; `frontend/docs/application-shell.md`.
- **Priority:** Low (documented incomplete chrome)
- **Estimated effort:** L (needs product APIs)

## Installer

### Create database role + run migrations during install

- **Description:** Phase 6.2 NSIS steps: create DB `juman` + role, then migrate.
- **Expected behavior:** Fresh PC ends with migrated schema and bootstrap admin.
- **Current behavior:** NSIS writes `juman.env` and may silent-install PG if vendor exe present; **no** CREATE DATABASE / role / `alembic upgrade` in `deployment/nsis/juman-installer.nsh`.
- **Source document:** Phase 6.2 plan; `deployment/nsis/juman-installer.nsh`.
- **Priority:** Critical
- **Estimated effort:** M

### First-run persistence of company / storage / admin into config

- **Description:** Wizard should configure company, storage paths, admin (via bootstrap env or API).
- **Expected behavior:** Values written via Main IPC to `config/juman.env` and/or settings API.
- **Current behavior:** Wizard collects fields; `finish()` only sets `firstrun.done`.
- **Source document:** Phase 6.2 First-run wizard; `FirstRunWizard.tsx`.
- **Priority:** High
- **Estimated effort:** M

### Shippable installer binaries in release pipeline

- **Description:** Frozen API + WinSW + PG vendor + electron-builder output.
- **Expected behavior:** `pnpm dist:win` produces installable Setup with resources present.
- **Current behavior:** `deployment/dist/backend/` empty; WinSW and PG not in repo (fetch scripts/docs only).
- **Source document:** `frontend/docs/installer.md`, `deployment/INSTALLATION_GUIDE.md`.
- **Priority:** Critical
- **Estimated effort:** L

## Calendar

### Deep-link from calendar blocks to reservation/rental/processing

- **Description:** Block detail should navigate to built modules.
- **Expected behavior:** Links to existing reservation/rental/processing routes.
- **Current behavior:** Drawer text claims modules not built yet (stale).
- **Source document:** `BlockDetailDrawer.tsx`; calendar module docs.
- **Priority:** Medium
- **Estimated effort:** S

## Rentals

### Cancel rental from UI

- **Description:** Backend `POST /rentals/{id}/cancel` exists.
- **Expected behavior:** Cancel action when permitted.
- **Current behavior:** No matching apiClient cancel method found in client surface audit.
- **Source document:** Backend rentals API; frontend apiClient gap.
- **Priority:** Medium
- **Estimated effort:** S

## Reports / Audit

### Export

- **Description:** Export buttons for reports and audit.
- **Expected behavior:** Export when API exists; until then disabled.
- **Current behavior:** Disabled placeholders ? matches decision Export/print placeholders only / No export API.
- **Source document:** Decisions; `ReportChrome.tsx`; `AuditListPage.tsx`.
- **Priority:** Low (intentional)
- **Estimated effort:** M after backend export

---

# Placeholder Features

| Placeholder | Location | Signal |
|---|---|---|
| Network ESC/POS send | `electron/main/hardware/printers/network.ts` | `NETWORK_PRINT_NOT_IMPLEMENTED` |
| Network transport UI | `HardwarePage.tsx` | Network soon label |
| Cloud auto-update | `hardware/register.ts` checkUpdates | `NOT_IMPLEMENTED` |
| Desktop FS | `desktop/stubs.ts` | `fsStub` -> NOT_IMPLEMENTED |
| Report export | `ReportChrome.tsx` | Disabled placeholder |
| Report print | `ReportChrome.tsx` | `onClick={() => undefined}` |
| Saved report filters | `savedFilters.ts` | v1 noop |
| Audit export | `AuditListPage.tsx` | Disabled placeholder |
| TopBar search / command / notifications | `top-bar.tsx` / AppShell | Disabled placeholders |
| Company switcher | `company-switcher.tsx` | Future-ready stub |
| User profile menu item | `user-menu.tsx` | Disabled placeholder |
| DataTable virtualization | `data-table.tsx` | Architecture-ready only |
| Cloud media providers | `backend/.../media/providers/stubs.py` | NotImplementedError |
| Update channel JSON | `deployment/runtime/update-channel.json` | `implemented: false` |
| First-run field persistence | `FirstRunWizard.tsx` | Collect-only until completeFirstRun |
| Calendar stale not-built message | `BlockDetailDrawer.tsx` | Misleading placeholder copy |

---

# Backend Blockers

| Feature | Blocker | Evidence |
|---|---|---|
| Notifications UI | No notifications module/routes | Roadmap residual; RBAC keys only |
| Account unlock UI | No HTTP unlock route | Decision + RBAC `users.unlock` only |
| Report/Audit export | No export API in v1 | Decisions |
| Multi-company switcher | No multi-company API | Company switcher comment |
| POS / standalone payments UI | No POS module | Roadmap POS later; `payment.*` perms orphaned |
| Cloud object storage | Providers stubbed | `media/providers/stubs.py` |

---

# UI Blockers

| Item | Notes |
|---|---|
| Ops Dashboard home | No shell dashboard UI; only foundation health page |
| Report print | Button present but noop |
| Shell secondary chrome | Search/command/notifications/profile intentionally disabled |
| Calendar deep-links | Stale messaging; links not wired |

---

# IPC Blockers

| Item | Notes |
|---|---|
| Desktop FS operations | Channel still stub (`DESKTOP_FS_STUB`) |
| Cloud updates check | Returns NOT_IMPLEMENTED (intentional) |
| Network print send | Fails with `NETWORK_PRINT_NOT_IMPLEMENTED` |
| Sessions /me management | No dedicated IPC domain methods; auth session view only |

**Non-blockers (working):** `API_INVOKE`, auth.*, system health/version, app.getConfig, desktop dialogs/window, hardware.*, app first-run, updates check (stub result).

**Security check:** Renderer has no Axios/JWT usage found under `frontend/src` (grep). HTTP remains in Main.

---

# Hardware Blockers

| Item | Severity | Notes |
|---|---|---|
| Network ESC/POS live send | Medium | Typed future-ready; USB path implemented |
| Physical device CI | Low | Unit tests cover builders/detector only; no USB E2E in CI |
| Hardware settings page tests | Low | No dedicated HardwarePage unit test |
| Arabic ESC/POS text fidelity | UNKNOWN | UTF-8 bytes sent; cheap thermal printers may not render Arabic ? not specified beyond ESC/POS support |

---

# Installer Blockers

| Item | Severity | Notes |
|---|---|---|
| No frozen `juman-api.exe` in `deployment/dist/backend/` | Critical | Build step documented, artifact absent |
| WinSW binary not vendored | Critical | README only |
| PostgreSQL official installer not vendored | Critical | fetch script only; NSIS skips if missing |
| NSIS omits DB create / role / Alembic migrate | Critical | Gap vs Phase 6.2 plan |
| First-run does not write config | High | Flag file only |
| Default passwords in NSIS macros | High | Hardcoded defaults ? must be rotated; risk if shipped as-is |
| Repair mode incomplete | Medium | Docs describe repair; NSIS repair macro essentially empty |
| No automated installer E2E | Medium | Manual QA checklist only |
| Cloud update feed | Low | Intentionally stubbed |

---

# Documentation Gaps

| Gap | Detail |
|---|---|
| Roadmap overclaim | Hardware/Installer marked 100% while residuals and non-shippable installer artifacts remain |
| Calendar module docs vs UI | Drawer still says modules not built |
| No dedicated dashboard module doc | Feature missing |
| Product specification single file | Spec is distributed across ADRs + module docs; no single PRODUCT_SPEC.md found (UNKNOWN if required) |
| This reconciliation | First formal cross-cut report |

**Consistency:** Changelog/decisions largely align with intentional placeholders. Main inconsistency is treating Installer as complete for release purposes.

---

# Testing Gaps

| Area | Present | Missing |
|---|---|---|
| DS / primitives / shell / auth | Many unit tests | ? |
| Business modules | List/key-flow unit tests for most modules | System/hardware/setup page tests thin or absent |
| Hardware | `hardware-escpos-scan.test.ts` | HardwarePage, IPC integration, USB print |
| Installer | `installer-retention.test.ts` + env generator helpers | PyInstaller build CI, NSIS dry-run, service startup automation |
| Accessibility | Some component coverage via Testing Library | No dedicated a11y suite / axe CI found |
| E2E workflows | `tests/electron.readme.md` deferred | No Playwright Electron E2E shipped |
| Backend | Extensive pytest (backend track) | Not re-audited module-by-module beyond API surface in this pass |

---

# Production Readiness Checklist

| Area | Mark |
|---|---|
| Authentication | READY |
| Permissions | PARTIAL (unlock/notifications/payment orphans) |
| Business modules | PARTIAL (Dashboard home missing; minor API gaps) |
| Reports | PARTIAL (export/print placeholders) |
| Administration | PARTIAL (unlock/export placeholders) |
| Hardware | PARTIAL (USB path ready; network stub) |
| Installer | NOT READY |
| Accessibility | PARTIAL |
| Performance | UNKNOWN (no perf evidence gathered) |
| Security | PARTIAL (JWT isolation OK; installer default secrets risk) |
| Documentation | PARTIAL |
| Testing | PARTIAL |

---

# Final Verdict

## NOT READY

**Rationale (evidence-based):**

1. Roadmap still places **YOU ARE HERE -> Dashboard**; shell ops home is not implemented.
2. Installer track is **not a verified one-click store deployment** (missing binaries, missing DB/migrate install steps, incomplete first-run persistence).
3. Multiple intentional placeholders remain acceptable mid-track, but they block Release Candidate.
4. Hardware and Installer were marked complete in roadmap docs; this audit finds Hardware **usable with stubs** and Installer **scaffolded only**.

**Not chosen:**

- READY FOR HARDWARE PHASE ? Hardware code already landed; remaining work is residual (network print), not a greenfield phase gate.
- READY FOR INSTALLER PHASE ? Installer scaffolding already exists; the gap is making it production-true, not starting the phase.
- READY FOR RELEASE CANDIDATE ? Blocked by Dashboard absence + installer non-deliverability + residual placeholders.

---

# Appendix A ? Route inventory (verified)

Protected feature routes present for: categories, customers, inventory, calendar, reservations, rentals, returns, processing (+inspections/batches), sales, settlements, reports (+subpages including dashboard report), users, roles, settings, hardware, audit, system (status/backups/restore/maintenance).

Auth: `/login`, `/force-password-change`.

Home: `/` -> FoundationHomePage (not Ops Dashboard).

---

# Appendix B ? IPC inventory (verified)

Working: API_INVOKE, auth.*, system health/version, app.getConfig, desktop dialogs/window, hardware.*, app first-run, updates check (stub result).

Stub: desktop.fs.

---

# Appendix C ? Status legend

- **COMPLETE:** Feature exists end-to-end for documented v1 scope with only cosmetic/deferred residuals.
- **PARTIAL:** Primary flows work; known gaps or stubs remain.
- **PLACEHOLDER:** UI/IPC present but non-functional by design or empty.
- **MISSING:** Planned/roadmap item with no meaningful implementation.
- **BLOCKED BY BACKEND:** Frontend correctly withheld pending API.
- **NOT APPLICABLE:** Out of scope for current product decisions.
- **UNKNOWN:** Insufficient evidence in this audit pass.

---

*End of reconciliation report. No implementation work was performed.*


# Juman Changelog (product track)

Focused companion changelog for roadmap-facing work. Root [`CHANGELOG.md`](../CHANGELOG.md) remains the full project log.

---

## 2026-08-09 — Phase 9.11 Employee Management & RBAC Portal

### Added

- **Backend HTTP endpoints** (previously service-only):
  - Users: `/users` (list, get, create, update, deactivate, activate, unlock, reset-password, soft-delete, restore)
  - Roles: `/roles` (list active with permissionKeys)
  - Permissions: `/permissions` (catalog list)
- **Frontend Employees portal** (`/employees`):
  - List with search, pagination, filters (status, role), sorting
  - Create dialog (username, fullName, password, role, mustChangePassword)
  - Edit dialog (fullName, role)
  - Detail page: status badges, last login, timestamps, permissions via role
  - Actions: activate/deactivate, unlock, reset password, soft-delete/restore
  - Admin safety: self-protection + last-admin guard on deactivate/delete
- **TopBar portal dropdown** (view switcher): grouped nav by category, keyboard accessible
- **Navigation**: Employees item in Admin group (requires `users.view`)
- **Seed fix**: `availability.view` permission added to catalog and Inventory role

### Changed

- `BACKEND_FEATURE_MAP.md` updated with new HTTP modules and FE navigation
- `FRONTEND_FEATURE_COMPLETION_REPORT.md` updated with RBAC coverage
- Removed Users/Roles from "Missing backend endpoints" and "Quarantine pages"

### Gates

- Backend: build ✓, lint ✓, vitest ✓ (1 pre-existing flaky test unrelated)
- Frontend: build ✓, lint ✓, vitest ✓ (66 tests), validate:arch ✓

---

## 2026-07-30 — Phase 10 Production Release Preparation

### Added

- `LICENSE`, About dialog, desktop `app.getVersion()` IPC, Windows `icon.ico`.
- Release pack: `RELEASE_NOTES_v1.0.0.md`, Operator/Admin manuals, VERSION/DEVELOPER/BUILD manifests, `PRODUCTION_RELEASE_CHECKLIST.md`, `PRODUCTION_PREPARATION_REPORT.md`.
- `deployment/scripts/validate-release.ps1`; built `Juman-Setup-1.0.0.exe` + SHA-256.

### Fixed (packaging blockers)

- Backend freeze via `uv run` PyInstaller; package-installer fails on `dist:win` failure.
- NSIS `$` escape in PG silent PowerShell; installer languages `ar`/`en_US`; valid ICO.

### Position

- Prep artifacts complete; operator VM/hardware cert still open.
- Conclusion: **NOT READY FOR PRODUCTION RELEASE**.
- **YOU ARE HERE → Notifications** (deferred).

---

## 2026-07-30 — Release Candidate Certification (v1.0)

### Added

- Certification matrix + operator VM runbook under `docs/certification/`.
- `certify-smoke.ps1` (post-install) and `certify-packaging-gate.ps1`.
- `docs/RELEASE_CANDIDATE_REPORT.md` with evidence and single release recommendation.

### Fixed

- DEF-RC-01: ProtectedRoute unit test redirect target `/login` (stale `/unauthenticated`).

### Position

- Automated gates PASS; operator Win10/Win11/hardware **NOT EXECUTED**.
- Conclusion: **NOT READY FOR RELEASE**.
- **YOU ARE HERE → Notifications** (deferred).

---

## 2026-07-30 — Phase 7.0 Unified Windows Installer

### Added

- Production NSIS path: PG verify, DB bootstrap, Alembic migrate, WinSW, health gate.
- Packaging scripts (`fetch-winsw`, `build-backend`, `package-installer`, post-install/repair/drop).
- First-run persistence (settings + env patch + password change).
- Service stop/restart/repair IPC; `juman-api.exe migrate`.
- Guides: INSTALLATION / UPGRADE / RECOVERY / UNINSTALL + `INSTALLER_COMPLETION_REPORT.md`.

### Position

- Installer **Phase 7.0 code-complete**; VM certification operator-owned.
- **YOU ARE HERE → Notifications** (deferred).

---

## 2026-07-30 — Hardware network print + diagnostics

### Added

- Production TCP/IP ESC/POS network printing (timeout, probe, test print, saved targets).
- `PrintService` Main router (USB / network).
- Hardware Diagnostics page (`/hardware/diagnostics`) with pass/fail checklist.
- Paper width + windows-1256 encoding options; last print/probe diagnostics fields.

### Fixed

- Removed `NETWORK_PRINT_NOT_IMPLEMENTED` stub and HardwarePage network coming-soon copy.
- Wired `cameraDeviceId` into `CameraCapture`.

### Position

- Hardware Integration **100%** (cloud updates residual elsewhere).

---

## 2026-07-30 — Ops Dashboard (shell home)

### Added

- Production Operations Dashboard as `/` after login (`OpsDashboardPage`).
- Sections: header, KPIs, today’s work, quick actions, recent audit activity, system status — existing APIs only.

### Position

- Business Modules **100%** (Notifications deferred)
- **YOU ARE HERE → Notifications** (backend absent)

---

## 2026-07-30 — Phase 6.1 Hardware + Phase 6.2 Installer

### Added

- Desktop hardware: HID barcode wedge, ESC/POS USB receipt/label/drawer, camera capture, `/hardware` settings.
- Windows deployment: PyInstaller `juman-api.exe`, WinSW `JumanApi`, electron-builder NSIS + official PG silent install hooks, first-run wizard, offline diagnose gate, update stub.
- Docs: `frontend/docs/hardware.md`, `frontend/docs/installer.md`, `deployment/INSTALLATION_GUIDE.md`.

### Position

- Hardware **100%**; Installer **100%** (cloud updates residual)
- **YOU ARE HERE → Dashboard**

---

## 2026-07-30 — Phase 5.13 Frontend Visual QA & UX Polish

### Fixed / polished

- Unified page gutters; stub chrome disabled + قريبًا; detail title hierarchy; auth/error/home kit alignment.
- Installed UI UX Pro Max skill (project `.cursor/skills/`). Audit score **78/100** in `FRONTEND_VISUAL_AUDIT.md`.

### Position

- **YOU ARE HERE → Dashboard**

---

## 2026-07-30 — Phase 5.11 Administration + 5.12 Audit & System

### Added

- Users/roles/settings admin UI; audit list/detail; system status/backups/restore/maintenance.
- Nav الإدارة; module docs users/roles/settings/audit.md.

### Position

- Business Modules **~95%**; **YOU ARE HERE → Dashboard**

---

## 2026-07-30 — Phase 5.9 Sales + Settlements + 5.10 Reports

### Added

- `apiClient.sales` / `settlements` / `reports`; recharts charts; sales + settlement money UI; report category pages.
- Module docs; nav keys for sale / rental.settlement / reports.

### Position

- Business Modules **~85%**; **YOU ARE HERE → Dashboard / System Administration**

---

## 2026-07-30 — Phase 5.7 Returns + 5.8 Inspection/Processing

### Added

- piClient.returns / inspections / processing; returns wizard + detail; processing dashboard queues.
- Inspection condition/complete; processing batch start/optional-day/complete; API dates only.
- Module docs; nav 
eturn.view + المعالجة anyOf.

### Position

- Business Modules **~70%**; **YOU ARE HERE → Settlement / Sales**

---

## 2026-07-30 — Phase 5.5 Reservations + 5.6 Rentals Checkout

### Added

- `apiClient.reservations` / `rentals`; reservation wizard + lifecycle; rental checkout (walk-in + convert).
- Totals/balances from rental API only; availability preview from calendar.
- Module docs; nav `reservation.view` / `rental.view`.

### Position

- Business Modules **~55%**; **YOU ARE HERE → Returns / Inspection / Processing**

---


## 2026-07-30 — Phase 5.3 Inventory + 5.4 Calendar

### Added

- `apiClient.dresses` / `dressPhotos` / `calendar`; Inventory CRUD + photos + barcode + status + audit.
- Calendar dress-centric Month/Week/Day + availability panel + MAINTENANCE manage.
- Module docs; nav `inventory.view` / `calendar.view`.

### Position

- Business Modules **~42%**; **YOU ARE HERE → Reservations**

---


## 2026-07-29 — Phase 5.1 Categories + 5.2 Customers

### Added

- IPC `juman:api:invoke` + multipart/binary; `apiClient` domain helpers.
- Categories list/drawer CRUD; Customers list/detail + MediaClient + AuditTimeline.
- Module docs; nav permissions fixed (`customer.view`).

### Position

- Business Modules **~22%**; **YOU ARE HERE → Inventory / Dresses**

---

## 2026-07-29 — Application Shell 3.1 + Authentication UI 4.0

### Added — Shell 3.1

- Sidebar icons/badges/keyboard; StatusBar; route title/breadcrumbs; shortcuts; Loading/Dialog/Drawer hosts; window setTitle; workspace states.

### Added — Auth 4.0

- IPC `login` / `changePassword`; Login + ForcePasswordChange screens; ProtectedRoute; remember-me; session expiry UX; `#/forbidden`.

### Position

- Shell **100%**; Auth **100%**; **YOU ARE HERE → Phase 5 Business Modules UI**

---

## 2026-07-29 — Design System 2.7 + Application Shell 3.0 foundation

### Added — Phase 2.7 Shared business

- MoneyDisplay / CurrencyBadge; StatusChip; PermissionGuard; media/barcode/entity/audit/misc business widgets.
- Docs `frontend/docs/components/business.md`; showcase `#/dev/business`.

### Added — Phase 3.0 Application shell foundation

- `AppShellFrame`, Sidebar (collapsible/resizable), TopBar stubs, Workspace, nav section/item, UserMenu, AppLogo, CompanySwitcher stub.
- Docs `frontend/docs/application-shell.md`; showcase `#/dev/shell`.

### Position

- Design System **100%**; Shell **~25%**; **YOU ARE HERE → Phase 3 remaining** (module route map).

---

## 2026-07-29 — Design System 2.5 / 2.6 gap-fill harden


### Fixed / hardened

- **KPICard:** subtitle and trend render together (no `trendLabel ?? subtitle` collision).
- **DataTable:** DEV one-time warning when `virtualization.enabled` (still no runtime virtualizer).
- **FilterBar:** filter values are serializable (`DataFilterValue`); dates emit ISO `YYYY-MM-DD`.
- **InlineMessage:** `aria-live` polite / assertive for error.
- **notification:** exported alias of `toast` (same singleton).

### Tests

- Extended DataTable (manual, skeleton, error, virt warn), FilterBar field types, selection helper, SearchBar Ctrl+K, Pagination page size, KPI subtitle+trend, toast/`notification`, ConfirmationDialog Enter+loading, ErrorState DEV gate, InlineMessage live region.

### Docs / showcase

- `frontend/docs/components/data.md`, `feedback.md`
- `#/dev/data` KPI subtitle+trend; `#/dev/feedback` notification alias button
- Companion docs: this file + `JUMAN_DECISIONS.md`; roadmap + canvas synced

### Position

- Design System 2.1–2.6 remain complete; **YOU ARE HERE → Phase 2.7 Shared Business Components**

---

## 2026-07-29 — Design System 2.1–2.6 initial ship (+ layout polish)

- Tokens through Feedback kit shipped.
- Layout polish: Page compounds, Breadcrumb hardening.
- See root `CHANGELOG.md` for file-level detail.
# Juman Master Roadmap

**Product:** جمان (Juman) — Arabic RTL dress rental & sales desktop system  
**Version:** Roadmap doc `1.0.0` · Backend `1.0.0` · Frontend workspace `@juman/frontend@1.0.0`  
**Last updated:** 2026-08-02
**Overall progress:** **~98%** (v1.0.0 release prep docs + Setup artifact built; store ship blocked on operator RC VM/hardware matrix)  
**Current phase:** Frontend — residual / deferred  
**Current step:** Notifications (deferred; backend absent)  
**Next step:** Operator Win10/Win11 + hardware RC matrix → then production release approval; Notifications when backend exists

> **Maintenance rule:** After every approved phase completes, update this file **and** the live canvas **before** marking the phase done. Append history — never erase past entries. Markdown + canvas stay in sync.

**Live canvas (open beside chat):** [Juman Master Roadmap](file:///C:/Users/moham/.cursor/projects/c-Users-moham-Desktop-juman/canvases/juman-master-roadmap.canvas.tsx)

Related snapshots (do not replace this file): [`FRONTEND_VISUAL_AUDIT.md`](./FRONTEND_VISUAL_AUDIT.md), [`PROJECT_STATUS.md`](../PROJECT_STATUS.md), [`CHANGELOG.md`](../CHANGELOG.md), [`JUMAN_DECISIONS.md`](./JUMAN_DECISIONS.md), [`JUMAN_CHANGELOG.md`](./JUMAN_CHANGELOG.md), [`frontend/docs/design-system.md`](../frontend/docs/design-system.md).

---

## Global progress

```text
Backend
████████████████████████████████████████ 100%

Frontend Foundation
████████████████████████████████████████ 100%

Design System
████████████████████████████████████████ 100%   (2.1–2.7 complete)

Application Shell
████████████████████████████████████████ 100%   (3.0 + 3.1 complete)

Authentication UI
████████████████████████████████████████ 100%   (Phase 4.0)

Business Modules (frontend)
████████████████████████████████████████ 100%   (Dashboard complete; Notifications deferred)

Hardware
████████████████████████████████████████ 100%   (Phase 6 / 6.1)

Installer / Distribution
████████████████████████████████████████ 100%   (Phase 7 / 6.2; cloud updates stub only)
```

| Track | Status | Notes |
|---|---|---|
| Backend | Complete (v1.0) | Residual: Notifications; POS later; documented risks |
| Frontend Foundation | Complete | Electron + React + IPC proxy; no Axios/JWT in renderer |
| Design System | 2.1–2.7 complete | Shared business kit shipped |
| Application Shell | Complete (3.0–3.1) | Chrome, hosts, shortcuts, status bar |
| Authentication UI | Complete (4.0) | Login / force-password / session via IPC |
| Business Modules UI | Complete | Ops Dashboard home; Notifications deferred |
| Hardware | Complete (6.1) | HID scan, USB+network ESC/POS, PrintService, diagnostics, camera |
| Installer | Complete (7.0) + Phase 10 prep | `Juman-Setup-1.0.0.exe` built locally; **NOT READY FOR PRODUCTION RELEASE** until Win10+Win11 RC evidence |

---

## Current position

```text
Backend
    ✔ Finished (v1.0 Production Ready)

Frontend
    ✔ Foundation

    Design System
        ✔ 2.1 Theme & tokens
        ✔ 2.2 Primitives
        ✔ 2.3 Forms
        ✔ 2.4 Layout (+ Page/Breadcrumb polish)
        ✔ 2.5 Data
        ✔ 2.6 Feedback
        ✔ 2.7 Shared business components

    Application Shell          ✔ complete (3.0–3.1)
    Authentication UI          ✔ complete (4.0)
    Business Modules UI        ✔ (~100% product modules; Notifications deferred)
        ✔ Categories (5.1)
        ✔ Customers (5.2)
        ✔ Inventory / Dresses (5.3)
        ✔ Calendar / Availability (5.4)
        ✔ Reservations (5.5)
        ✔ Rentals / Checkout (5.6)
        ✔ Returns / Inspection / Processing (5.7–5.8)
        ✔ Sales + Settlements (5.9)
        ✔ Reports & Analytics (5.10)
        ✔ Administration (5.11 Users/Roles/Settings)
        ✔ Audit + System Administration (5.12)
        ✔ Visual QA (5.13)
        ✔ Dashboard (Ops home)
        ☐ Notifications (deferred — backend absent)
            ◄ YOU ARE HERE — next when backend exists
    Hardware                   ✔ (6.1)
    Installer                  ✔ (6.2; cloud updates stub; ship artifacts residual)
```

---

## Master roadmap

### Legend

- ☑ Done  
- ◐ In progress / partial  
- ☐ Not started  

---

### Phase 0 — Product & architecture foundations

- ☑ Clean Architecture + DDD modular packaging
- ☑ FastAPI + async SQLAlchemy + Alembic + PostgreSQL
- ☑ Constitution: Arabic RTL UI; English source/keys; PermissionGate UX-only
- ☑ ADR set under `docs/ADR/`
- ☑ API envelope / versioned REST

---

### Phase 1 — Backend domain & platform (v1.0 certified)

- ☑ Settings (auth-protected)
- ☑ RBAC (database-driven; fail-closed inactive roles)
- ☑ Media (auth-protected)
- ☑ Users / Identity Phases 1–7
- ☑ Audit (append-only + domain writes)
- ☑ Categories
- ☑ Customers v2 (`CUS-########`)
- ☑ Inventory / Dresses Phase 1–5 (~90% — residual write-off paths later)
- ☑ Calendar Engine
- ☑ Reservations
- ☑ Rentals v1
- ☑ Returns v1
- ☑ Inspection v1
- ☑ Processing v1
- ☑ Rental Settlement v1
- ☑ Sales v1
- ☑ Reports v1
- ☑ System Administration Phase 1–6 (production certification)
- ☐ Notifications module
- ☐ General POS (`payment.*`) beyond rental settlement
- ☐ `RUINED` write-off without sale (Inventory/Admin)

**Release:** Backend **v1.0 Production Ready** — `docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md`

---

### Phase 2 — Frontend Design System

#### 2.1 Theme & tokens — ☑

- ☑ `juman-dark` only (Premium Black / Dark / Gold)
- ☑ `tokens.css` + typed `theme/tokens.ts`
- ☑ ThemeProvider (immutable theme store)
- ☑ Lucide `Icon` wrapper
- ☑ Docs: `frontend/docs/theme.md`, `design-system.md`
- ☑ DEV tokens showcase

#### 2.2 Primitive components — ☑

- ☑ Button / IconButton (gold primary)
- ☑ Text / Password / Number / TextArea
- ☑ Label, Checkbox, RadioGroup, Switch
- ☑ Badge, Chip, Avatar
- ☑ Spinner, Progress, Divider, Tooltip
- ☑ `normalizeDigits` / numeric LTR inputs
- ☑ DEV showcase `#/dev/*`
- ☑ Docs: `frontend/docs/components/primitives.md`

#### 2.3 Form components — ☑

- ☑ Form / FormField / FormSection (RHF + Zod)
- ☑ SearchInput, MoneyInput (fils), PhoneInput (E.164)
- ☑ Select, MultiSelect, Autocomplete, Popover, ScrollArea
- ☑ DatePicker + Gregorian CalendarAdapter
- ☑ FilePicker / ImagePicker / ColorPicker (local FileList initially)
- ☑ `#/dev/forms` · `frontend/docs/components/forms.md`
- ☐ Media UUID upload rewrite (contract locked; implement with MediaClient later)

#### 2.4 Layout components — ☑

- ☑ Page shell (`Page`, `PageHeader`, `PageContent`, `PageActions`)
- ☑ Follow-on: `PageTitle`, `PageSubtitle`, `PageToolbar`, `PageFooter`, `Page` size/as
- ☑ Container, Section, Stack, Grid
- ☑ Card variants, Panel
- ☑ Dialog / Modal; Drawer / Sheet (default `side="right"`)
- ☑ Tabs (workspace), Accordion, Collapsible
- ☑ Breadcrumb (+ `BreadcrumbCurrent`, truncation, `buildBreadcrumbTrail`)
- ☑ ResizablePanelGroup / Panel / Handle
- ☑ `#/dev/layout` · `frontend/docs/components/layout.md`

#### 2.5 Data components — ☑

- ☑ `createDataColumn` + controlled `DataTable` (TanStack wrapped)
- ☑ Pagination, SearchBar, FilterBar
- ☑ StatusBadge + `mapStatus`
- ☑ KPICard, StatisticsCard
- ☑ DropdownMenu + PermissionGate row actions
- ☑ Shift-range selection helper
- ☑ `#/dev/data` · `frontend/docs/components/data.md`
- ☐ Virtual scrolling runtime (`@tanstack/react-virtual`) — architecture-ready only

#### 2.6 Feedback components — ☑

- ☑ ToastProvider + `toast` API (Radix; queue max 3)
- ☑ Alert, InlineMessage
- ☑ ConfirmationDialog
- ☑ LoadingOverlay, ProgressOverlay, BusyIndicator
- ☑ Skeleton variants
- ☑ EmptyState, ErrorState
- ☑ `#/dev/feedback` · `frontend/docs/components/feedback.md`

#### 2.7 Shared business components — ☑

- ☑ MoneyDisplay / CurrencyBadge
- ☑ StatusChip (+ mapStatus reuse; StatusBadge kept for tables)
- ☑ PermissionGuard (anyOf/allOf; hide/disable); PermissionGate thin wrap
- ☑ BarcodeDisplay / BarcodeScannerField (UI only)
- ☑ DressThumbnail, AvatarGroup, UserChip
- ☑ MediaThumbnail / MediaGallery (viewer; StoredFileMeta)
- ☑ EntityHeader / EntityMeta / RecordInfoPanel / CreatedUpdatedInfo
- ☑ AuditTimeline, TagList, SearchHighlight, CopyButton, RelativeTime
- ☑ `#/dev/business` · `frontend/docs/components/business.md`

---

### Phase 3 — Application shell — ☑

- ☑ App chrome / Sidebar (icons, badges, collapse/resize, keyboard)
- ☑ Workspace layout + loading/empty/error slots
- ☑ TopBar title + route breadcrumbs + status bar
- ☑ Shortcut infrastructure + dialog/drawer/loading hosts
- ☑ Window title IPC
- ☐ Domain module route map (deferred to Phase 5)
- ☐ Real command palette / global search (stubs remain)

---

### Phase 4 — Authentication UI — ☑

- ☑ Login screen (IPC; remember me; connection/version)
- ☑ Logout + session restore bootstrap
- ☑ Force password change UI
- ☑ Session expiry → login; 403 forbidden page; offline UX
- ☑ Permission-aware shell nav

---

### Phase 5 — Business modules (frontend) — ☑ (~100%; Notifications deferred)

Backend APIs largely ready; ship module-by-module on IPC + DS:

- ☑ Categories (5.1)
- ☑ Customers (5.2)
- ☑ Inventory / Dresses (5.3)
- ☑ Calendar / Availability (5.4)
- ☑ Reservations (5.5)
- ☑ Rentals / Checkout (5.6)
- ☑ Returns / Inspection / Processing (5.7–5.8)
- ☑ Settlement / Sales (5.9)
- ☑ Reports (5.10)
- ☑ Administration (5.11 Users/Roles/Settings)
- ☑ Audit + System Administration (5.12)
- ☑ Visual QA / UX Polish (5.13)
- ☑ Dashboard (Ops home on shell)
- ☐ Notifications UI (depends on backend Notifications)

---

### Phase 6 — Hardware — ☑ (6.1)

- ☑ Barcode scanner integration (USB HID wedge + focus + manual fallback)
- ☑ Network ESC/POS TCP send + probe + saved targets
- ☑ PrintService (USB / network)
- ☑ Hardware diagnostics page (pass/fail)
- ☑ Receipt / label printing (ESC/POS USB; network transport stub)
- ☑ Cash drawer via receipt printer kick
- ☑ Camera capture (dress + customer) + device failure UX
- ☑ Station-local hardware settings (`/hardware`)

### Phase 7 — Installer & distribution — ☑ (6.2)

- ☑ Packaged Electron builds (electron-builder NSIS)
- ☑ Official PostgreSQL silent install + Windows service (1A)
- ☑ Frozen `juman-api.exe` + WinSW service (2A); wait-for-DB
- ☑ Phase 7.0: DB bootstrap + Alembic migrate + health gate + repair/uninstall policies
- ☑ First-run persistence (company/admin/storage/timezone/language)
- ☑ First-run wizard, repair, uninstall + DB retention prompt
- ☑ Update infrastructure stub only (no cloud fetch)
- ☑ Ops install docs (`deployment/INSTALLATION_GUIDE.md`)

---

## Completed this phase (append-only log)

### 2026-08-02 ? Backend v2 Phase 4.1 Inventory Catalog Engine

**Completed work**

- Added generic inventory catalog taxonomy (categories, brands, colors, sizes) and item CRUD, soft-delete/restore, search/filtering, integer-fils prices, internal-code allocation, barcode binding, and media references.
- Wired RBAC/seed settings, Prisma catalog migration constraints, inventory module, and inventory Vitest configuration.
- Verified `pnpm prisma generate`, `pnpm build`, and 9 focused unit/integration tests.

**Position**

- Backend v2 Phase 4.1 implementation and focused tests are present, but its configured coverage gate is not yet satisfied. Rentals, reservations, availability, laundry, inspections, and sales remain explicitly out of scope.

---


### 2026-07-30 — Phase 10 Production Release Preparation

**Completed work**

- Version lock 1.0.0; About dialog; status/login semver; LICENSE; win.icon.
- Release notes, Operator/Admin manuals, VERSION/DEVELOPER/BUILD manifests, production checklist.
- `validate-release.ps1`; packaged `Juman-Setup-1.0.0.exe` + SHA-256; packaging script/NSIS/ICO fixes.
- Consistency audit: no TODO/FIXME; deferred NOT_IMPLEMENTED documented.
- `docs/PRODUCTION_PREPARATION_REPORT.md`.

**Position**

- Conclusion: **NOT READY FOR PRODUCTION RELEASE** (operator RC matrix still NOT EXECUTED).
- **YOU ARE HERE → Notifications** (deferred).

---

### 2026-07-30 — Release Candidate Certification (v1.0) — agent phase

**Completed work**

- `docs/certification/RC_TEST_MATRIX.md` + `OPERATOR_VM_RUNBOOK.md`.
- `deployment/scripts/certify-smoke.ps1` + `certify-packaging-gate.ps1`.
- Automated gates: FE (post DEF-RC-01), BE smoke (34), installer units (7+5), security static PASS, packaging scripts/gitignore PASS.
- Defect DEF-RC-01: ProtectedRoute unit expected `/login`.
- `docs/RELEASE_CANDIDATE_REPORT.md`.

**Position**

- RC conclusion: **NOT READY FOR RELEASE** (Win10/Win11 install/reboot/repair/uninstall/hardware NOT EXECUTED).
- **YOU ARE HERE → Notifications** (deferred) remains; operator VM matrix is the blocker for store READY.

---

### 2026-07-30 — Phase 7.0 Unified Windows Installer

**Completed work**

- Packaging scripts: fetch WinSW/PG, build `juman-api.exe`, `package-installer.ps1`.
- NSIS: fail if binaries missing; secrets; PG silent; DB bootstrap; migrate; WinSW; health; repair/uninstall preserve policies.
- `juman-api.exe migrate` CLI; first-run persists company/admin/storage/timezone/language.
- Service IPC stop/restart/repair; env read/patch.
- Guides + `docs/INSTALLER_COMPLETION_REPORT.md`.

**Position**

- Installer **Phase 7.0 code-complete** (operator VM certification remaining); **YOU ARE HERE → Notifications** (deferred) / residuals.

---

### 2026-07-30 — Hardware network print + diagnostics

**Completed work**

- Implemented TCP ESC/POS send/probe in Electron Main (`network.ts`); removed `NETWORK_PRINT_NOT_IMPLEMENTED`.
- PrintService routes USB vs network; saved network targets + timeout/paper/encoding.
- Hardware diagnostics page `/hardware/diagnostics`; cameraDeviceId wired into CameraCapture.
- Unit tests: network mocks, PrintService, config migration, HardwarePage/Diagnostics UI.
- Docs: `frontend/docs/hardware.md`, `docs/HARDWARE_COMPLETION_REPORT.md`.

**Position**

- Hardware **100%** (network residual closed); cloud updates remain out of scope.

---

### 2026-07-30 — Ops Dashboard (shell home)

**Completed work**

- Replaced `FoundationHomePage` index with `OpsDashboardPage` (RTL three-column).
- KPIs / Today work from `GET /reports/dashboard` only (Arabic labels; hide AVAILABLE if absent).
- Header: welcome, company_name, server `as_of`, health connection.
- Quick actions permission-gated; recent activity via audit list; system status via health/version/backups.
- Lazy section load; unit tests `ops-dashboard.test.tsx`; `frontend/docs/modules/dashboard.md`.

**Position**

- Business Modules **100%** (Notifications deferred); **YOU ARE HERE → Notifications** (when backend exists).

---

### 2026-07-30 — Phase 6.1 Hardware + Phase 6.2 Installer

**Completed work**

- Electron Main hardware adapters: HID scan, ESC/POS USB + TCP network, PrintService, label preview/print, drawer, camera, diagnostics.
- UI: `/hardware`, BarcodeScannerField/Display upgrades, CameraCapture on dress/customer media.
- Deployment: PyInstaller entry + wait-for-DB, WinSW XML, env generator, NSIS hooks, electron-builder, first-run + offline diagnose gate.
- Docs: `frontend/docs/hardware.md`, `frontend/docs/installer.md`, `deployment/INSTALLATION_GUIDE.md`.

**Position**

- Hardware **100%**; Installer **100%** (cloud updates residual); **YOU ARE HERE → Dashboard**.

---

### 2026-07-30 — Phase 5.13 Frontend Visual QA & UX Polish

**Completed work**

- Page gutter contract (shell `p-6` only; Page max-width without horizontal padding).
- Stub chrome consistently disabled + قريبًا; detail PageHeader/EntityHeader de-duplication.
- Foundation / Forbidden / NotFound / Login polish; reports focus rings.
- UI UX Pro Max installed under `.cursor/skills/ui-ux-pro-max/` (checklist only).
- Audit: [`docs/FRONTEND_VISUAL_AUDIT.md`](./FRONTEND_VISUAL_AUDIT.md) — overall **78/100**.

**Position**

- Business Modules **~95%** (+ Visual QA); **YOU ARE HERE → Dashboard**.

---

### 2026-07-30 — Phase 5.11 Administration + 5.12 Audit & System

**Completed work**

- Extended `apiClient`: `users`, `roles`, `permissions`, `settings`, expanded `audit` + `system` admin ops.
- Features: users, roles (matrix assign/remove), settings (category + system prefixes), audit list/detail, system status/backups/restore/maintenance.
- Nav section الإدارة; docs users/roles/settings/audit.md.

**Position**

- Business Modules **~95%**; **YOU ARE HERE → Dashboard**.

---

### 2026-07-30 — Phase 5.12 Audit + System Administration

**Completed work**

- `features/audit`: list/detail pages; filters (module, entity, action, user, q, date range); table + timeline; `audit.view`; export placeholder disabled.
- `features/system`: status (health/version/info/diagnostics/metrics); backups CRUD + download; restore validate/execute + history (409 surfaced); maintenance tasks/history; envelope adapters for Items/List.
- Routes + nav wired under الإدارة (`auditRoutes`, `systemRoutes`).

**Position**

- Business Modules **~95%**; **YOU ARE HERE → Dashboard**.

---

### 2026-07-30 — Phase 5.9 Sales + Settlements + 5.10 Reports

**Completed work**

- Extended `apiClient` + domain types: `sales.*`, `settlements.*`, `reports.*`; added **recharts**.
- `features/sales`: list/create/detail; atomic sale create; nested payments display.
- `features/settlements`: list + outstanding preset; create; collect payment + adjustments; API money only.
- `features/reports`: home + category pages; KPI cards; Line/Bar/Area/Pie from API aggregates; export placeholder.
- Nav: `sale.view`, `rental.settlement.view`, reports anyOf; docs `sales.md` / `settlements.md` / `reports.md`.

**Position**

- Business Modules **~85%**; **YOU ARE HERE → Dashboard / System Administration**.

---

### 2026-07-30 — Phase 5.7 Returns + 5.8 Inspection/Processing

**Completed work**

- Extended piClient + domain types: 
eturns.*, inspections.*, processing.*.
- eatures/returns: list, wizard (ACTIVE rental), detail + audit; CTA to inspection.
- eatures/processing: dashboard queues (فحص/معالجة/جاهز); inspection CRUD/complete; batch start/optional-day/complete.
- Nav: 
eturn.view; المعالجة via processing.view **or** inspection.view; docs 
eturns.md / processing.md.

**Position**

- Business Modules **~70%**; **YOU ARE HERE → Settlement / Sales**.

---

### 2026-07-30 — Phase 5.5 Reservations + 5.6 Rentals Checkout

**Completed work**

- Extended `apiClient` + domain types: `reservations.*`, `rentals.*`.
- `features/reservations`: list, wizard, detail, edit (Draft); confirm/cancel/expire; calendar availability preview; convert CTA.
- `features/rentals`: list, checkout wizard (walk-in + reservation convert), detail with API money trio; notes-only PATCH.
- Nav: `reservation.view` / `rental.view`; docs `frontend/docs/modules/reservations.md` / `rentals.md`.

**Position**

- Business Modules **~55%**; **YOU ARE HERE → Returns / Inspection / Processing**.

---

### 2026-07-30 — Phase 5.3 Inventory + 5.4 Calendar

**Completed work**

- Extended `apiClient` + domain types: `dresses.*`, `dressPhotos.*`, `calendar.*`.
- `features/inventory`: list (`page`/`page_size`), create/edit, detail (photos, barcode Admin, status dialog, audit, availability panel).
- `features/calendar`: dress picker + Month/Week/Day timeline; block drawer; MAINTENANCE manage only; no store-wide grid.
- Nav: `inventory.view` / `calendar.view`; docs `frontend/docs/modules/inventory.md` / `calendar.md`.

**Position**

- Business Modules **~42%**; **YOU ARE HERE → Reservations**.

---

### 2026-07-29 — Phase 5.1 Categories + 5.2 Customers

**Completed work**

- Generic Main IPC `API_INVOKE` (JSON + multipart + binary→data URL); typed `apiClient` categories/customers/media/audit.
- `features/categories`: list + drawer CRUD; activate/deactivate; `category_in_use` surfaced.
- `features/customers`: list + detail; MediaClient profile/gallery FileReferences; AuditTimeline; soft-delete confirm.
- Nav: `categories.view` / `customer.view` (singular); docs `frontend/docs/modules/categories.md` / `customers.md`.

**Position**

- Business Modules **~22%**; **YOU ARE HERE → Inventory / Dresses**.

---

### 2026-07-29 — Application Shell 3.1 + Authentication UI 4.0

**Completed work**

- Shell 3.1: icons/badges, status bar, route breadcrumbs/title, shortcuts, global loading/dialog/drawer hosts, window `setTitle`, workspace states.
- Auth 4.0: `login` / `changePassword` IPC on SessionManager; chrome-less AuthLayout; Login + ForcePasswordChange; ProtectedRoute gates; remember-me persistence rule; session expiry handling.
- Docs: `application-shell.md`, `authentication.md`; showcases `#/dev/shell`, `#/dev/auth`.

**Position**

- Shell **100%**; Auth UI **100%**; **YOU ARE HERE → Phase 5 Business Modules UI**.

---

### 2026-07-29 — Design System 2.7 + Application Shell 3.0 foundation

**Completed work**

- Phase **2.7** shared business presentation components under `frontend/src/components/ui/business/` (money, status, permission, media, barcode, entity chrome, audit, misc).
- Phase **3.0** shell foundation under `frontend/src/layouts/shell/` composed by product `AppShell` (collapsible/resizable sidebar, TopBar stubs, Workspace).
- Docs: `business.md`, `application-shell.md`; showcases `#/dev/business`, `#/dev/shell`.
- Tests: MoneyDisplay/StatusChip, PermissionGuard, CopyButton/SearchHighlight, Sidebar permission + collapse a11y.

**Key files / areas**

- `frontend/src/components/ui/business/**`, `frontend/src/components/ui/index.ts`
- `frontend/src/layouts/shell/**`, `frontend/src/layouts/AppShell.tsx`
- `frontend/src/stores/authStore.ts` (`hasAllPermission`), `frontend/src/app/PermissionGate.tsx`
- `frontend/docs/components/business.md`, `frontend/docs/application-shell.md`

**Architectural decisions (see Decision Log + JUMAN_DECISIONS)**

- Business widgets presentation-only; no HTTP
- PermissionGuard richer API; Gate delegates
- StoredFileMeta parent-supplied `src`
- Shell placeholders only; no login/dashboard/module routes

**Breaking changes**

- None for product features. PermissionGate behavior preserved.

**Position**

- Design System **100%**; Application Shell **~25%**; **YOU ARE HERE → Phase 3 remaining** (module route map / deeper wiring).

---

### 2026-07-29 — Design System 2.5 / 2.6 gap-fill harden

**Completed work**

- Gap-fill only (no rebuild): KPICard subtitle+trend, FilterBar serializable ISO dates, DataTable DEV virtualization warn, `notification` ≡ `toast`, InlineMessage `aria-live`.
- Extended RTL unit tests for data/feedback harden paths.
- Companion docs: `docs/JUMAN_DECISIONS.md`, `docs/JUMAN_CHANGELOG.md`; showcase polish on `#/dev/data` and `#/dev/feedback`.

**Key files / areas**

- `frontend/src/components/ui/kpi-card.tsx`, `filter-bar.tsx`, `data-table/**`, `toast/**`, `inline-message.tsx`
- `frontend/docs/components/data.md`, `feedback.md`
- `frontend/tests/unit/**` (data/feedback harden coverage)
- `docs/JUMAN_DECISIONS.md`, `docs/JUMAN_CHANGELOG.md`

**Architectural decisions (see Decision Log + JUMAN_DECISIONS)**

- Virtualization remains architecture-ready; DEV warn when `enabled: true`
- `notification` alias of `toast` (same singleton)
- LoadingOverlay vs ProgressOverlay intentional split
- Filter values must be serializable for server mode

**Breaking changes**

- None. Public APIs unchanged; features still import only `@/components/ui`.

**Position**

- YOU ARE HERE remains **Phase 2.7**; Design System % stays **~86%**.

---

### 2026-07-29 — Frontend Design System 2.1–2.6 + Layout polish

**Completed work**

- Full design-system stack through Feedback.
- Layout polish: Page compounds + Breadcrumb hardening.
- DEV showcases: `#/dev/tokens`, buttons, inputs, forms, layout, data, feedback.

**Key files / areas**

- `frontend/src/styles/tokens.css`, `frontend/src/theme/`
- `frontend/src/components/ui/**`, `frontend/src/components/icons/`
- `frontend/src/dev/**`
- `frontend/docs/**` (`theme.md`, `primitives.md`, `forms.md`, `layout.md`, `data.md`, `feedback.md`)
- Tests under `frontend/tests/unit/` (suite green at time of polish)

**Architectural decisions (see Decision Log)**

- Radix-only overlays behind `@/components/ui`
- Controlled-first DataTable; TanStack never imported by features
- Drawer default right; Sheet = Drawer alias
- Toast max 3 visible, bottom-start
- Breadcrumbs informational; Sidebar remains primary nav (when built)
- Media UUID contract deferred (no upload UI in DS phases)

**Breaking changes**

- None for product features (no business screens yet).
- `BreadcrumbPage` deprecated alias of `BreadcrumbCurrent` (still exported).

---

### Prior — Backend v1.0 Production Ready

**Completed work:** Full backend certification (Identity through System Admin Phase 6).  
**Files:** `docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md`, Alembic HEAD `20260802_0033_system_backups_duration`.  
**Breaking changes:** N/A for frontend consumers yet.

---

## Next phase

| Field | Value |
|---|---|
| **Name** | **Notifications UI** (deferred) |
| **Goal** | In-app notifications when backend Notifications module exists |
| **Estimated work** | Large (backend + FE) |
| **Dependencies** | Backend Notifications module (absent) |
| **After** | Installer ship hardening / residual placeholders as needed |

---

## Decision log (append-only)

### 2026-07-30 — Phase 7.0 Installer

| Decision | Reason |
|---|---|
| Fetch/build binaries at package time (not git) | PG/WinSW/`juman-api.exe` too large / generated |
| Install-time random secrets + credentials file | No hardcoded Admin123! in production path |
| `juman-api.exe migrate` CLI | Alembic without shipping Python |
| First-run persists then `firstrun.done` | Prior wizard only set a flag |
| Repair never drops DB/storage | Data safety |

### 2026-07-30 — Hardware network print

| Decision | Reason |
|---|---|
| TCP raw ESC/POS in Main (`net.Socket`) | Renderer never opens sockets |
| Named saved network targets (not full profile CRUD) | Additive; no architecture redesign |
| PrintService thin router | Unify USB/network without rewriting adapters |
| Cloud updates stay NOT_IMPLEMENTED | Explicitly out of hardware scope |

### 2026-07-30 — Ops Dashboard

| Decision | Reason |
|---|---|
| Home `/` = OpsDashboardPage | Replace FoundationHomePage |
| KPIs only from DashboardReportDto | No fake/client-calculated KPIs; omit settlements/revenue/returns-due |
| Today work = counts + nav links | Dashboard API has no row lists |
| Keep `/reports/dashboard` report page | Separate reports entry |

### 2026-07-30 — Hardware 6.1 + Installer 6.2

| Decision | Reason |
|---|---|
| Hardware I/O in Electron Main; config in `userData` | Station-local devices; backend stays barcode/media only |
| No vendor SDKs; ESC/POS RAW + Windows spool | Maintainable across printers |
| Network ESC/POS typed but send stubbed | Future-ready without fake success |
| Camera via renderer getUserMedia + Main media grant | Sandbox-safe capture |
| Installer 1A official PostgreSQL | One installer; standard PG service/upgrades |
| Backend 2A PyInstaller + WinSW | No Python on store PCs |
| Electron never starts PostgreSQL | Service boot order; diagnose API only |
| Cloud updates stub only | Prepare channel; no CDN yet |

### 2026-07-30 — Visual QA 5.13

| Decision | Reason |
|---|---|
| Shell owns page gutters (`p-6`) | Avoid double padding with Page |
| Stub chrome disabled + قريبًا | No fake toast features |
| UI UX Pro Max = checklist only | Juman DS tokens remain authority |
| No visual regression CI this phase | Tooling absent |

### 2026-07-30 — Admin 5.11 + Audit/System 5.12

| Decision | Reason |
|---|---|
| No unlock UI | Permission seeded; HTTP route missing |
| Role matrix assign/remove only | PUT is metadata-only |
| Settings security/media/backup = system key prefixes | No separate categories |
| Audit export placeholder | No export API |
| Production status = diagnostics | No /production-status |
| Ops Dashboard deferred | This phase is Admin + System |

### 2026-07-30 — Sales 5.9 + Settlements 5.9 + Reports 5.10

| Decision | Reason |
|---|---|
| No standalone Payments module | Backend has nested payments only |
| Outstanding = OPEN + PARTIALLY_PAID lists | No /outstanding endpoint |
| Recharts official chart library | React-first; presentation only |
| Sparse financial/daily (no zero-fill) | Do not invent missing days |
| Export UI placeholder only | reports.export unused in v1 |
| Money fields display-only | No FE balance math |

### 2026-07-30 — Returns 5.7 + Inspection/Processing 5.8

| Decision | Reason |
|---|---|
| Returns create-only (no PATCH) | Match Returns API v1 |
| Inspection/Processing separate from Returns wizard | Backend split modules |
| Rental money trio read-only on return review | No settlement on Returns |
| Queues = list filters only | No invented Cleaning/Repair HTTP stages |
| Processing dates from API only | No client day math |
| Nav المعالجة anyOf inspection/processing.view | Either permission unlocks hub |


### 2026-07-30 — Reservations 5.5 + Rentals 5.6

| Decision | Reason |
|---|---|
| List `offset`/`limit` | Match Reservations/Rentals API |
| Confirm via `reservation.update` | Match RBAC |
| Availability on confirm only | Calendar Engine lock |
| Convert via `POST /rentals` | No reservations convert route |
| Totals from rental response only | No quote endpoint |
| No working rental cancel UI | Always 422 in v1 |



### 2026-07-30 — Inventory 5.3 + Calendar 5.4

| Decision | Reason |
|---|---|
| Dress list `page`/`page_size` | Match Inventory API |
| Perms `inventory.*` / `calendar.*` | Match RBAC |
| Status via `POST .../status` only | Status Engine authority |
| Photos via dress-photos + media upload | Not FileReference-primary |
| Calendar dress-centric only | No store-wide month API |
| Availability from calendar endpoints only | No client overlap math |
| Manage MAINTENANCE only from calendar | No fake bookings |


### 2026-07-29 — Design System & frontend foundation

| Decision | Reason |
|---|---|
| Single theme `juman-dark`; no light/system | Premium Black/Dark/Gold constitution; avoid dual-theme debt |
| Gold accent ~2% of UI only | Luxury desktop language; never large gold surfaces |
| Radix only behind `@/components/ui` | Headless a11y; features never import Radix |
| Renderer never Axios / never JWT | IPC Main owns HTTP + tokens |
| PermissionGate is UX-only | Authorization stays on API / Main |
| Drawer default `side="right"` | Arabic desktop detail editors; logical end placement |
| Sheet = Drawer alias; Modal = Dialog alias | Naming clarity without second primitives |
| Money as integer **fils** | Avoid float currency; IQD precision |
| Phone as E.164 via PhoneService | Stable storage/validation |
| DatePicker Gregorian adapter (date-fns) | Explicit calendar boundary for future Hijri if needed |
| FilePicker stores local FileList initially; Media UUID contract later | DS phase isolation; MediaClient → Main → `POST /api/v1/media/files` later |
| DataTable controlled-first; `createDataColumn` only | Server-driven tables; hide TanStack from features |
| Virtualization architecture-ready only in 2.5 | Avoid premature `@tanstack/react-virtual` |
| Toast: Radix Toast; max 3; bottom-start | Consistent overlays; desktop queueing |
| ConfirmationDialog composes Dialog | No second overlay stack |
| Tabs = page/panel workspace, not app chrome | Sidebar will own primary nav |
| Breadcrumbs informational only | Module hierarchy trail; not primary navigation |
| PageHeader dual API (props + composition) | Back-compat + preferred compounds (`PageTitle`…) |
| `react-resizable-panels` v4: numbers are px; use `%` strings | Library API footgun documented in `layout.md` |

### 2026-07-29 — Shell 3.1 + Auth 4.0

| Decision | Reason |
|---|---|
| Auth chrome-less `AuthLayout` | Login must not show app chrome |
| Login/changePassword via IPC only | Renderer never holds JWTs |
| Remember me controls CredentialStore write | Unchecked = memory refresh only |
| SessionView.mustChangePassword | Force-change gate without leaking tokens |
| Shell hosts for dialog/drawer/loading | Imperative overlays without per-page stacks |
| Domain module route map deferred to Phase 5 | Shell complete without business pages |
| Generic IPC API_INVOKE for domain REST | Single Main Axios path; no renderer JWT |
| Customer media via FileReference only | No invented customer image fields |
| Nav key customer.view (singular) | Match backend RBAC |

### 2026-07-29 — DS 2.7 + Shell 3.0 foundation

| Decision | Reason |
|---|---|
| Business widgets under `@/components/ui/business` | Shared presentation; features import barrel only |
| PermissionGuard + Gate thin wrap | Richer anyOf/allOf/disable without breaking Gate callers |
| StoredFileMeta parent `src` only | No MediaClient/HTTP in DS/shell phases |
| StatusChip vs StatusBadge | Chip for chrome/icons; Badge for dense tables |
| Shell in `layouts/shell` | Product chrome separate from DS primitives |
| Shell nav declarative + permission filters | UX-only; placeholders until module route map |

### 2026-07-29 — DS 2.5 / 2.6 gap-fill harden

| Decision | Reason |
|---|---|
| DEV `console.warn` when `virtualization.enabled` | Prevent silent fake scale assumptions |
| `notification` exported alias of `toast` | Checklist naming; one singleton store |
| LoadingOverlay vs ProgressOverlay stay split | Indeterminate vs determinate; no dual API |
| FilterBar dates as ISO `YYYY-MM-DD` | Serializable server filter payloads |
| Column order parent-owned; no drag UI | Avoid half-finished DnD surface |
| Companion `JUMAN_DECISIONS` + `JUMAN_CHANGELOG` | Agent-facing locks + product track log |

### Backend (historical — selected)

| Decision | Reason |
|---|---|
| Clean Architecture + DDD modules | 10-year maintainability |
| PostgreSQL system of record | Durability, constraints, concurrency |
| UUID + soft delete + audit | Traceability |
| Database-driven RBAC | Fail-closed permissions |
| Dress as serialized asset + state machine | Inventory integrity |
| Reservations store agreed daily price only | No fake totals |
| Settlement financial PAID ≠ operational complete | Clear lifecycle boundaries |

*(Full ADR set: `docs/ADR/` — do not duplicate every ADR here; log product-impacting choices as they ship.)*

---

## How to update this file (checklist)

After **every** approved phase completes:

1. Update **Last updated**, **Overall progress %**, **Current phase / step / next step**.
2. Refresh **Global progress** bars and table percentages.
3. Move **YOU ARE HERE**.
4. Check off completed items in **Master roadmap** (☑ / ◐ / ☐).
5. **Append** a dated block under **Completed this phase** (date, work, files, decisions, breaking changes).
6. **Append** new rows to **Decision log**.
7. Rewrite **Next phase** block for the upcoming work.
8. Never delete historical completed/decision entries — append only.

---

## Quick links

| Doc | Path |
|---|---|
| Project status snapshot | [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) |
| Changelog | [`CHANGELOG.md`](../CHANGELOG.md) |
| Decisions log | [`JUMAN_DECISIONS.md`](./JUMAN_DECISIONS.md) |
| Product track changelog | [`JUMAN_CHANGELOG.md`](./JUMAN_CHANGELOG.md) |
| Design system | [`frontend/docs/design-system.md`](../frontend/docs/design-system.md) |
| Backend release | [`docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md`](releases/BACKEND_PRODUCTION_READINESS_v1.0.md) |
| Frontend architecture | [`docs/frontend/architecture.md`](frontend/architecture.md) |

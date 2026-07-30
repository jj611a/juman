# Changelog — Juman (جمان)

All notable project milestones are recorded here.

## [Unreleased]

### Fixed — Phase 5.13 Frontend Visual QA & UX Polish

- Page gutter contract; disabled stub chrome; detail EntityHeader hierarchy; foundation/auth error polish.
- `docs/FRONTEND_VISUAL_AUDIT.md` (78/100). UI UX Pro Max skill vendored for checklist-only use.

### Added — Phase 5.11 Administration + 5.12 Audit & System

- Users, roles (permission matrix), settings; audit logs; system backups/restore/maintenance/health.
- Docs users/roles/settings/audit.md. Business Modules ~95%; YOU ARE HERE → Dashboard.

### Added — Phase 5.9 Sales + Settlements + 5.10 Reports

- Sales list/create/detail; Settlements outstanding/collect/adjust; Reports home + charts (recharts).
- Docs `sales.md` / `settlements.md` / `reports.md`. Business Modules ~85%; YOU ARE HERE → Dashboard/System Administration.

### Added — Phase 5.7 Returns + 5.8 Inspection/Processing

- Returns: list/wizard/detail via IPC; create from ACTIVE rental only; CTA to inspection.
- Processing hub: inspection CRUD/complete; laundry batches start/optional-day/complete; queue tabs.
- Docs rontend/docs/modules/returns.md / processing.md. Business Modules ~70%; YOU ARE HERE → Settlement/Sales.

### Added — Phase 5.5 Reservations + 5.6 Rentals Checkout

- Reservations: list/detail/wizard/edit; confirm/cancel/expire; calendar availability preview; convert CTA.
- Rentals checkout: walk-in + `reservationId` convert; payment FIXED_AMOUNT/PERCENTAGE; totals from API only.
- Docs `frontend/docs/modules/reservations.md` / `rentals.md`. Business Modules ~55%; YOU ARE HERE → Returns/Inspection/Processing.

### Added — Phase 5.3 Inventory + 5.4 Calendar

- Inventory (Dresses) feature: list/detail/create/edit, photos, barcode (Admin), status engine, audit, availability panel.
- Calendar feature: dress-centric Month/Week/Day timeline, block drawer, MAINTENANCE manage; availability from API only.
- Docs `frontend/docs/modules/inventory.md` / `calendar.md`. Business Modules ~42%; YOU ARE HERE → Reservations.

### Added — Phase 5.1 Categories + 5.2 Customers

- Generic Main IPC REST proxy (`API_INVOKE`); Categories + Customers feature modules (IPC-only, DS/shell reused).
- Customer media via FileReference + data URL download; audit timeline; unsaved-change confirms.
- Docs `frontend/docs/modules/categories.md` / `customers.md`. Business Modules ~22%; YOU ARE HERE → Inventory/Dresses.

### Added — Application Shell 3.1 + Authentication UI Phase 4.0

- Complete shell chrome (icons/badges/status bar/shortcuts/hosts/title); AuthLayout login + force-password via IPC; ProtectedRoute; docs + `#/dev/shell` / `#/dev/auth`.
- YOU ARE HERE → Phase 5 Business Modules UI.

### Added — Design System Phase 2.7 + Application Shell 3.0 foundation

- Shared business components (`MoneyDisplay`, `StatusChip`, `PermissionGuard`, media/barcode/entity chrome, …) under `@/components/ui`.
- Application shell foundation (`Sidebar`, `TopBar`, `Workspace`, …) under `@/layouts/shell`; product `AppShell` rewritten.
- Docs: `business.md`, `application-shell.md`; showcases `#/dev/business`, `#/dev/shell`. YOU ARE HERE → Phase 3 remaining.

### Fixed — Design System 2.5 / 2.6 gap-fill harden

- KPICard renders subtitle and trend together; FilterBar emits serializable ISO dates; DataTable DEV-warns on virtualization enable.
- Exported `notification` alias of `toast`; InlineMessage `aria-live`; extended data/feedback unit tests.
- Docs: `frontend/docs/components/data.md` / `feedback.md`; companion `docs/JUMAN_DECISIONS.md` + `docs/JUMAN_CHANGELOG.md`; roadmap + canvas synced. YOU ARE HERE remains Phase 2.7.

### Changed — Frontend Layout polish (Phase 2.4 follow-on)

- Expanded Page shell: `size`, `PageTitle` / `PageSubtitle` / `PageToolbar` / `PageFooter`; dual `PageHeader` API; `PageContent` loading/empty.
- Breadcrumb docs/showcase hardened (informational only; Home + ellipsis trails); `layout.md` updated.

### Added — Frontend Design System Phase 2.6 (Feedback)

- ToastProvider + imperative `toast` API (Radix; queue max 3; bottom-start; action button).
- Alert, InlineMessage, ConfirmationDialog (Dialog composition; Enter/Esc; danger + loading).
- LoadingOverlay, ProgressOverlay, BusyIndicator; Skeleton variants; EmptyState; ErrorState (DEV details).
- Expanded `#/dev/feedback`; docs `frontend/docs/components/feedback.md`.

### Added — Frontend Design System Phase 2.5 (Data)

- `createDataColumn` + controlled `DataTable` (TanStack wrapped; sorting/filters/pagination/selection/resize/visibility).
- SearchBar (debounced), FilterBar, Pagination; StatusBadge + `mapStatus`; KPICard; StatisticsCard.
- DropdownMenu + PermissionGate-aware row actions; shift-range selection helper; `#/dev/data`.
- Docs `frontend/docs/components/data.md`. Virtualization architecture-ready only (no virtualizer package).

### Added — Frontend Design System Phase 2.4 (Layout)

- Page shell (`Page` / `PageHeader` / `PageContent` / `PageActions`) + Container / Section / Stack / Grid.
- Card variants + Panel (toolbar / loading / empty); Dialog/Modal + Drawer/Sheet on Radix Dialog (default drawer `side="right"`).
- Tabs, Accordion, Collapsible, Breadcrumb; ResizablePanelGroup/Panel/Handle wrapping `react-resizable-panels`.
- Drawer size tokens `--drawer-sm`…`--drawer-xl`; DEV showcase `#/dev/layout`; docs `frontend/docs/components/layout.md`.

### Added — Frontend Design System Phase 2.3 (Forms)

- Form composition: `Form` / `FormField` / `FormSection` + RequiredMarker / HelpText / ValidationMessage (RHF + Zod).
- Domain inputs: SearchInput, MoneyInput (integer fils), PhoneInput (E.164 via PhoneService); NumberInput readOnly/loading.
- Overlays: Select, MultiSelect, Autocomplete, Popover, ScrollArea (Radix-wrapped).
- DatePicker + CalendarAdapter (Gregorian/date-fns); FilePicker, ImagePicker, ColorPicker.
- DEV showcase `#/dev/forms`; docs `frontend/docs/components/forms.md`.

### Added — Frontend Design System Phase 2.2 (Primitives)

- Juman-wrapped UI primitives on Radix (Checkbox, RadioGroup, Switch, Label, Progress, Separator, Avatar, Tooltip).
- Redesigned Button/IconButton (gold primary accent); Text/Password/Number/TextArea; Badge, Chip, Spinner, Divider.
- NumberInput LTR numeric editing with Arabic-Indic digit normalization (`normalizeDigits`).
- DEV showcase under `src/dev/` (`#/dev/all`, buttons, inputs, …); docs `frontend/docs/components/primitives.md`.
- Component tests: 41 frontend unit tests passing.

### Added — Frontend Design System Phase 2.1 (Tokens & Theme)

- Official single theme `juman-dark`: Premium Black / Dark / Gold (light/system removed).
- CSS token system + typed registry (`src/styles/tokens.css`, `src/theme/tokens.ts`); ThemeProvider.
- Lucide `Icon` wrapper; typography/spacing/radius/shadow/motion/z-index scales.
- Docs: `frontend/docs/theme.md`, `design-system.md`, `components.md`; DEV showcase `#/dev/design-tokens`.
- Tests: theme, tokens, icon (18 frontend unit tests total).

### Added — Frontend Foundation (Electron)

- Monorepo `frontend/` (pnpm workspace) — Electron Main/Preload + React/TS renderer; no business screens.
- IPC proxy API: renderer never imports Axios / never holds JWTs; refresh via Electron `safeStorage`.
- Arabic RTL shell, Zustand stores, TanStack Query, routing gates, Vitest foundation tests.
- Docs: `docs/frontend/architecture.md`, `folder_structure.md`, `state_management.md`, `desktop_architecture.md`.

### Certified — Backend Phase 6 (Production Validation & Release Readiness)

- Juman Backend **v1.0 Production Ready** — report `docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md`.
- Two-layer certification: Layer 1 full pytest **573 passed**, app coverage **95%**; Layer 2 Postgres cert **6 passed** on isolated `juman_validation_*`.
- Orchestrator `scripts/phase6_validate.py` + `scripts/phase6_db.py`; Alembic fresh/idempotent/bounded reverse cycle; `pg_dump` discovery for Windows installs (`resolve_pg_dump`).
- Version bump **0.1.0 → 1.0.0**.

### Added — System Administration Phase 5 (Audit & Security Integration)
- Normalized `backup_outcome` / `restore_outcome` / `maintenance_outcome` audit metadata; maintenance started audits; backup failure + download (EXPORT) audits; `audit_log_id` on backup terminal states.
- Backup history duration fields (`started_at` / `finished_at` / `duration_ms`) via Alembic `20260802_0033_system_backups_duration`.
- Inactive-role fail-closed in `role_has_permission`; docs `docs/SYSTEM_SECURITY.md`.

### Added — System Administration Phase 4 (Maintenance & Diagnostics)
- Live verify/cleanup maintenance tasks with `POST /system/maintenance/tasks/{task_key}/execute`, history APIs, and `system_maintenance_runs`.
- `GET /system/metrics` and extended diagnostics (backup storage, restore readiness, disk usage, app runtime).
- Alembic `20260801_0032_system_maintenance_runs`; docs `docs/MAINTENANCE_AND_DIAGNOSTICS.md`.
- Global maintenance lock with mutual exclusion vs backup/restore `RUNNING`.


### System Administration — Phase 3 (Restore Engine)

- Validate and apply `.juman` packages by `backup_id` or multipart upload under `/api/v1/system/restore*` (`system.restore`).
- Mandatory verified pre-restore safety backup; sync in-place apply (Postgres `psql` / SQLite); automatic safety rollback on apply failure.
- Alembic exact-match compatibility; confirmation gate (`confirm` + `confirm_checksum`); history table `system_restores`.
- Mutual exclusion with Backup Engine RUNNING; audit via `CUSTOM` + `restore_outcome` metadata.
- Alembic `20260731_0031_system_restores`; docs `docs/RESTORE_ENGINE.md`.


### System Administration — Phase 2 (Backup Engine)

- Local versioned .juman ZIP packages (manifest, metadata, database.dump, checksum.sha256, optional media/).
- Postgres via pg_dump plain SQL; SQLite iterdump for tests; settings ackup.storage_root / ackup.include_media_default.
- APIs under /api/v1/system/backups (system.backup): create (sync), list, get, download, soft-delete; concurrent create → 409.
- History table system_backups; audit on successful create and delete; no restore.
- Alembic 20260730_0030_system_backups; docs docs/BACKUP_ENGINE.md.

## 2026-07-28

### System Administration (Phase 1)

- New module `app/modules/system_admin` — admin-only system info, diagnostics, maintenance framework.
- Permissions `system.view|maintenance|backup|restore` (Admin); Phase 1 routes use `system.view` only.
- Public `/health` and `/version` unchanged; lifespan tracks `started_at`.
- Alembic `20260729_0029_system_admin`; docs `docs/SYSTEM_ADMINISTRATION.md`; coverage >=95%.
- Explicitly out of scope: backup/restore/execute maintenance.

### Reports

- New module `app/modules/reports` — read-only operational and financial JSON reports.
- Dashboard / inventory / rentals / reservations / customers / inspections / processing / sales / financial.
- Permissions: `reports.view` + `reports.financial.view` (Cashier+Admin); Inventory ops-only.
- Half-open date ranges; Baghdad business days → UTC; max 366 days; frozen historical prices.
- Alembic `20260729_0028_reports`; docs `docs/REPORTS.md`; Reports coverage >=95%.
- Dependency: `tzdata` for ZoneInfo on Windows.

### Sales

- New module `app/modules/sales` — atomic COMPLETED sales (normal + mandatory damage purchase).
- Normal sale of AVAILABLE dresses; mandatory path for RUINED_PENDING_SALE from Inspection major damage.
- Full payment required; price snapshot; optional override via `allow_manual_sale_price_override`.
- Future confirmed reservation calendar guard (sale_blocked_by_future_reservation).
- Numbered SAL-########; permissions sale.view|create; Status Engine → SOLD.
- Alembic 20260728_0027_sales; docs SALES.md; Sales coverage >=95%.

### Full backend integration audit

- Executed complete pytest suite: **385 passed**, 0 failed; app coverage **93%**.
- Verified Alembic chain on isolated PostgreSQL `juman_audit` (fresh upgrade, idempotent re-upgrade, bounded downgrade/upgrade round-trip).
- Decision: **READY TO CONTINUE WITH DOCUMENTED RISKS** — see `docs/FULL_BACKEND_INTEGRATION_AUDIT.md`.
- Docs fix: `backend/docs/setup.md` Alembic head + Identity authentication notes.

### Rental Financial Settlement

- New module `app/modules/settlements` — post-return OPEN → PARTIALLY_PAID → PAID.
- Late penalty (`ceil` seconds/86400), minor-damage lines, initial payment as credit; no refunds/void/Sales.
- Financial PAID does not complete rental or change dress status.
- Alembic `20260728_0026_settlements`; docs `RENTAL_FINANCIAL_SETTLEMENT.md`; coverage ≥95%.

### Processing

- New module `app/modules/processing` — PENDING → IN_PROCESS → COMPLETED laundry workflow.
- Mandatory/optional processing days via Settings; Calendar `PROCESSING` blocks; related RENTAL truncate on start.
- Status Engine exit `PROCESSING → AVAILABLE`; severe damage rejected.
- Alembic `20260728_0025_processing`; docs `PROCESSING.md`; coverage ≥95%.

### Inspection

- New module `app/modules/inspection` — PENDING scaffold → COMPLETED condition assessment.
- Conditions GOOD / MINOR_DAMAGE / MAJOR_DAMAGE; repair penalty recorded not collected.
- Status Engine: `INSPECTION → AVAILABLE|PROCESSING|RUINED_PENDING_SALE`; new dress status `RUINED_PENDING_SALE`.
- Return → `INSPECTION_COMPLETED`; calendar untouched.
- Alembic `20260728_0024_inspection`; docs `INSPECTION.md`; coverage ≥95%.

### Returns

- New module `app/modules/returns` — full receipt of ACTIVE rental → `PENDING_INSPECTION`.
- Status Engine `RENTED → INSPECTION`; rental `ACTIVE → RETURN_PENDING`; calendar untouched.
- Numbered `RET-########`; permissions `return.view` / `return.create` (Cashier + Laundry).
- Alembic `20260728_0023_returns`; docs `RETURNS.md`; Returns coverage ≥95%.

## 2026-07-27

### Rentals

- New module `app/modules/rentals` — Active handover (walk-in or from Confirmed reservation).
- Estimated total + FIXED_AMOUNT/PERCENTAGE initial payment; remaining balance **derived** (not stored).
- Calendar `RENTAL` blocks + Status Engine `AVAILABLE/RESERVED → RENTED`; reservation → `CONVERTED_TO_RENTAL`.
- Cancel always Arabic ValidationError after cancel-attempt audit; notes-only PATCH.
- Alembic `20260727_0021_rentals`, `20260728_0022_rentals_align`; docs `RENTALS.md`; Rentals coverage ≥95%.

### Reservations

- New module `app/modules/reservations` with Draft → Confirm / Cancel / Expire lifecycle.
- Confirm uses Calendar (`RESERVATION` blocks) + Status Engine (`AVAILABLE → RESERVED`); cancel/expire reverse.
- Numbered `RSV-########`; agreed daily rental price snapshot per item; no totals/payments.
- Conversion owned by Rentals (`mark_converted_to_rental`); `convert_to_rental()` points callers to POST /rentals.
- Alembic `20260727_0020_reservations`; docs `RESERVATIONS.md`; Reservations coverage ≥95%.

### Calendar Engine

- New module `app/modules/calendar` with `DressCalendarBlock` timelines (RESERVATION/RENTAL/PROCESSING/MAINTENANCE).
- Overlap conflict detection (abutting allowed); `is_available` / timeline / `next_available_date`.
- APIs under `/api/v1/calendar/*` with `calendar.view` / `calendar.manage`; no dress status coupling.
- Alembic `20260727_0019_calendar`; docs `CALENDAR_ENGINE.md`; Calendar coverage ≥95%.

### Inventory / Dresses — Phase 5 (Search & Filtering)

- Expanded `GET /dresses` with rich filters (prices, dates, `is_active`, exact `barcode`, partial brand/`q` incl. description + category names).
- Page-based meta: `page`, `page_size`, `total`, `pages` (`DressSearchMeta`).
- Sort allowlist: barcode, name_ar, category, prices, created_at, updated_at.
- Alembic `20260727_0018_dress_search`; Inventory coverage ≥95%; docs `DRESS_ASSET_MODULE.md`.

## 2026-07-26

### Inventory / Dresses — Phase 4 (Status Engine)

- `DressStatusService` sole writer of `dresses.status`; CRUD create/update no longer accept `status`.
- Phase 4 transition graph (`AVAILABLE`/`RESERVED`/`RENTED`/`INSPECTION`/`PROCESSING`/`SOLD`/`RUINED`); `RETURNED` retained in enum but rejected.
- `POST /dresses/{id}/status` (`inventory.update`) returns previous/new status + allowed transitions.
- Audit `status_changed` with optional reason; no history table.
- Inventory coverage ≥95%; docs `DRESS_ASSET_MODULE.md`.

### Inventory / Dresses — Phase 3 (Photo Management)

- `DressPhoto` links Dress → Media `StoredFile` (no Inventory bytes; no Media `FileReference` dual-write).
- APIs: list/attach under `/dresses/{id}/photos`; reorder/cover; patch/delete under `/dress-photos/{id}`.
- Cover uniqueness (service clear + partial unique); soft-delete reference only; MIME must be allowed `image/*`.
- Audit: `photo_added`, `photo_removed`, `cover_changed`, `gallery_reordered`.
- Alembic `20260726_0017_dress_photos`; Inventory coverage ≥95%; docs `DRESS_ASSET_MODULE.md`.

### Customers module — v2 (numbered customers)

- Immutable auto-generated `customer_number` (`CUS-00000001`) via `CustomerNumberService` + settings `customers.number.*`.
- Added `alternative_phone`, `gender`, `birth_date`; national ID digits 8–20; sort/search by number/name/phone/created_at.
- `GET /customers/number/{customer_number}`; lifetime uniqueness (incl. soft-deleted).
- Alembic `20260726_0016_customers_v2`; docs `CUSTOMER_MODULE.md`; Customers coverage ≥95%.

### Inventory / Dresses — Phase 2 (Barcode Engine)

- `BarcodeService` with `generate_next` / `validate` / `format` / `parse` / `exists`.
- Settings `inventory.barcode.prefix|separator|padding` (legacy `barcode_prefix` / `barcode_length` migrated away).
- `barcode_counters` + `SELECT FOR UPDATE`; dress `barcode` NOT NULL; lifetime uniqueness (incl. soft-deleted).
- Auto-generate on `POST /dresses`; `GET /dresses/barcode/{barcode}`; Admin-only `PATCH /dresses/{id}/barcode`.
- Audit actions `barcode_generated` / `barcode_changed` / `barcode_manual_override`.
- Alembic `20260726_0015_dress_barcodes`; Inventory coverage ≥95%; docs updated.

### Inventory / Dresses — Phase 1 (Asset Core)

- `Dress` serialized asset model on `AuditedSoftDeleteModel` (barcode, category FK RESTRICT, size/colour allowlists, IQD BigInteger prices, stored status).
- APIs: CRUD + activate/deactivate + search/filter/sort/pagination under `/api/v1/dresses`.
- Permissions: existing seeded `inventory.view|create|update|delete`; AuditService on mutations.
- Category soft-delete now counts live dresses (blocks delete when referenced).
- Alembic `20260726_0014_dresses`; Inventory tests ≥90% coverage; docs `DRESS_ASSET_MODULE.md`.

### Customers module

- `Customer` model (required `full_name` + `phone`, optional address/national_id/notes, `is_active`) on `AuditedSoftDeleteModel`.
- Duplicate phones allowed; soft delete only; activate/deactivate supported.
- APIs: CRUD + activate/deactivate + search (`q` on name/phone/national_id) + pagination under `/api/v1/customers`.
- Permissions: existing seeded `customer.view|create|update|delete`; AuditService records all mutations.
- Alembic `20260726_0013_customers`; Customers tests ≥90% coverage.

### Categories module

- `Category` model (`name_ar`, optional `name_en`, description, display_order, is_active) on `AuditedSoftDeleteModel`.
- Partial unique index on live `name_ar`; soft-delete blocked when live dress references > 0.
- APIs: CRUD, activate/deactivate, list with `active_only` / search / sort / pagination under `/api/v1/categories`.
- Permissions: `categories.view|create|update|delete` (already seeded); AuditService records create/update/activate/deactivate/soft_delete.
- Alembic `20260726_0012_categories`; Categories tests ≥90% coverage.

### Audit module

- Append-only `audit_logs` table (module, entity_type, entity_id, action, old/new values, user, IP, metadata, timestamp).
- `AuditService.record` / `record_create` / `record_update` / `record_delete` for future domain modules.
- Admin read APIs: `GET /api/v1/audit/logs`, `GET /api/v1/audit/logs/{id}` behind `audit.view`.
- Alembic `20260726_0011_audit` (+ Admin permission seed). Existing modules not wired yet.
- Audit tests ≥90% coverage of `app/modules/audit`.

### Identity Phase 7 — application authentication

- Added HTTP auth: `POST /api/v1/login|refresh|logout|logout-all`, `GET|PATCH /api/v1/me`.
- Login orchestrates `AuthenticationService` + `SessionService.create_session`; generic Arabic 401 on failure.
- Protected Settings, RBAC, Media, and Users with fail-closed `require_permission*`.
- Extended force-change allowlist: change-password, sessions, logout, logout-all, **GET** `/me` (PATCH `/me` blocked).
- No new Alembic migration for Phase 7.
- Full backend pytest suite green; Identity coverage ≥90%.

### Identity Phase 6 — password lifecycle

- `PasswordHistory`, `PasswordService` (strength / reuse / history / expiry).
- `POST /change-password`, `POST /admin/reset-password`; force-change gate in `get_current_user`.
- Alembic `20260726_0010_password_history` (+ `password_expire_days` setting).

### Identity Phase 5 — login history

- Append-only `LoginHistory`; recording for login fail/success, logout, lock, password reset.
- Admin `GET /login-history` and `GET /users/{id}/login-history` behind `users.view_login_history`.
- Alembic `20260726_0009_login_history`.

### Identity Phase 4 — sessions

- `LoginSession` owns device/IP; refresh bound via `session_id`; Bearer `get_current_user` with JWT `sid`.
- `GET/DELETE /sessions`; Remember Me via `remember_me_refresh_token_expire_days`.
- Alembic `20260726_0008_login_sessions`.

### Identity Phase 3 — JWT / refresh tokens

- Opaque hashed `RefreshToken`, `TokenService` (issue / validate / rotate / revoke).
- Settings TTLs; no HTTP login yet in this phase.
- Alembic `20260726_0007_refresh_tokens`.

### Identity Phase 2 — authentication engine

- Added `AuthenticationService` (authenticate / verify / failed-attempt / lockout) with `AuthenticationResult` (no tokens).
- Reads lockout and password policy from Settings; restored `users.locked_until` via `20260726_0006_auth_engine`.
- No HTTP login, JWT, sessions, or refresh tokens in this phase.

### Identity Phase 1 — User domain reshape

- Reshaped Identity to **User domain only** (no auth/JWT/sessions/refresh/login history).
- Singular required `users.role_id` FK to RBAC `roles` (removed `user_roles` M2M).
- Alembic `20260726_0005_identity_phase1` (migrate role, drop auth tables).
- User CRUD APIs under `/api/v1/users`; auth dependencies prepared but not enforced.
- Settings/RBAC/Media route guards deferred until auth phase (fail-closed stubs remain).
- Identity Phase 1 tests ≥90% coverage.

### Foundation Version 0.1 — integration verification

- Verified Settings, RBAC, Identity, Media, Alembic, security, and test suite together.
- Fixed Alembic seed SQL for asyncpg (`:key` reused in `INSERT … SELECT … WHERE` caused `AmbiguousParameterError` on fresh PostgreSQL).
- Migration cycle confirmed: upgrade → upgrade (idempotent) → downgrade base → upgrade head.
- Documentation refreshed to include Media and current module graph.

### Media module

- Implemented business-agnostic Media: `StoredFile`, `FileReference`, local storage provider, cloud stubs.
- Alembic `20260726_0004_media` (tables, media settings seeds, `media.*` permissions).
- Generic `/api/v1/media` APIs (upload/download/replace/delete + reference CRUD).
- Media tests ≥90% coverage of `app/modules/media`.

### Identity module (superseded narrative — see Phases 1–7 above)

- Earlier combined Identity delivery notes are superseded by the phased rebuild (Phases 1–7).

### Architecture decision records

- Added MADR-based ADR system under `docs/ADR/` (template, index, ADRs 0000–0015 covering foundation and domain decisions already accepted).

### Foundation verification (earlier release candidate)

- Completed engineering review of the backend foundation (pre-Identity).
- Documentation refreshed (`docs/setup.md`, `docs/structure.md`, `docs/architecture.md`).
- Added `PROJECT_STATUS.md` and this `CHANGELOG.md`.
- Decision at that time: **READY FOR NEXT MODULE** → Users (completed).

### Architecture cleanups

- Consolidated permission helpers under the RBAC module (removed duplicate `security/permissions.py`).
- Settings seeding owned solely by Alembic (removed `defaults.py` + runtime `ensure_defaults`).
- Production startup aborts on insecure/missing `SECRET_KEY` and related misconfiguration.
- Dead-code cleanup (unused helpers/constants/DI stubs).

### Modules completed earlier today

- Backend Foundation (Clean Architecture, FastAPI, async SQLAlchemy, Alembic, JWT/Argon2 helpers, logging, exceptions, health/version).
- Settings module (model, CRUD, validation, Alembic seeds, tests).
- RBAC module (Permission, Role, RolePermission, system roles, permission catalog, CRUD, assignment APIs, fail-closed guards, tests).

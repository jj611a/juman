# Juman Changelog (product track)

Focused companion changelog for roadmap-facing work. Root [`CHANGELOG.md`](../CHANGELOG.md) remains the full project log.

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
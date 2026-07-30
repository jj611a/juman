# Juman Decisions Log

Append-only product / frontend decisions. Full ADRs live under `docs/ADR/`.  
Companion to [`JUMAN_MASTER_ROADMAP.md`](./JUMAN_MASTER_ROADMAP.md) and the live roadmap canvas.

**Last updated:** 2026-07-30

---

## How to use

- Append new rows; never rewrite history.
- Prefer a short decision + reason. Link ADR when one exists.
- Keep Design System / UI API locks here so agents update the canvas + roadmap consistently.

---

## Design System locks (frontend)

| Date | Decision | Reason |
|---|---|---|
| 2026-07-29 | Radix only behind `@/components/ui` | A11y headless; features never import Radix |
| 2026-07-29 | Drawer default `side="right"`; Sheet = Drawer | Arabic desktop detail editors |
| 2026-07-29 | Money as integer fils | No float currency; IQD precision |
| 2026-07-29 | DataTable controlled-first; hide TanStack | Server-ready tables; swappable engine |
| 2026-07-29 | Breadcrumbs informational only | Sidebar remains primary nav |
| 2026-07-29 | Toast max 3, bottom-start | Desktop queue; RTL logical placement |
| 2026-07-29 | Virtualization architecture-ready only | Avoid premature `@tanstack/react-virtual` |
| 2026-07-29 | DEV warn when `virtualization.enabled` | Prevent silent fake scale assumptions |
| 2026-07-29 | `notification` alias of `toast` | Checklist naming; same singleton store |
| 2026-07-29 | LoadingOverlay vs ProgressOverlay split | Indeterminate vs determinate; no dual API |
| 2026-07-29 | FilterBar dates as ISO `YYYY-MM-DD` | Serializable server filter payloads |
| 2026-07-29 | Column order parent-owned (no drag UI) | Avoid half-finished DnD surface |
| 2026-07-29 | Single theme `juman-dark`; no light/system | Premium Black/Dark/Gold constitution |
| 2026-07-29 | Gold accent ~2% of UI only | Luxury desktop; never large gold surfaces |
| 2026-07-29 | Renderer never Axios / never JWT | IPC Main owns HTTP + tokens |
| 2026-07-29 | PermissionGate is UX-only | Authorization stays on API / Main |
| 2026-07-29 | Generic `API_INVOKE` IPC | One Main Axios path |
| 2026-07-29 | Customer images via FileReference | No fake DTO fields |
| 2026-07-29 | Nav `customer.view` singular | Match RBAC |
| 2026-07-29 | List `sort_dir` param | Match backend |
| 2026-07-29 | No module DEV showcases | Real app pages only |
| 2026-07-29 | No DEV showcase for Categories/Customers | Real app pages only |
| 2026-07-30 | Dress list `page`/`page_size` + `sort_by`/`sort_dir` | Match Inventory API (not offset/limit) |
| 2026-07-30 | Inventory perms `inventory.*` (not `dress.*`) | Match RBAC seed |
| 2026-07-30 | Dress status display-only; change via `POST .../status` | Status Engine is sole authority |
| 2026-07-30 | Dress photos via `/dresses/{id}/photos` + media upload | Not Customer FileReference primary |
| 2026-07-30 | Calendar UI dress-centric only | No store-wide month API |
| 2026-07-30 | Availability only from calendar endpoints | Never recompute overlaps in FE |
| 2026-07-30 | Calendar manage creates MAINTENANCE only | No fake reservation/rental via calendar |
| 2026-07-30 | Features under `src/features/{inventory,calendar}` | Same layout as categories/customers |
| 2026-07-30 | Reservation/Rental list `offset`/`limit` | Match API (not page/page_size) |
| 2026-07-30 | Perms `reservation.*` / `rental.*` singular | Match RBAC |
| 2026-07-30 | Confirm uses `reservation.update` | No separate confirm perm |
| 2026-07-30 | Availability only on confirm; drafts may overlap | Calendar Engine lock point |
| 2026-07-30 | Convert via `POST /rentals` + `reservation_id` | No reservations convert route |
| 2026-07-30 | Rental totals only from create/get response | No quote endpoint; no FE math |
| 2026-07-30 | No working rental cancel in UI | Always 422; Returns owns reverse |
| 2026-07-30 | Feature-local wizard steps (no DS Wizard) | Reuse Form/DatePicker/MoneyInput |
| 2026-07-30 | Returns create-only (no PATCH/cancel) | Match Returns API v1 |
| 2026-07-30 | Inspection + Processing live under processing feature | Single nav hub المعالجة |
| 2026-07-30 | Return wizard stops at POST /returns | Inspection/settlement separate |
| 2026-07-30 | Rental money trio read-only on return review | No FE settlement math |
| 2026-07-30 | Dashboard queues map to API status filters | No invented Cleaning/Repair HTTP queues |
| 2026-07-30 | Processing window dates from API only | No client day math |
| 2026-07-30 | Nav المعالجة anyOf inspection.view/processing.view | Either unlocks hub |
| 2026-07-30 | No inspection/processing photo upload | Dress gallery view-only via inventory |
| 2026-07-30 | Recharts is official Juman v1 chart library | React-first; theme via DS tokens |
| 2026-07-30 | No standalone Payments FE module | Payments nested on sale/settlement DTOs |
| 2026-07-30 | Settlement outstanding via status filters | No dedicated outstanding endpoint |
| 2026-07-30 | Report charts sparse / no zero-fill | financial/daily authoritative |
| 2026-07-30 | Export/print placeholders only | No export API in v1 |
| 2026-07-30 | Features under sales / settlements / reports | Match backend module split |
| 2026-07-30 | No account unlock UI | users.unlock seeded; no HTTP route |
| 2026-07-30 | Role permissions via assign/remove only | PUT role is metadata only |
| 2026-07-30 | Settings security/media/backup via system key prefixes | No invented categories |
| 2026-07-30 | Audit export placeholder only | No audit export API |
| 2026-07-30 | System production readiness from diagnostics | No production-status endpoint |
| 2026-07-30 | Ops Dashboard deferred after Admin/System | Roadmap split 5.11/5.12 vs Dashboard |
| 2026-07-29 | Business widgets in `@/components/ui/business` | Shared presentation; barrel export |
| 2026-07-29 | PermissionGuard (anyOf/allOf/hide/disable); Gate wraps Guard | Backward-compatible Gate; richer UX |
| 2026-07-29 | StatusChip for chrome; StatusBadge for tables | Avoid duplicate tone systems |
| 2026-07-29 | StoredFileMeta parent-supplied `src` | Never fetch/upload in components |
| 2026-07-29 | Shell under `layouts/shell`; placeholders only | No login/dashboard/module routes yet |
| 2026-07-29 | Resizable sidebar uses `%` panel sizes | react-resizable-panels v4 footgun |
| 2026-07-29 | AuthLayout chrome-less for login/force-pw | Shell only after auth |
| 2026-07-29 | auth.login/changePassword IPC; no renderer JWT | Constitution IPC proxy |
| 2026-07-29 | Remember me → CredentialStore; else memory refresh | Explicit persistence |
| 2026-07-29 | SessionView.mustChangePassword | Force-change UX gate |
| 2026-07-29 | Global Loading/Dialog/Drawer hosts | Single overlay stack with Toast |
| 2026-07-29 | Domain module routes deferred to Phase 5 | Shell done without business pages |
| 2026-07-29 | Generic IPC `API_INVOKE` (JSON/multipart/binary data URL) | One Main Axios path; features never Axios |
| 2026-07-29 | Feature modules under `src/features/{categories,customers}` | api/hooks/pages; DS composition only |
| 2026-07-29 | Customer images via Media FileReference only | No fake customer image columns |
| 2026-07-29 | Nav permission `customer.view` (singular) | Match backend RBAC key |
| 2026-07-29 | List sort query param `sort_dir` | Match backend (not docs’ sort_order) |

| 2026-07-30 | Page gutter: AppShell `p-6` only; Page no horizontal padding | Prevent double gutters |
| 2026-07-30 | Stub TopBar actions disabled + قريبًا (no toast) | Consistent incomplete chrome |
| 2026-07-30 | Detail pages: EntityHeader primary; drop duplicate PageHeader title | Hierarchy clarity |
| 2026-07-30 | UI UX Pro Max checklist only; Juman DS wins | No palette/font/theme takeover |
| 2026-07-30 | UI UX Pro Max at `.cursor/skills/ui-ux-pro-max/` (+ `.cursor/commands/ui-ux-pro-max.md`) | Cursor skills layout; not ~/.cursor/skills-cursor |
| 2026-07-30 | Visual QA Phase 5.13; no screenshot CI | Tooling not present |
| 2026-07-30 | Hardware adapters in Electron Main; station config in userData | Per-PC devices; backend barcode/media only |
| 2026-07-30 | No vendor printer SDKs; ESC/POS RAW via Windows spool | Long-term maintainability |
| 2026-07-30 | Network ESC/POS interface stubbed (not live send) | Future-ready without fake success |
| 2026-07-30 | Installer bundles official PostgreSQL (1A) | One installer; standard Windows PG service |
| 2026-07-30 | Backend shipped as juman-api.exe + WinSW (2A) | No Python runtime on store PCs |
| 2026-07-30 | Electron never starts PostgreSQL; diagnose JumanApi only | Correct Windows service boot order |
| 2026-07-30 | Cloud auto-update stub only (`implemented: false`) | Prepare infra; no CDN yet |
| 2026-07-30 | Ops home `/` uses DashboardReportDto KPIs only | No invented financial/returns KPIs |
| 2026-07-30 | Today work = counts + route links | No row lists on dashboard API |
| 2026-07-30 | TCP ESC/POS network print in Electron Main | Close hardware residual; no renderer sockets |
| 2026-07-30 | Saved network targets + active id (not full profile CRUD) | Additive to flat station config |
| 2026-07-30 | PrintService thin USB/network router | Single send path for receipt/label/drawer |
| 2026-07-30 | Phase 7.0 fetch/build binaries at package time | Do not commit PG/WinSW/juman-api.exe |
| 2026-07-30 | Install-time random secrets + migrate CLI | Production installer security + schema |
| 2026-07-30 | First-run persists before firstrun.done | Durable company/admin/storage/timezone |

## Related

- [`docs/ADR/`](./ADR/)
- [`docs/JUMAN_MASTER_ROADMAP.md`](./JUMAN_MASTER_ROADMAP.md)
- [`docs/JUMAN_CHANGELOG.md`](./JUMAN_CHANGELOG.md)

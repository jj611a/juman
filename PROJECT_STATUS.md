# Project Status — Juman (جمان)

**Master roadmap (source of truth):** [`docs/JUMAN_MASTER_ROADMAP.md`](docs/JUMAN_MASTER_ROADMAP.md) — update after every approved phase. **Live canvas:** [Juman Master Roadmap](C:\Users\moham\.cursor\projects\c-Users-moham-Desktop-juman\canvases\juman-master-roadmap.canvas.tsx)

**Last updated:** 2026-07-29  
**Release:** **Juman Backend v1.0 Production Ready** — report [`docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md`](docs/releases/BACKEND_PRODUCTION_READINESS_v1.0.md)  
**Latest audit:** Full backend integration audit — **READY TO CONTINUE WITH DOCUMENTED RISKS** ([`docs/FULL_BACKEND_INTEGRATION_AUDIT.md`](docs/FULL_BACKEND_INTEGRATION_AUDIT.md)); superseded for release readiness by Phase 6 GO  
**Identity module:** Phases 1–7 complete (application authentication live)  
**Audit module:** Complete (Categories, Customers, Dresses, Calendar, Reservations, Rentals, Returns, Inspection, Processing, Settlements, Sales write audit rows)  
**Categories module:** Complete  
**Customers module:** Complete (v2 — numbered customers)  
**Inventory / Dresses:** Phase 1–5 complete (asset + barcode + photos + status + search)  
**Calendar Engine:** Complete (dress timeline / availability)  
**Reservations:** Complete (draft / confirm / cancel / expire + convert via Rentals)  
**Rentals:** Complete (v1 handover — walk-in + from reservation; cancel stub; derived remaining balance)  
**Returns:** Complete (v1 full receipt → PENDING_INSPECTION; calendar untouched)  
**Inspection:** Complete (v1 condition assessment → AVAILABLE / PROCESSING / RUINED_PENDING_SALE)  
**Processing:** Complete (v1 laundry — mandatory/optional days → AVAILABLE)  
**Rental Settlement:** Complete (v1 post-return financial settlement → PAID)  
**Sales:** Complete (v1 atomic dress sales → SOLD)  
**Reports:** Complete (v1 read-only ops + financial JSON)  
**System Administration:** Phase 1–5 complete + Phase 6 production certification  
**Alembic HEAD:** `20260802_0033_system_backups_duration`  
**Backend version:** `1.0.0`

---

## Overall

| Area | Status | Progress |
|---|---|---|
| Backend Foundation | Complete | 100% |
| Settings | Complete (auth-protected) | 100% |
| RBAC | Complete (auth-protected) | 100% |
| Media | Complete (auth-protected) | 100% |
| Users / Identity | Phases 1–7 complete | 100% |
| Audit | Complete (infra + domain writes) | 100% |
| Categories | Complete (auth-protected + audited) | 100% |
| Customers | Complete v2 (numbered, auth-protected + audited) | 100% |
| Inventory / Dresses | Phase 1–5 complete (asset + barcode + photos + status + search) | ~90% |
| Calendar Engine | Complete (timeline + conflicts + availability) | 100% |
| Reservations | Complete (draft/confirm via Calendar + Status) | 100% |
| Rentals | Complete (v1 handover + initial payment) | 100% |
| Returns | Complete (v1 receipt → inspection handoff) | 100% |
| Inspection | Complete (v1 condition assessment) | 100% |
| Processing | Complete (v1 laundry / readiness) | 100% |
| Payments / Settlement | Complete (v1 rental settlement; POS later) | 100% |
| Sales | Complete (v1 atomic dress sales) | 100% |
| Reports | Complete (v1 read-only reporting) | 100% |
| System Administration | Phase 1–5 complete + Phase 6 certified | 100% |
| Remaining domain modules | Notifications | ~0% |
| Electron frontend | Foundation + DS Phase 2.1–2.6 (tokens through feedback) | ~70% |

---

## Completed

- **Frontend Foundation** — Electron + React + TypeScript (pnpm); Main-owned JWT/HTTP IPC proxy; Arabic RTL shell; docs `docs/frontend/`

- **Frontend Design System Phase 2.1** — Official Premium Black/Dark/Gold tokens (`juman-dark` only); ThemeProvider; Lucide `Icon` wrapper; docs `frontend/docs/`; DEV tokens showcase `#/dev/design-tokens`

- **Frontend Design System Phase 2.2** — Primitive kit (`@/components/ui`): Button/IconButton, inputs, selection, display, Spinner/Progress/Divider/Tooltip; DEV showcase `#/dev/*`; docs `frontend/docs/components/primitives.md`

- **Frontend Design System Phase 2.6** — Feedback kit: ToastProvider/toast queue, Alert, ConfirmationDialog, Loading/Progress overlays, BusyIndicator, Skeleton, EmptyState, ErrorState, InlineMessage; `#/dev/feedback`; docs `frontend/docs/components/feedback.md`

- **Frontend Design System Phase 2.5** — Data kit: `createDataColumn` + DataTable (controlled); SearchBar/FilterBar/Pagination; StatusBadge/KPI/Statistics; DropdownMenu row actions + PermissionGate; `#/dev/data`; docs `frontend/docs/components/data.md`

- **Frontend Design System Phase 2.4** — Layout kit: Page/Container/Stack/Grid/Card/Panel; Dialog/Modal/Drawer/Sheet (Radix); Tabs/Accordion/Collapsible/Breadcrumb; Resizable wrappers; `#/dev/layout`; docs `frontend/docs/components/layout.md`

- **Frontend Design System Phase 2.3** — Form layer (RHF/Zod), Select/MultiSelect/Autocomplete, Money (fils)/Phone (E.164), DatePicker (Gregorian adapter), File/Image/Color pickers; `#/dev/forms`; docs `frontend/docs/components/forms.md`

- Clean Architecture + DDD modular packaging
- FastAPI + async SQLAlchemy + Alembic + PostgreSQL
- Settings, RBAC, Media, Identity Phases 1–7
- Audit module — append-only `audit_logs`
- Categories module — organizational labels with audit
- **Customers v2** — immutable `CUS-########`, alt phone / gender / birth date, sort/search, `customer.*` permissions
- **Inventory Phase 1–5** — Dress assets + BarcodeService + DressPhoto + DressStatusService + search API
- **Calendar Engine** — `DressCalendarBlock` timelines, overlap conflicts, availability APIs
- **Reservations** — Draft/Confirm/Cancel/Expire; `RSV-########`; Calendar blocks + Status Engine; agreed daily price snapshot
- **Rentals** — Walk-in / from Confirmed reservation; `RENT-########`; estimated total + initial payment; Calendar `RENTAL` + Status `RENTED`; cancel stub
- **Returns** — Full receipt of ACTIVE rental; `RET-########`; Status `RENTED → INSPECTION`; rental `RETURN_PENDING`; calendar untouched
- **Inspection** — Condition assessment; penalties recorded not collected; Status `AVAILABLE` / `PROCESSING` / `RUINED_PENDING_SALE`
- **Processing** — Laundry batches; mandatory/optional days; Calendar `PROCESSING`; Status `→ AVAILABLE`
- **Rental Settlement** — Post-return `STL-########`; late + minor damage; payments/adjustments; financial PAID ≠ operational complete
- **Sales** — Normal + mandatory damage purchase; `SAL-########`; atomic full payment; `AVAILABLE|RUINED_PENDING_SALE → SOLD`
- **Reports** — Read-only dashboard/inventory/rentals/reservations/customers/inspection/processing/sales/financial; `reports.view` + `reports.financial.view`
- **System Administration Phase 1–5** — `/system/*` ops + audit/security integration; Backup + Restore + Maintenance; inactive-role fail-closed
- Unified exception handling, structured logging, health/version APIs

---

## Next

Frontend Phase 2.7 (shared business components); Notifications; general POS (`payment.*`); `RUINED` write-off without sale (Inventory/Admin); Frontend login screen + first business modules.

Tracked residual risks: RBAC seed reproducibility (migration imports live defaults); `RentalService.cancel()` mid-request commit exception; Postgres concurrent settlement payment proof.

---

## Decision

Customers remain independent of transaction modules. Permissions stay singular `customer.*`. Customer numbers are never regenerated via API.
Reservations never store calculated totals — only agreed daily rental price per item.
Rentals v1 records estimated total + initial payment only; remaining balance is derived; cancel after handover is rejected (with audit) until Returns.
Returns v1 does not collect payments, remove calendar blocks, or inspect dresses.
Inspection v1 does not collect money, run laundry, or complete forced purchase.
Processing v1 does not cancel batches, collect money, or complete sales.
Settlement v1 does not refund, void, sell ruined dresses, or flip rental/dress operational completion.
Sales v1 does not refund, void, write off without purchase (`RUINED`), or implement general POS.
Reports v1 does not mutate domain data, export PDF/CSV, or implement the Electron dashboard UI.
System Administration Phases 1–5 complete (info, diagnostics, metrics, maintenance execute, backups, restore, audit/security); Phase 6 certified v1.0.

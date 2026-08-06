# Frontend Gap Analysis — Legacy vs Backend V2

**Scope:** `frontend-legacy/` vs `backend-node/`  
**Updated:** 2026-08-03 · Phase 2 parity pass  
**Companion:** `FRONTEND_FEATURE_COMPLETION_REPORT.md`

---

## Executive verdict

Phase 2 wired the **critical Nest-backed operations** into Electron without redesign. Highest prior risk (checkout unused / no return UI / wrong lifecycle tokens / taxonomy names / settlement create) is **closed or quarantined**. Remaining gaps are Nest-less domains, thin admin surfaces, bridge money display debt, and test coverage.

**Do not invent Nest HTTP** for settings/audit/calendar/users/roles/backups.

---

## Critical — Phase 2 status

| ID | Gap | Phase 2 |
|----|-----|---------|
| C-01 | Rental checkout unused | **Closed** — create then `POST /rentals/:id/checkout` + deposit |
| C-02 | Reservation → rental wrong path | **Closed** — `POST /reservations/:id/checkout` |
| C-03 | Rental return/complete/cancel | **Closed** — detail actions |
| C-04 | Item media | **Mostly closed** — list/attach/setCover; reorder/remove still no Nest HTTP |
| C-05 | Customer media refs | **Open** — no Nest MediaReference browser |
| C-06 | Lifecycle tokens | **Closed** — lowercase Nest tokens |
| C-07 | Dress taxonomy by name | **Closed** — UUID pickers |
| C-08 | Settlement create page | **Closed** — explainer; create via checkout |
| C-09 | Customers report aggregates | **Open / soft** — Nest per-customer routes only |
| C-10 | Settings + Audit in nav | **Closed** — removed from nav |

### Critical unused Nest endpoints (post Phase 2)

```
GET  /items/:id/state|/history     — no dedicated UI
POST /auth/admin/unlock            — no admin UI
(item media reorder/detach)        — no Nest HTTP
```

---

## Major — Phase 2 status

| ID | Gap | Status |
|----|-----|--------|
| M-01 | Reservation confirm/edit ghosts | Partial — confirm/expire/cancel exist; PATCH still weak |
| M-02 | Rental notes update | Still unsupported (no Nest PATCH) |
| M-03 | Settlement modifiers | **Closed** |
| M-04 | Soft-restore UIs | Open |
| M-05 | Dashboard → `/returns/new` | **Closed** |
| M-06–M-13 | Bridge debt | Partially mitigated; TD-04 money zeros remain |
| Nav | Brands/colors/sizes/barcodes/finance | **Closed** |

---

## Dead / quarantine

Hidden from nav: settings, audit, calendar, returns, processing, sales, users, roles.  
`/settlements/new` = explainer only.

---

## Permission gaps (remaining)

| Kind | Examples |
|------|----------|
| Seeded, thin UI | `users.unlock`, restore keys, full permissions viewer |
| UI without Nest HTTP | settings/audit/calendar/users/roles (must stay quarantined) |

---

## Phase 3 readiness

Only after product accepts Nest-less blockers **or** ships Nest HTTP, plus test coverage push. See completion report for gate metrics (~92% Nest HTTP with FE action; not 100%).

---

## Phase 9 addendum (2026-08-05)

Frontend rebuild consumes Nest as-is. **Do not implement Nest** for these gaps:

| Gap | Impact on Phase 9 |
|-----|-------------------|
| No notification/push API | Shell bell remains placeholder |
| No users/roles/settings/audit HTTP | No admin nav until Nest exists |
| No calendar HTTP | Not in Phase 9 nav |
| No binary media download | Media UI will list/metadata only |
| PDF/Excel export engines stubbed | Reports 9.10 shows placeholders |

Shell (9.1) only calls `GET /health`. Auth login/session already exist via IPC.

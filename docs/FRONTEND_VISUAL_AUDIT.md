# Frontend Visual Audit — Phase 5.13

**Product:** جمان (Juman)  
**Date:** 2026-07-30  
**Scope:** Auth, Shell, modules 5.1–5.12, foundation home  
**Method:** Code review + UI UX Pro Max UX/React checklist (Juman DS remains design authority)  
**Visual snapshots:** Not available (no Playwright/Storybook/Chromatic/`toHaveScreenshot`)

---

## Overall score

**78 / 100**

Production-usable RTL desktop UI on a consistent DS. Remaining points are deferred product chrome (Ops Dashboard, notifications, search, export) and density polish on a few high-traffic wizards — not structural DS failure.

---

## Per-module scores

| Module | Score | Notes |
|--------|------:|-------|
| Authentication | 88 | Labels, focus, Enter submit, InlineMessage; brand uses `text-h1` |
| Shell (Sidebar/TopBar/StatusBar) | 82 | Stub chrome consistently disabled + قريبًا; gutter contract fixed |
| Foundation home (`/`) | 72 | Uses Page kit; still health JSON placeholder (Ops Dashboard deferred) |
| Categories | 84 | List Page contract aligned |
| Customers | 84 | Detail EntityHeader hierarchy cleaned |
| Inventory | 83 | Detail hierarchy cleaned; status/barcode dialogs OK |
| Calendar | 80 | Dress page inherits shell gutter; dress-centric density OK |
| Reservations | 83 | List/detail aligned |
| Rentals | 83 | List/detail aligned |
| Returns | 82 | Wizard denser than lists (acceptable for multi-step) |
| Processing | 80 | Dashboard queues OK; row actions `sm` by design |
| Sales | 83 | Detail hierarchy cleaned |
| Settlements | 83 | Detail hierarchy cleaned |
| Reports | 81 | Focus rings on cards; export placeholder consistent |
| Settings | 85 | Unsaved guard; category tabs |
| Users | 84 | Detail hierarchy cleaned |
| Roles | 84 | Matrix UI; detail hierarchy cleaned |
| Audit | 82 | Export disabled placeholder; detail cleaned |
| System | 80 | Hub PageHeader + tabs; child panes share chrome |

---

## Components reviewed

- Layout: `Page`, `PageHeader`, `AppShell`, `TopBar`, `Sidebar`, `StatusBar`, `Workspace`, `AuthLayout`
- Overlays: `Dialog`, `Drawer` (default `side="right"`), ConfirmationDialog, toast hosts
- Data: DataTable, FilterBar, Pagination, EmptyState, ErrorState, BusyIndicator
- Business: EntityHeader, PermissionGuard, StatusChip/Badge, MoneyDisplay, AuditTimeline
- Forms: Text/Password inputs, Label, InlineMessage (login / force-password / settings)

---

## Problems found

1. **Double horizontal gutters** — AppShell `p-6` + Page `px-6` / list `className="px-6"`.
2. **Calendar** full Page without restoring px (inconsistent with other lists).
3. **Stub chrome** — search/command/notifications fired toast "soon" while company switcher was disabled.
4. **Detail title duplication** — `PageHeader` + `EntityHeader` on 12 detail pages.
5. **Foundation / 404 / Forbidden** — ad-hoc typography and extra padding vs Page/Empty/Error kit.
6. **Reports card focus** — `ring-brand` without offset (weaker focus affordance).
7. **Docs drift** — shell doc still described Ctrl+K toast.

---

## Problems fixed

1. **Page gutter contract** — `Page` sizes are max-width only; shell owns `p-6`. Removed 19 list `className="px-6"` workarounds.
2. **Stub chrome** — TopBar search/command/notifications disabled with «قريبًا» when handlers omitted; company switcher label includes قريبًا; removed toast handlers / Ctrl+K toast.
3. **Detail hierarchy** — removed redundant `PageHeader title` on 12 EntityHeader detail pages (TopBar route title remains).
4. **Foundation home** — `Page` + `PageHeader` + `ErrorState` / `BusyIndicator` / `StatusBadge`.
5. **Forbidden / NotFound** — no double padding; EmptyState/ErrorState pattern.
6. **Login brand** — `text-h1` token class.
7. **Reports home** — focus-visible ring uses `--ring` + offset.
8. **application-shell.md** — gutter contract + stub policy documented.
9. **UI UX Pro Max** installed at `.cursor/skills/ui-ux-pro-max/` + command `.cursor/commands/ui-ux-pro-max.md` (checklist only; Juman tokens win).

---

## Problems deferred

| Item | Why |
|------|-----|
| Ops Dashboard home | Roadmap next module — out of scope |
| Notifications / global search / command palette | No backend/product yet; stubs only |
| Audit/Reports CSV export | No export API |
| Account unlock UI | No HTTP route |
| Wizard density (Returns/Sales create) | Functional; redesign later |
| Chart LTR islands | Intentional for axes |
| Visual regression CI | Tooling not present |
| Window control glyphs | Acceptable Electron chrome for now |

---

## Recommendations

1. Build Ops Dashboard as Phase 5 next; retire foundation health dump.
2. When shipping search/notifications, flip TopBar handlers from disabled → real; keep aria labels.
3. Add Playwright smoke + a few screenshot baselines for shell + one list + one dialog.
4. Consider a shared `EntityDetailPage` scaffold (EntityHeader + RecordInfoPanel + AuditTimeline) to prevent hierarchy drift.
5. Keep Pro Max as **audit checklist only** — never let it override `juman-dark` / gold ~2% / IBM Plex Sans Arabic.

---

## Screens needing future redesign

- `#/` foundation home → Ops Dashboard
- TopBar search / command / notifications (real UX)
- Returns / Sales create wizards (progressive disclosure)
- System status JSON panels (human-readable cards instead of raw `pre`)
- Calendar week density on narrow desktop widths

---

## Pro Max queries used

```text
python .cursor/skills/ui-ux-pro-max/scripts/search.py --domain ux "desktop dark focus overlay loading empty"
python .cursor/skills/ui-ux-pro-max/scripts/search.py --stack react "forms tables dialog accessibility"
```

Applied: visible focus rings, labeled forms, empty/error guidance — mapped onto existing DS primitives.

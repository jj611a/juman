# Frontend V2 — Phase 9 Rebuild Roadmap

**Branch:** `backend-v2`  
**Product UI:** `frontend/` (new) · `frontend-legacy/` frozen  
**Backend:** Nest `backend-node/` — **FROZEN** (no new endpoints, tables, or business rules)

## Mission

Rebuild the Electron desktop client as a modern Arabic-first enterprise POS/ERP that consumes Nest V2 exclusively (IPC → Main → Nest). Brand preserved: daisyUI theme `juman`, gold `#c6a75e`, RTL, dark mode, glass where appropriate.

## Non-goals (hard)

- No Nest endpoint / schema / formula changes  
- No mock APIs or fake domain data  
- No `legacyBridge` / snake_case DTO façades  
- No POS/feature screens until their sub-phase is approved  

---

## Phase plan

| Phase | Scope | Status |
|------:|-------|--------|
| **9.0** | Roadmap · architecture · ADR · gap notes | **DONE** |
| **9.1** | Application shell (nav, top bar, workspace, theme, toasts, dialogs, shortcuts, health/session) | **DONE** |
| **9.2** | Authentication (login, restore, logout, profile, password, idle timeout) | **DONE** |
| **9.3** | Dashboard redesign | **DONE** |
| **9.4** | Customers CRM | **DONE** |
| **9.5** | Inventory catalog | **DONE** |
| **9.6** | Operator integration (sales, finance, settlements, reports, receipts, categories, taxonomy/media/barcode in item workflow) | **DONE** |
| **9.6A**| Availability API & Panel | **DONE** |
| **9.7** | Operator Completion (receipt production readiness, settings UX, sales reporting fallback, media UX, barcode UX, POS consistency, error handling) | **DONE** |
| **9.8** | Sales POS | **DONE** |
| **9.8.3**| POS Redesign | **DONE** |
| **9.8.4**| POS Finalization | **DONE** |
| **9.9** | Finance & settlements (shared IQD formatting, escapeHtml security fix, reusable PaymentDialog, settlement adjustment permission wiring, POS print + bank_transfer + invalidation, payment/refund/settlement receipts, route-guard fix) | **DONE** |
| **9.10** | Reports | Pending |

**Stop rule:** After each `9.x` phase, produce verification report and wait for explicit approval before the next phase.

---

## Architecture targets (9.1+)

```
frontend/src/
  app/           providers · error boundary
  router/        routes · guards
  navigation/    permission-aware nav config
  layouts/shell/ sidebar · topbar · workspace · status
  features/*     pages · hooks · api · dialogs (per domain)
  shared/        components · hooks · utils · constants
  services/api/  Nest DTOs via IPC only
  ipc/           preload wrappers
  theme/         daisyUI juman + glass utilities
```

## Design system

- **Mandatory:** daisyUI 5 skill + Tailwind 4  
- **Theme:** `juman` (unchanged tokens)  
- **Font:** IBM Plex Sans Arabic  
- **Direction:** `rtl` default  

## Verification per phase

1. `pnpm lint` (tsc web + node)  
2. `pnpm test` (Vitest)  
3. `pnpm validate:arch`  
4. Manual shell walkthrough  
5. Docs + canvas update  

## Progress (Phase 9 overall)

| Completed | Weight | Cumulative |
|-----------|-------:|-----------:|
| 9.0 Roadmap | 5% | 5% |
| 9.1 Shell | 10% | 15% |
| 9.2 Auth | 10% | 25% |
| 9.3 Dashboard | 10% | 35% |
| 9.4 Customers | 10% | 45% |
| 9.5 Inventory | 10% | 55% |
| 9.6 Reservations | 10% | 65% |
| 9.6A Availability | 5% | 70% |
| 9.7 Rentals | 5% | 75% |
| 9.8 Sales POS | 5% | 80% |
| 9.8.3 POS Redesign | 5% | 85% |
| 9.8.4 POS Finalization | 5% | **90%** (target after 9.8.4) |
| 9.9–9.10 | 10% | 100% |

---

## Gaps (document only — do not implement Nest)

See `FRONTEND_GAP_ANALYSIS.md` (Phase 9 addendum). Known Nest-less surfaces remain: calendar HTTP, users/roles/settings/audit UIs, binary media download, PDF/Excel export engines.

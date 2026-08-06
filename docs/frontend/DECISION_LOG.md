# Frontend Rebuild Decision Log

## ADR-FE-V2-001 — Freeze legacy and rebuild

- **Date:** 2026-08-03
- **Context:** Backend V2 is authoritative; legacy FE is a snake_case compatibility façade with large `V2_UNSUPPORTED` surface.
- **Decision:** Rename `frontend/` → `frontend-legacy/` (read-only). Create new `frontend/` consuming Nest DTOs directly. No feature port without Phase 1 approval.
- **Consequences:** Short-term dual trees; clearer long-term maintainability; calendar/users/settings UIs deferred until Nest HTTP exists.

## ADR-FE-V2-002 — Electron Main owns auth

- **Decision:** Tokens only in Main (`safeStorage`). Renderer gets `SessionView` only.
- **Consequences:** All Nest calls go through `api:invoke` IPC.

## ADR-FE-V2-003 — daisyUI `juman` theme

- **Decision:** Preserve brand gold `#c6a75e` on black; daisyUI 5 as mandatory component vocabulary.
- **Consequences:** No purple/default AI themes; RTL-first body.

## ADR-FE-V2-004 — Phase 9 frontend rebuild (Nest frozen)

- **Date:** 2026-08-05
- **Status:** Accepted
- **Context:** Backend V2 Sales+Finance certified; Nest is feature-complete for desktop rebuild. Legacy UI and Phase 1 shell are insufficient for a 10-year POS/ERP client.
- **Decision:** Rebuild `frontend/` feature-first under Phase 9.0–9.10. Backend contracts frozen — frontend adapts; gaps are documented only. daisyUI skill mandatory. Brand tokens unchanged.
- **Consequences:** Sub-phases require approval gates. No mock domain APIs. Shell (9.1) ships before auth polish (9.2) and domain modules.

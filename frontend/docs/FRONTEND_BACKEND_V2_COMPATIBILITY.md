# Frontend ↔ Backend V2 Compatibility Certification

**Phase:** 8.0 Desktop Integration (frontend compatibility)  
**Date:** 2026-08-03  
**API base:** `http://127.0.0.1:8787` (Nest, no `/api/v1`)

## Scores

| Area | Score | Notes |
|---|---|---|
| Path remapping (customers/items/settlements/reports/media/health) | **92 / 100** | Core ops paths live |
| Envelope / camelCase→snake façade | **90 / 100** | `legacyBridge.ts` |
| Auth SessionManager Nest shape | **95 / 100** | Already partially migrated; completed |
| Unsupported module isolation | **88 / 100** | Throws `V2_UNSUPPORTED`; nav pruned |
| Reports dashboard field mapping | **80 / 100** | V2 KPIs mapped into legacy DTO; overdue/processing zeros |
| Media references / dress photos | **40 / 100** | Upload/get OK; gallery references unsupported |
| Calendar / availability HTTP | **0 / 100** | No Nest HTTP; nav hidden |
| Admin users/roles/system HTTP | **0 / 100** | Not in V2 surface; nav hidden |
| Settings / audit HTTP | **20 / 100** | Soft-fail unsupported |
| Export PDF/Excel | **N/A** | Explicitly disabled; csv/json helpers present |
| Electron health / Nest prefer | **85 / 100** | Prefer backend-node; DEV health on apiBaseUrl |
| Test coverage (bridge + flow) | **75 / 100** | Unit + integration mocks |

**Overall Phase 8.0 frontend compat:** **78 / 100**

## Architecture

```
Renderer apiClient
  → window.juman IPC
  → executeApiInvoke (Nest errors via messageFromNestBody)
  → Nest Backend V2
```

Façade modules:

- `src/services/v2/contracts.ts` — camelCase public shapes
- `src/services/v2/legacyBridge.ts` — envelopes + domain mappers + query bridge
- `src/services/v2/unsupported.ts` — `V2_UNSUPPORTED` AppError

## Remaining mismatches (accepted for 8.0)

1. Money still presented as raw fils integers in legacy fields (no UI redesign).
2. Dress create with brand/size/colour **names** cannot resolve taxonomy IDs without lookup.
3. Customer/report “summary/top” Python paths removed — use `/reports/customers/:id/*` later.
4. Settings, audit, calendar, users/roles await Nest HTTP or dedicated Phase work.
5. Media gallery soft-fails without generic MediaReference HTTP.
6. Installer packaging unchanged (out of scope).

## Validation

From `frontend/`:

```bash
npm run lint
npm run build
npm run test
```

## ADR

See `docs/backend-v2/DecisionLog.md` — **ADR-V2-031** frontend compatibility façade.

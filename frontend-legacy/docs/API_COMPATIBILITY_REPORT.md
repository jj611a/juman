# Frontend ↔ Backend V2 API Compatibility Report

**Date:** 2026-08-03  
**Scope:** Electron renderer `apiClient` + IPC → Nest Backend V2 (`http://127.0.0.1:8787`, no `/api/v1`)  
**Strategy:** Compatibility façade (`src/services/v2/*`) maps camelCase V2 → legacy snake_case envelopes.

| Frontend path / method | Nest V2 | Status | Notes |
|---|---|---|---|
| `POST /auth/login` | `/auth/login` | OK | SessionManager (already migrated) |
| `GET /auth/session` | `/auth/session` | OK | Refresh via `X-Refresh-Token` |
| `POST /auth/logout` | `/auth/logout` | OK | |
| `POST /auth/change-password` | `/auth/change-password` | OK | |
| `GET /health` | `/health` | OK | |
| `GET /customers` | `/customers` | OK | Bridge query + envelope |
| `GET /customers/:id` | `/customers/:id` | OK | |
| `POST /customers` | `/customers` | OK | Body: fullName/phone (+ snake accept) |
| `PATCH /customers/:id` | `/customers/:id` | OK | |
| `DELETE /customers/:id` | `/customers/:id` | OK | Soft delete |
| `POST …/activate\|deactivate` | `PATCH` status | OK | Mapped |
| `POST /customers/:id/restore` | `/customers/:id/restore` | OK | Added |
| `GET /categories` | `/categories` | OK | name↔name_ar |
| `POST/PATCH/DELETE /categories` | same | OK | |
| `GET /dresses` | `/items` | Needs Update→**Done** | Path remapped |
| `GET /dresses/barcode/:b` | `GET /items?barcode=` | OK | No dedicated barcode path |
| `POST /dresses/:id/status` | `POST /items/:id/transition` | OK | |
| `GET /reservations` | `/reservations` | OK | |
| `POST /reservations` | `/reservations` | OK | Body remapped |
| `POST …/confirm` | (create confirms) | OK | Re-fetch no-op |
| `POST …/cancel\|expire` | same | OK | |
| `PATCH /reservations/:id` | — | Remove / unsupported | V2_UNSUPPORTED |
| `GET /rentals` | `/rentals` | OK | |
| `POST /rentals` | `/rentals` | OK | items[{itemId}] |
| `POST /rentals/:id/checkout\|return\|complete\|cancel` | same | OK | Added |
| `PATCH /rentals/:id` | — | Remove / unsupported | V2_UNSUPPORTED |
| `GET /rental-settlements` | `/settlements` | Needs Update→**Done** | Path remapped |
| `POST …/payments` | `POST …/payment` | OK | amountFils |
| `POST …/adjustments` | `POST …/adjustment` | OK | |
| `POST …/refund\|discount\|late-fee\|close\|cancel` | same | OK | Added |
| `POST /rental-settlements` create | — | Remove | Settlements from checkout |
| `GET /reports/dashboard` | `/reports/dashboard` | OK | Field map to legacy KPIs |
| `GET /reports/financial/*` | `/reports/financial` | OK | Aggregate map |
| `GET /reports/rentals/*` | `/reports/rentals/{current,overdue,…}` | OK | Composed |
| `GET /reports/inventory/*` | `/reports/inventory/{…}` | OK | Composed summary |
| `GET /reports/export` | `/reports/export` | OK | csv/json only |
| `GET /reports/inspections\|processing\|sales/*` | — | Remove | V2_UNSUPPORTED; nav/cards hidden |
| `POST /media/files` | `POST /media` | OK | field `file` |
| `GET /media/files/:id` | `GET /media/:id` | OK | |
| `GET/POST /media/references` | — | Missing | V2_UNSUPPORTED (use `/items/:id/media`) |
| `GET /dresses/:id/photos` | — | Remove | V2_UNSUPPORTED |
| `GET /calendar/*` | — | Missing | No Availability HTTP; nav hidden |
| `GET/POST /returns\|inspections\|processing\|sales` | — | Remove | V2_UNSUPPORTED; nav hidden |
| `GET/POST /users\|roles\|permissions` | — | Remove | V2_UNSUPPORTED; nav hidden |
| `GET /login-history` | — | Remove | V2_UNSUPPORTED |
| `GET /system/*` backups/restore/metrics | — | Remove | V2_UNSUPPORTED; nav hidden |
| `GET /settings` | — | Missing | V2_UNSUPPORTED (settings HTTP not in V2 yet) |
| `GET /audit/logs` | — | Missing | V2_UNSUPPORTED (audit HTTP not exposed) |
| `GET /finance/*` | `/finance/*` | OK | Available if wired by features |

## Legend

- **OK** — wired through façade
- **Needs Update** — was wrong path/shape; fixed in Phase 8.0
- **Remove** — intentionally unsupported / hidden from nav
- **Missing** — no Nest HTTP yet; throws `V2_UNSUPPORTED`

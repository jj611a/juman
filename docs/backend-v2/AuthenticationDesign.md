# Backend V2 Authentication Design

**Phase:** 2.2 Authentication Implementation  
**Branch:** `backend-v2`

## Client model

- Electron Main is the only authentication owner.
- Renderer never sees raw tokens (HttpOnly-compatible ownership in Main / `safeStorage` for Remember Me refresh).
- Backend validates Bearer access JWTs; cold restore uses `X-Refresh-Token` on `GET /auth/session`.

## API (Phase 2.2)

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Bearer |
| POST | `/auth/change-password` | Bearer (allowlisted when forced) |
| GET | `/auth/session` | Public + Bearer and/or `X-Refresh-Token` |
| GET | `/auth/me` | Bearer |
| GET | `/health` | Public |

## Implemented behaviors

- Login / logout / session restore / Remember Me TTL
- Force password change guard + change-password
- Lockout after configurable failed attempts
- Account enable/disable (UsersService; no admin HTTP yet)
- JWT create/validate (session-bound `sid`)
- Opaque refresh rotation + reuse revocation
- Permission resolution + RBAC guards/decorators
- Seed: default roles/permissions + Administrator (`admin` / `Juman!Bootstrap1`, must change)

## Audit events (`login_history.eventType`)

LOGIN · LOGOUT · LOGIN_FAILED · PASSWORD_CHANGED · ACCOUNT_LOCKED

## Deviations vs Python V1

| Item | Notes |
|------|-------|
| Paths | `/auth/*` (not `/api/v1/login`) — map in Phase 8 |
| Session restore | `GET /auth/session` + optional refresh header (no separate `/refresh`) |
| `/me` permissions | Returned directly (fixes `roles.view` hydration gap) |
| Default admin password | Must not contain username (policy) |

## Out of scope

Customers, inventory, rentals, reports, users/roles admin HTTP CRUD.

# Backend V2 Authentication Design

**Phase:** 2.1 Authentication Foundation  
**Branch:** `backend-v2`  
**Spec source:** `backend-python/` identity + RBAC (read-only)

## Client model

- Electron is the **only** client.
- Renderer **never** sees raw tokens.
- Electron Main owns access (memory) + refresh (`safeStorage` when Remember Me).
- Backend validates Bearer access JWTs and rotates opaque refresh tokens.

## Python behavior analyzed (spec)

| Concern | Python V1 behavior |
|---------|-------------------|
| Login | `POST /api/v1/login` — username normalized, generic 401, Argon2id verify, session + tokens |
| Logout | Bearer — revoke current session + refresh family; logout-all revokes all |
| Session | `login_sessions` bound to JWT `sid`; access invalid if session revoked/expired |
| Password policy | Min length (floor 8), complexity ≥3 classes, history, no username substring |
| Forced change | `must_change_password` → 403 except allowlisted routes |
| Reset | Admin reset only; no public forgot-password |
| Lockout | Failed attempts → lock; duration 0 = until admin unlock |
| RBAC | User → single Role → Permissions; JWT does **not** carry permissions |
| Refresh | Opaque token, SHA-256 stored, rotation + reuse → revoke family |
| Remember Me | Longer refresh/session TTL (default 30d vs 7d); access TTL unchanged |
| Audit | `login_history` for auth events (not enterprise `audit_logs`) |

## V2 redesign

### Endpoints (foundation surface)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/logout` | Bearer |
| POST | `/api/v1/auth/refresh` | Public (refresh body) |
| GET | `/api/v1/auth/me` | Bearer (returns **permissions**) |
| GET | `/health` | Public |

> Path prefix uses `/api/v1/auth/*` (Nest feature module). Electron path mapping is Phase 8.

### Modules

```
src/auth/           controllers, guards, strategies, session/refresh/login-history
src/users/          repository + service (no CRUD controller yet)
src/roles/          repository + service + system role seed
src/permissions/    repository + service + full permission catalog seed
src/security/       Argon2, JWT, opaque tokens, password policy
```

### Data models (auth only)

User, Role, Permission, RolePermission, LoginSession, RefreshToken, LoginHistory, PasswordHistory (+ AppMeta).

### JWT lifecycle

1. Login creates `LoginSession` + opaque refresh (hashed) + HS256 access JWT.
2. Access claims: `sub`, `sid`, `type=access`, `iss=juman`, `aud=juman-desktop`.
3. Each request: signature/exp → active session → user active/unlocked → load permissions from DB.
4. Refresh rotates opaque token; reuse of revoked token revokes session family.
5. Logout revokes session + refresh family.

### Password hashing

Argon2id only. Parameters from env: `ARGON2_TIME_COST`, `ARGON2_MEMORY_COST`, `ARGON2_PARALLELISM`.

## Deviations from Python (intentional)

| Deviation | Why |
|-----------|-----|
| `/api/v1/auth/*` nested path | Nest feature boundary; map aliases in Phase 8 if needed |
| `GET /me` returns permissions | Fixes V1 client hydration that required `roles.view` |
| Clear expired locks on principal resolve | Fixes V1 gap (only authenticate cleared timed locks) |
| Touch session on refresh | Activity update without per-request write cost |
| No users/roles HTTP CRUD yet | Phase 2.1 foundation only |
| Auth audit via `LoginHistory` only | Enterprise audit module arrives later |

## Out of scope (this phase)

Users admin API, change-password endpoint, customers/inventory/rentals, browser SPA clients.

# Juman Backend V2 (`backend-node`)

NestJS + Prisma + SQLite sidecar for the Juman desktop ERP.

## Requirements

- Node.js **>= 20**
- pnpm (workspace root)

## Quick start

```bash
cd backend-node
pnpm install   # from monorepo root preferred
pnpm prisma:generate
pnpm start:dev
```

Default bind: **`http://127.0.0.1:8787`**

Override with `HOST` / `PORT` in `config/juman.env` (auto-created under `JUMAN_DATA_DIR`).

## Fresh install startup sequence

1. Create runtime folders (`data`, `logs`, `storage`, `config`)
2. Generate `config/juman.env` if missing
3. Initialize SQLite + **`prisma migrate deploy`** (abort on failure)
4. Verify migration status
5. Start Nest (JWT auth, RBAC seed, admin bootstrap)

Never continues with a partial schema.

## Account lockout recovery

Default lockout is **timed** (`ACCOUNT_LOCK_DURATION_MINUTES=15`).

Recovery paths (in order):

1. **Wait** until `lockedUntil` expires — next successful login clears the lock.
2. **Admin API** — `POST /auth/admin/unlock` with Bearer token and permission `users.unlock`:
   ```json
   { "username": "lockeduser" }
   ```
3. **Emergency SQLite** (sole-admin permanent lock when duration was set to `0`):
   ```sql
   UPDATE User
   SET isLocked = 0, lockedUntil = NULL, failedLoginAttempts = 0
   WHERE username = 'admin';
   ```

Setting `ACCOUNT_LOCK_DURATION_MINUTES=0` means permanent lock until unlock (API or SQL). Not recommended for production defaults.

## Auth surface

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Bearer |
| POST | `/auth/change-password` | Bearer (forced-change allowlisted) |
| POST | `/auth/admin/unlock` | Bearer + `users.unlock` |
| GET | `/auth/session` | Bearer and/or `X-Refresh-Token` |
| GET | `/auth/me` | Bearer |
| GET | `/health` | Public |

Disable account (`UsersService.disableAccount`) **immediately** revokes all sessions and refresh tokens; existing JWTs fail on next request.

## Dependency upgrade strategy

All package versions are **exact pins** (no `latest`, no ranges).

1. Change one dependency at a time in `package.json`
2. Run `pnpm install`
3. Run `pnpm lint && pnpm build && pnpm test && pnpm test:cov`
4. Commit lockfile + package.json together
5. Prefer Nest/Prisma minor upgrades in dedicated PRs; major upgrades need an ADR

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm start:dev` | Watch mode |
| `pnpm build` / `pnpm start` | Production build + `node dist/main.js` |
| `pnpm test` / `pnpm test:cov` | Vitest |
| `pnpm prisma:migrate:deploy` | Apply migrations (also runs on boot) |

## Docs

See `docs/backend-v2/` — Architecture, AuthenticationDesign, SecurityDesign, DecisionLog, DevelopmentRoadmap, audits.

## Shared foundation (Phase 3.1)

Reusable settings/audit/media/barcode + `src/shared` primitives.

`ash
pnpm test:cov:shared
`

See `docs/backend-v2/SharedFoundation.md`.
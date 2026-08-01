# Backend V2 Security Design (Phase 2.4)

## Threat mitigations

| Threat | Mitigation |
|--------|------------|
| Password storage compromise | Argon2id with configurable time/memory/parallelism; never SHA/MD5/bcrypt |
| Token theft (access) | Short-lived JWT; session binding via `sid`; logout / disable revokes session |
| Token theft (refresh) | Opaque token; only SHA-256 hash stored; Electron `safeStorage` for Remember Me |
| Refresh replay / reuse | Atomic rotate in SQLite TX + CAS on `revokedAt`; reuse revokes session family |
| Brute force | Failed attempt counter + **timed** lock (default 15m); unlock API + documented recovery |
| Timing attacks on password | Dummy Argon2 verify on unknown username; generic login error |
| Session fixation | New session id issued at login; old sessions not reused |
| Privilege escalation | Permissions loaded from DB each request; guards enforce keys; JWT carries no roles |
| Forced password change bypass | `PasswordChangeGuard` allowlist |
| Network exposure | Default bind `127.0.0.1` (`HOST` override); logs match actual interface |
| Stack leak | Global exception filter never returns stacks |
| Secret leakage | `JWT_SECRET` required in production (min 32); auto-generated into `juman.env` on first boot |

## Desktop assumptions

- No public REST clients; Electron Main is the trust boundary for token storage.
- LAN / cloud sync later must not move tokens into the renderer.
- Offline: SQLite local; auth works without network.

## Lockout recovery

1. Wait for `ACCOUNT_LOCK_DURATION_MINUTES` (default 15).
2. `POST /auth/admin/unlock` with `users.unlock`.
3. Emergency SQLite update (see `backend-node/README.md`) if sole admin is permanently locked (`duration=0`).

## Residual risks / known limitations

- Absolute session expiry (not sliding idle timeout on every request).
- Soft-delete username uniqueness still ignores deleted rows (rehire friction).
- Argon2 native Electron ABI rebuild documented for Phase 8 packaging.
- RBAC seed still rewrites on every boot (fingerprint deferred).

## Phase 2.4 notes

- Default Administrator seeded with forced password change.
- Session cold restore via `X-Refresh-Token` (tokens stay in Electron Main).
- Disable account immediately revokes sessions + refresh; JWTs fail closed.
- Coverage gate expanded beyond auth to identity/security/config/database stack.
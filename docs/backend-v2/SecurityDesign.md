# Backend V2 Security Design (Auth Foundation)

## Threat mitigations

| Threat | Mitigation |
|--------|------------|
| Password storage compromise | Argon2id with configurable time/memory/parallelism; never SHA/MD5/bcrypt |
| Token theft (access) | Short-lived JWT; session binding via `sid`; logout revokes session |
| Token theft (refresh) | Opaque token; only SHA-256 hash stored; Electron `safeStorage` for Remember Me |
| Refresh replay / reuse | Rotation with `replacedById`; reuse revokes entire session family |
| Brute force | Failed attempt counter + account lock; generic login error (no user enumeration) |
| Timing attacks on password | Argon2 verify; generic failure path for missing users |
| Session fixation | New session id issued at login; old sessions not reused |
| Privilege escalation | Permissions loaded from DB each request; guards enforce keys; JWT carries no roles |
| Forced password change bypass | `PasswordChangeGuard` allowlist |
| Stack leak | Global exception filter never returns stacks |
| Secret leakage | `JWT_SECRET` required in production (min 32); auto-generated into `juman.env` on first boot |

## Desktop assumptions

- No public REST clients; Electron Main is the trust boundary for token storage.
- LAN / cloud sync later must not move tokens into the renderer.
- Offline: SQLite local; auth works without network.

## Residual risks / known limitations

- No unlock HTTP API yet (permission `users.unlock` seeded for later).
- No change-password / admin reset HTTP yet (services/policy ready).
- Absolute session expiry (not sliding idle timeout on every request).
- Soft-delete of users does not yet cascade-revoke sessions at write time (principal resolve still fails closed).

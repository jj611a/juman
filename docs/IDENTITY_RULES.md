# Identity Rules — Juman (جمان)

**Document type:** Business & security design (source of truth)  
**Audience:** Backend and Electron implementers, auditors, future maintainers  
**Status:** Approved defaults for the Users / Authentication module  
**Scope:** Authentication, authorization binding, user lifecycle, sessions, and security operations  

This document defines **what** Identity must do and **why**. It does not prescribe table schemas, API paths, or code. Implementation must follow the Project Constitution (Clean Architecture, DDD, UUID/audit/soft-delete, Arabic UI messages, English codes).

---

## 1. Purpose and Context

Juman is a **Windows desktop POS & rental ERP** for dress stores. Operators share a store environment; accounts are **staff identities**, not public consumers.

Identity therefore prioritizes:

1. **Controlled provisioning** — only trusted administrators create accounts  
2. **Accountability** — every action attributable to a user (audit fields)  
3. **Least privilege** — roles and permissions already seeded in RBAC  
4. **Operational continuity** — lockouts, unlocks, and session revocation without losing history  
5. **Desktop-friendly auth** — username login, refreshable sessions, multi-device/cashier stations  

Identity builds on the existing foundation:

| Foundation asset | Identity use |
|---|---|
| JWT helpers (`issuer`, `audience`, access/refresh lifetimes) | Access + refresh token issuance |
| Argon2 hashing | Password storage and verification |
| RBAC (roles, permissions, `require_permission*`) | Authorization after authentication |
| Settings module | Tunable security policies (where appropriate) |
| `AuditedSoftDeleteModel` pattern | User and security-entity lifecycle |

---

## 2. Design Principles

1. **No public self-registration.** The store is a closed user directory.  
2. **Administrators are first-class and plural.** The system must never assume a single “superuser row.”  
3. **Authentication ≠ Authorization.** Login proves identity; RBAC decides capability.  
4. **Fail closed.** Missing principal, inactive user, locked account, revoked session, or missing permission → deny.  
5. **Secrets never leave the server.** Passwords stored only as Argon2 hashes; tokens are opaque to clients beyond bearer use.  
6. **Soft delete preserves accountability.** Historical rentals, sales, and audit trails must still resolve “who did this.”  
7. **Configurable where policy varies by store; fixed where security must not drift.**  
8. **Arabic messages for operators; English codes for clients and logs.**  

---

## 3. Actors and Trust Model

| Actor | How they enter the system | Typical powers |
|---|---|---|
| **System / bootstrap Admin** | Created during initial deployment (out of band or first-run admin seed) | Full administration including user management |
| **Administrator** | Created by another Admin | Users, roles, settings, unlocks, session revocation |
| **Staff** (Cashier, Inventory, Laundry, …) | Created by Admin; assigned one or more roles | Module permissions only |
| **Unauthenticated client** | Electron app before login | Health/version only; no business or identity admin APIs |

**Trust boundary:** The Electron desktop client is a trusted *presentation* layer but **not** a trusted authority. All authentication and authorization decisions are made by the backend.

---

## 4. Authentication

### 4.1 Login identifier

| Rule | Default | Justification |
|---|---|---|
| Primary login field | **Username** | Fast POS entry; no dependency on email/SMS; works offline-LAN and shared PCs |
| Username uniqueness | Global among non-deleted users | Prevents ambiguous principals |
| Username format | Case-insensitive compare; stored normalized (e.g. lowercased) | Avoids “Ali” vs “ali” duplicates |
| Email | **Optional**; not used for login in v1 | Useful for recovery/notifications later; many Iraqi stores lack stable email |
| Phone | **Optional**; not used for login in v1 | Useful for contact/SMS later; not an auth factor yet |

**Out of scope for v1:** OAuth, SSO, national ID login, OTP-as-primary login, biometric binding.

### 4.2 Credentials

| Rule | Default | Justification |
|---|---|---|
| Password required | Yes for all human users | Shared desktop POS still needs credential separation |
| Hashing | Argon2 (existing project parameters) | Modern memory-hard default already in foundation |
| Plaintext password | Never stored, logged, or returned in APIs | Constitution + security baseline |
| Timing-safe verify | Required | Reduce username/password oracle risk |

### 4.3 Login outcome

On successful authentication the system issues:

1. **Access token** (short-lived JWT) — authorization for API calls  
2. **Refresh token** (longer-lived, rotatable) — obtain new access tokens  
3. **Session record** — server-side session binding for revocation and history  

On failure the system returns a **generic** authentication error to the client (no “user not found” vs “wrong password” distinction in production responses), while recording a precise security event server-side.

### 4.4 Preconditions to accept login

Login succeeds only if **all** are true:

- Username exists and is not soft-deleted  
- Account is **active**  
- Account is **not locked**  
- Password verifies  
- User is not marked `must_change_password` **in a way that blocks normal app use** — see §10 (login may succeed with a restricted “password change only” capability)

---

## 5. Authorization

### 5.1 Model

Juman uses **RBAC with future ABAC-lite extension**:

```text
User ──assigned──► Role(s) ──grant──► Permission(s)
                └──future──► Direct Permission(s)
```

| Rule | Default | Justification |
|---|---|---|
| Role assignment | Required for useful work; Admin assigns roles | Matches seeded system roles (Admin, Cashier, Inventory, Laundry) |
| Multiple roles per user | **Allowed** | Cashiers who also do inventory; managers covering shifts |
| Direct permissions on user | **Designed for, deferred** | Escape hatch for exceptions without cloning roles; implement after role flows are stable |
| Effective permissions | Union of all role permissions (+ future direct grants) | Simple, auditable, ERP-standard |
| Permission checks | Server-side only via `require_permission*` | Never trust Electron UI hiding |

### 5.2 Admin privilege

| Rule | Default | Justification |
|---|---|---|
| Multiple administrators | **Supported and required** | Avoid single-point-of-failure; vacation/shift coverage |
| “Last admin” protection | Cannot deactivate, lock, soft-delete, or strip Admin role from the **last remaining active Admin** | Prevents total lockout of the store system |
| Self-escalation | Users cannot grant themselves permissions they do not already administer | Separation of duty |
| Role management | Only users with appropriate RBAC admin permissions | Aligns with existing `roles.*` / `users.*` permission keys |

### 5.3 Permission catalog (identity-related)

Existing RBAC seeds already include identity administration keys such as:

- `users.view` / `users.create` / `users.update` / `users.delete` / `users.manage`

Implementation of Identity must **enforce** these keys on admin APIs. Additional keys (e.g. unlock, revoke sessions, view login history) may be added to the catalog when the Users module is built — document them in RBAC defaults at that time.

---

## 6. User Lifecycle

### 6.1 Provisioning

| Rule | Default | Justification |
|---|---|---|
| Who creates users | **Administrator only** | Closed directory; no public registration endpoint |
| Public registration | **Forbidden** | Desktop ERP, not a SaaS consumer app |
| Required fields at create | Username, password (or temporary password), at least one role (recommended) | Minimal operable account |
| Optional fields | Full name (Arabic-friendly), phone, email, notes | Operational convenience |
| Initial password | Set by Admin **or** system-generated temporary password | Admin may hand credentials in person |
| `must_change_password` | **True** by default for Admin-created accounts | Forces the real owner to set a private password |

### 6.2 Activation / deactivation

| State | Meaning | Can login? |
|---|---|---|
| **Active** | Normal staff account | Yes (if not locked) |
| **Inactive** | Temporarily disabled (leave, resignation pending, discipline) | No |
| **Locked** | Security lock after failed attempts (or Admin lock) | No until unlocked |
| **Soft-deleted** | Removed from directory; retained for history | No |

| Rule | Default | Justification |
|---|---|---|
| Deactivate vs delete | Prefer **deactivate** for temporary removal | Reversible; preserves FK/audit clarity |
| Soft delete | Allowed for permanent removal from UI lists | Constitution; keeps historical references |
| Hard delete | **Forbidden** for users in production | Breaks audit and rental/sale attribution |

### 6.3 Soft delete policy

When a user is soft-deleted:

1. Login is rejected.  
2. All **refresh tokens / sessions** for that user are revoked.  
3. Username may be reserved by the soft-deleted row (hard unique) **or** released via a documented uniqueness strategy (e.g. partial unique on `is_deleted = false`).  
   - **Recommendation for Identity:** use a **partial unique index** on username where `is_deleted = false`, so a new employee can reuse a name after formal offboarding.  
4. Historical `created_by` / `updated_by` references remain valid UUIDs.  
5. Soft-deleted users do not appear in default admin lists; admins with elevated permission may view them if required for audit.

### 6.4 Profile updates

| Field | Who may change | Notes |
|---|---|---|
| Username | Admin only | Rare; treat as sensitive identity change; log security event |
| Full name / phone / email | Admin or self (self limited to non-security fields) | Product choice: v1 may keep profile edits Admin-only for simplicity |
| Roles | Admin only | Never self-assign |
| Active flag | Admin only | |
| Password | Self (with current password) or Admin reset | See §10 |

---

## 7. Password Policy

Policies below are **recommended defaults**. Prefer storing tunable numeric limits in Settings so stores can harden without code changes; complexity rules should remain consistent across environments.

### 7.1 Strength

| Rule | Recommended default | Justification |
|---|---|---|
| Minimum length | **10 characters** | Balance POS usability with brute-force resistance |
| Maximum length | **128 characters** | Cap DoS on hash input; allow passphrases |
| Complexity | At least **3 of 4**: uppercase, lowercase, digit, symbol | Strong enough for staff accounts without forcing unusable passwords on shared terminals |
| Username-in-password | **Rejected** | Common weak pattern |
| Common password list | **Rejected** (basic denylist) | Blocks `123456`, `password`, etc. |
| Unicode | Allowed if normalized consistently | Arabic UI users may type Arabic letters in passphrases — support carefully |

### 7.2 Password history

| Rule | Recommended default | Justification |
|---|---|---|
| History depth | **Last 5 passwords** | Prevents immediate reuse after forced change |
| Compare method | Argon2 verify against stored historical hashes | Never store plaintext history |
| Applies to | Self-change and Admin reset (when new password supplied) | Consistency |

### 7.3 Hashing

| Rule | Default |
|---|---|
| Algorithm | Argon2id (or project’s configured Argon2 variant) |
| Parameters | From environment (`ARGON2_*`) — not hardcoded in business logic |
| Rehash on login | If parameters upgrade, transparently rehash on successful verify |

### 7.4 Transmission

Passwords appear only in HTTPS/TLS (or trusted local desktop→API channel) request bodies. Never in query strings, logs, or tokens.

---

## 8. Login Policy

| Rule | Recommended default | Justification |
|---|---|---|
| Concurrent logins | **Allowed** (multiple active sessions) | Multiple cashier stations / owner phone + desktop |
| Idle handling | Client may discard access token; server enforces expiry | Desktop app responsibility for UX; server is authority |
| Clock skew | Small leeway on JWT `exp`/`nbf` if library supports it | Shared PCs often have mild clock drift |
| Login rate limit | Bound failed attempts per username **and** per client IP/device fingerprint if available | Complements account lockout |
| Generic errors | Production clients see one authentication failure message | Reduces account enumeration |

Successful and failed logins both create **login history** and **security events** (§12–§13).

---

## 9. Account Lockout

### 9.1 Automatic lock

| Rule | Recommended default | Justification |
|---|---|---|
| Failed attempt threshold | **5** consecutive failures | Industry-common balance for POS |
| Counter scope | Per user account | Simple and accountable |
| Counter reset | On successful login | Standard |
| Lock duration | **Until Admin unlock** (manual) | Store environments: forgotten passwords and shared PCs — automatic timed unlock can be abused; Admin is on site |
| Optional timed unlock | Future Settings toggle; **off by default** | Larger chains may want 15–30 minute auto-unlock later |

### 9.2 Manual lock / unlock

| Action | Who | Effect |
|---|---|---|
| Unlock | Admin with unlock/manage permission | Clears lock flag + failed-attempt counter; logs security event |
| Manual lock | Admin | Immediately prevents login; revokes sessions optional but **recommended** |
| Self-unlock | **Not allowed** | No email/SMS recovery in v1 |

### 9.3 Interaction with inactive / deleted

| State | Lockout behavior |
|---|---|
| Inactive | Login denied; failed attempts may still be recorded as security events but need not increment lock counters |
| Soft-deleted | Login denied; treat as non-existent for client messages |

---

## 10. Password Changes and Resets

### 10.1 Self-service change

| Rule | Default |
|---|---|
| Requires current password | Yes |
| Must satisfy password policy + history | Yes |
| Invalidates other sessions | **Recommended yes** (or provide “sign out other devices”) |
| Clears `must_change_password` | Yes |

### 10.2 Admin reset

| Rule | Default |
|---|---|
| Admin sets temporary password | Allowed |
| Forces `must_change_password = true` | **Required** |
| Notify user out-of-band | Operational process (verbal/WhatsApp) — not a system email in v1 |
| Revoke all sessions | **Required** |

### 10.3 Must-change-password gate

When `must_change_password` is true:

1. User may authenticate.  
2. API access is restricted to **password-change** (and maybe logout/session introspection).  
3. Business modules reject calls until the password is changed.  

This keeps forced rotation enforceable without trapping the user with no way to comply.

---

## 11. Sessions and Tokens

### 11.1 Token types

| Token | Nature | Lifetime (foundation defaults) | Purpose |
|---|---|---|---|
| Access token | JWT | **60 minutes** (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`) | Authorize API requests |
| Refresh token | Opaque or JWT with server-side record | **7 days** (`JWT_REFRESH_TOKEN_EXPIRE_DAYS`) | Rotate access tokens |

Issuer/audience must match foundation settings (`juman` / `juman-desktop`).

### 11.2 Session model

Each successful login creates a **server-side session** that:

- Belongs to one user  
- Stores refresh token identifier (hash of token, never plaintext if avoidable)  
- Records client metadata (user agent, device label, IP if available)  
- Has created/last-seen/expires timestamps  
- Can be revoked independently  

| Rule | Default | Justification |
|---|---|---|
| Multiple active sessions | **Allowed** | Multi-station POS |
| Refresh rotation | **Rotate refresh token on use** | Limits replay if a refresh token leaks |
| Reuse detection | If an old refresh token is reused after rotation, **revoke the session family** | Industry best practice against token theft |
| Access token revocation | Not listed individually; rely on short TTL + session/user checks for sensitive ops | JWT access tokens are stateless; critical admin actions may re-check user active/locked |

### 11.3 Session revocation

| Trigger | Sessions revoked |
|---|---|
| Logout (current) | Current session only |
| Logout all / Admin revoke all | All sessions for user |
| Admin reset password | All sessions |
| Soft delete / deactivate | All sessions |
| Manual lock (recommended) | All sessions |
| Refresh token reuse anomaly | Affected session family |

Revoked refresh tokens must not issue new access tokens.

---

## 12. Login History

Login history is an **append-only operational record** for support and accountability.

### 12.1 What to record

For each login attempt (success or failure), record at least:

| Field | Notes |
|---|---|
| Timestamp (UTC stored; display in `Asia/Baghdad`) | Constitution timezone default |
| Username attempted | Even if user missing |
| User id | If resolved |
| Result | success / failure reason code (server-side) |
| Client IP | If available |
| User agent / device label | Electron can send a stable device name |
| Session id | On success |

### 12.2 Retention and access

| Rule | Default |
|---|---|
| Retention | Keep at least **90 days**; longer preferred for ERP audit |
| Who can view | Admins with appropriate permission; users may view **their own** recent history |
| Mutation | **No updates/deletes** via product APIs (except retention purge jobs if added later) |

Login history is **not** a substitute for application audit fields (`created_by` / `updated_by` on business entities).

---

## 13. Security Events

Security events are a higher-signal audit stream than raw login history.

### 13.1 Event catalog (minimum)

| Event | When |
|---|---|
| `auth.login.success` | Successful login |
| `auth.login.failure` | Failed login |
| `auth.logout` | Explicit logout |
| `auth.token.refresh` | Refresh used |
| `auth.token.reuse_detected` | Refresh reuse anomaly |
| `auth.password.changed` | Self change |
| `auth.password.reset_by_admin` | Admin reset |
| `auth.account.locked` | Automatic or manual lock |
| `auth.account.unlocked` | Admin unlock |
| `auth.account.activated` / `deactivated` | Admin toggles |
| `auth.session.revoked` | Single or bulk revocation |
| `auth.user.created` / `updated` / `soft_deleted` | Admin lifecycle |
| `auth.roles.changed` | Role assignment changes |

### 13.2 Rules

- Events are append-only.  
- Include actor id (who performed the action), subject user id (who was affected), request id, and metadata JSON.  
- Never store passwords or raw tokens in event payloads.  
- Visible to Admins; optionally exportable later for compliance.

---

## 14. Admin Management

### 14.1 Capabilities (logical)

Administrators with sufficient permissions can:

1. Create, update, activate, deactivate, and soft-delete users  
2. Assign and remove roles  
3. Reset passwords (forced change)  
4. Unlock locked accounts  
5. View login history and security events  
6. Revoke one or all sessions for a user  
7. Manage multiple Admin accounts  

### 14.2 Safeguards

| Safeguard | Rule |
|---|---|
| Last active Admin | Cannot remove Admin capability / deactivate / delete / lock the last active Admin |
| Self-lock | Admin may lock themselves only if another active Admin exists (prefer warn + block if last) |
| Destructive actions | Soft delete and role stripping require explicit confirmation in UI (implementation concern) |
| Break-glass | Documented operational procedure to create a new Admin via controlled bootstrap if all Admins are lost (DB-level, offline) — not a public API |

### 14.3 Bootstrap

First deployment must create **at least one Admin** through a controlled bootstrap path (migration seed, CLI, or documented one-time setup). Bootstrap credentials must force password change on first login.

---

## 15. Recommended Defaults Summary

| Topic | Recommended default |
|---|---|
| Multiple administrators | **Yes** |
| Public registration | **No** |
| Who creates users | **Admin only** |
| Login identifier | **Username** |
| Phone / email | **Optional**; not for login v1 |
| Roles | **Assigned by Admin**; multiple roles allowed |
| Direct user permissions | **Supported in design; implement after roles** |
| Password min length | **10** |
| Password complexity | **3 of 4 character classes** |
| Password history | **Last 5** |
| Failed attempts to lock | **5** |
| Unlock method | **Manual by Admin** |
| Login history | **Yes** (append-only) |
| Refresh tokens | **Yes**, rotated |
| Multiple sessions | **Yes** |
| Session revocation | **Yes** (self + Admin) |
| Must change password | **Yes** for Admin-created / reset accounts |
| Activation / deactivation | **Yes** |
| Soft delete | **Yes**; hard delete forbidden |
| Access token TTL | **60 minutes** (foundation) |
| Refresh token TTL | **7 days** (foundation) |

---

## 16. Settings vs Fixed Rules

| Prefer **Settings** (tunable) | Prefer **fixed in Identity rules** |
|---|---|
| Failed-attempt threshold | No public registration |
| Password minimum length (within safe bounds) | Argon2 as hash algorithm |
| Refresh/access TTL (within production validation bounds) | Fail-closed authorization |
| Login history retention days | Soft delete (no hard delete of users) |
| Future auto-unlock duration | Last-Admin protection |
| | Username-based login as primary |

Production validation already constrains dangerous JWT/debug/CORS settings at startup; Identity must not introduce weaker overrides.

---

## 17. Non-Goals (v1)

The following are **explicitly out of scope** for the first Identity delivery:

- Public or invite-link self-registration  
- Email/SMS OTP as primary authentication  
- OAuth2 / OpenID Connect / social login  
- WebAuthn / Windows Hello binding  
- Customer (shopper) accounts — customers are a separate future module  
- Automatic email password reset flows  
- Impersonation (“login as user”)  
- Hierarchical org units / multi-tenant SaaS isolation  

These may be revisited without rewriting the core rules above.

---

## 18. Acceptance Criteria for the Future Users Module

Identity implementation is complete only when:

1. Admin can create users with username + password + roles; no public register API exists.  
2. Login issues access + refresh tokens bound to a revocable session.  
3. Inactive, locked, and soft-deleted users cannot use the API.  
4. Five failed logins lock the account until Admin unlock.  
5. Password policy + history are enforced on change/reset.  
6. `must_change_password` gates business APIs.  
7. Multiple Admins work; last-Admin protections hold.  
8. Login history and security events are recorded for success and failure paths.  
9. Settings/RBAC admin routes are protected with real `require_permission*` checks.  
10. All entities follow UUID, audit fields, and soft-delete conventions.

---

## 19. Document Control

| Item | Value |
|---|---|
| Path | `docs/IDENTITY_RULES.md` |
| Owner | Juman architecture |
| Related | `backend/docs/architecture.md`, RBAC module, Settings module, Project Constitution |
| Next engineering step | Implement the **Users** module against these rules (models/APIs only when explicitly requested) |

Changes to defaults in this document require an explicit product/architecture decision and a changelog entry before implementation diverges.

---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0008. Closed-directory identity model

## Context and Problem Statement

Who may have accounts, how do they log in, and who provisions them in a dress-store POS?

## Decision Drivers

* Staff accounts, not public consumers
* Iraqi store operational realities (username over email)
* Multiple administrators; no single locked-out owner
* Security: lockout, refresh sessions, password policy
* Constitution: no demo/public signup APIs

## Considered Options

* Public self-registration + email login
* Closed directory: Admin-created users, username login, optional phone/email
* SSO-only (Azure AD / Google)

## Decision Outcome

Chosen option: "Closed directory: Admin-created users, username login, optional phone/email", as specified in `docs/IDENTITY_RULES.md` (including lockout, refresh tokens, multi-session, must-change-password).

### Consequences

* Good, because no internet identity dependency for v1
* Good, because provisioning matches store hierarchy
* Bad, because password reset is operational (no email OTP in v1)
* Neutral, because customer shoppers remain a separate future module

### Future Impact

* Users module must not expose public register
* Last-admin protections are mandatory
* Direct permissions may be added later without changing login identifier

## Validation

* Compliance with [`docs/IDENTITY_RULES.md`](../IDENTITY_RULES.md) at Users implementation time
* Acceptance criteria in that document

## Pros and Cons of the Options

### Public self-registration + email login

* Good, because familiar SaaS pattern
* Bad, because wrong trust model for store POS

### Closed directory + username login

* Good, because matches desktop ERP reality
* Bad, because Admin burden for provisioning

### SSO-only

* Good, because enterprise federation
* Bad, because overkill and unavailable for many shops in v1

## More Information

* [`docs/IDENTITY_RULES.md`](../IDENTITY_RULES.md)
* ADR [0006](0006-jwt-argon2-auth-primitives.md), [0007](0007-database-driven-rbac.md)

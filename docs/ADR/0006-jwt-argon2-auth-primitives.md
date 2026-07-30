---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0006. JWT and Argon2 authentication primitives

## Context and Problem Statement

The Electron client needs authenticated API access. Which token and password-hashing approach should the foundation provide before the Users module exists?

## Decision Drivers

* Desktop client over HTTP(S)/LAN
* Modern password hashing (memory-hard)
* Stateless access tokens with revocable refresh sessions (Identity Rules)
* Production secret validation already required

## Considered Options

* Server sessions in Redis only (opaque session ids)
* JWT access tokens + Argon2 password hashing (+ refresh tokens)
* PASETO / alternate token formats

## Decision Outcome

Chosen option: "JWT access tokens + Argon2 password hashing (+ refresh tokens)", because helpers already exist in the foundation and match Identity Rules (access TTL, refresh TTL, issuer/audience).

### Consequences

* Good, because Electron can send `Authorization: Bearer`
* Good, because Argon2 is a strong default
* Bad, because access JWTs are not instantly revocable without short TTL + server checks
* Bad, because Argon2 is CPU-heavy and currently sync (must offload when Users lands)
* Neutral, because Users module still required to bind principals

### Future Impact

* Identity implements login/refresh/session revocation on top of these primitives
* Production rejects weak `SECRET_KEY`
* Switching hash algorithms later requires rehash-on-login strategy

## Validation

* `app/security` JWT/Argon2 utilities
* Config validation for JWT settings in production
* [`docs/IDENTITY_RULES.md`](../IDENTITY_RULES.md)

## Pros and Cons of the Options

### Redis-only opaque sessions

* Good, because instant revoke
* Bad, because Redis is optional today; harder offline/simple deploys

### JWT + Argon2 + refresh

* Good, because fits desktop Bearer auth and foundation
* Bad, because refresh reuse detection must be implemented carefully

### PASETO

* Good, because safer defaults in some designs
* Bad, because ecosystem/tooling less aligned with current stack

## More Information

* [`docs/IDENTITY_RULES.md`](../IDENTITY_RULES.md)
* [`docs/API_STANDARDS.md`](../API_STANDARDS.md)

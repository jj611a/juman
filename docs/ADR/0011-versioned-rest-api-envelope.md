---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0011. Versioned REST API and unified envelopes

## Context and Problem Statement

Electron and future clients need a stable HTTP contract. How are APIs versioned, shaped, and erred?

## Decision Drivers

* One parsing model in the desktop client
* Arabic operator messages + English machine codes
* Additive evolution without breaking v1
* Alignment with existing foundation handlers

## Considered Options

* Unversioned ad-hoc JSON per module
* GraphQL primary API
* Versioned REST (`/api/v1`) with success/error envelopes

## Decision Outcome

Chosen option: "Versioned REST (`/api/v1`) with success/error envelopes", as specified in `docs/API_STANDARDS.md` (pagination offset/limit, Bearer auth, RBAC, OpenAPI offline in production).

### Consequences

* Good, because clients switch on `error.code` and always read `success`
* Good, because OpenAPI supports codegen later
* Bad, because envelope verbosity vs raw bodies
* Neutral, because WebSockets are deferred with guidelines only

### Future Impact

* Breaking changes require `/api/v2` or coordinated deprecation
* All modules register under the v1 router
* Critical POSTs adopt Idempotency-Key when payments/handovers land

## Validation

* Global exception handlers + shared schemas
* [`docs/API_STANDARDS.md`](../API_STANDARDS.md)

## Pros and Cons of the Options

### Unversioned ad-hoc JSON

* Good, because fast initially
* Bad, because client breakage and inconsistent errors

### GraphQL primary

* Good, because flexible queries
* Bad, because caching/auth complexity and weaker fit for command-heavy POS

### Versioned REST + envelopes

* Good, because simple, consistent, already started
* Bad, because chatty list payloads if unconstrained (mitigated by pagination caps)

## More Information

* [`docs/API_STANDARDS.md`](../API_STANDARDS.md)

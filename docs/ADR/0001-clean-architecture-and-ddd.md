---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0001. Clean Architecture and DDD modular packaging

## Context and Problem Statement

Juman will grow many bounded contexts (Users, Inventory, Rentals, Payments, …). How should code be structured so modules plug in without rewriting the foundation?

## Decision Drivers

* Project Constitution: Clean Architecture, SOLID, Repository + Service layers
* Long-lived ERP domain with clear boundaries
* Prevent routers from owning SQL and models from owning HTTP
* Incremental delivery without big-bang rewrites

## Considered Options

* Layered MVC / “fat services” monolith folders only
* Clean Architecture + DDD modules under `app/modules/<context>/`
* Microservices from day one

## Decision Outcome

Chosen option: "Clean Architecture + DDD modules under `app/modules/<context>/`", because it matches the constitution and supports incremental module registration at the API composition root.

### Consequences

* Good, because foundation packages stay free of module imports (except composition roots)
* Good, because each module owns models, repositories, services, schemas, API
* Bad, because more boilerplate per module
* Neutral, because shared kernels (`common`, `exceptions`, `security`) remain thin

### Future Impact

* New features land as modules, not as cross-cutting dumps into `api/`
* Dependency rule violations require refactor or a superseding ADR
* See `backend/docs/architecture.md` for integration steps

## Validation

* Foundation verification / architecture reviews
* Import direction checks during code review

## Pros and Cons of the Options

### Layered MVC only

* Good, because simple early on
* Bad, because boundaries erode as POS domains multiply

### Clean Architecture + DDD modules

* Good, because scalable modularity with clear owners
* Bad, because ceremony for tiny endpoints

### Microservices from day one

* Good, because independent deploy (in theory)
* Bad, because operational cost unjustified for a single-store desktop POS backend

## More Information

* [`backend/docs/architecture.md`](../../backend/docs/architecture.md)
* [`backend/docs/structure.md`](../../backend/docs/structure.md)

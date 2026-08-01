---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0002. FastAPI, Python 3.13+, and async stack

## Context and Problem Statement

The backend must serve a Windows Electron client with low-latency POS operations and future calendar/concurrency needs. Which application stack should we standardize on?

## Decision Drivers

* Async I/O for PostgreSQL and future Redis
* OpenAPI generation for desktop clients
* Strong typing (Pydantic v2)
* Team/Python ecosystem fit
* Constitution: async correctness

## Considered Options

* FastAPI + SQLAlchemy 2 async + Pydantic v2 (Python 3.13+)
* Django (sync or async hybrid) + DRF
* NestJS / Node.js backend

## Decision Outcome

Chosen option: "FastAPI + SQLAlchemy 2 async + Pydantic v2 (Python 3.13+)", because it provides first-class async, automatic OpenAPI, and aligns with the already shipped foundation.

### Consequences

* Good, because request path can be non-blocking for DB I/O
* Good, because OpenAPI matches API standards
* Bad, because sync CPU work (e.g. Argon2) must be carefully offloaded later
* Neutral, because Electron remains a separate TypeScript codebase

### Future Impact

* All new endpoints stay async
* Blocking libraries require `asyncio.to_thread` or equivalent
* Python version floor remains 3.13+ unless superseded

## Validation

* `pyproject.toml` requires Python 3.13+
* pytest-asyncio suite on the foundation

## Pros and Cons of the Options

### FastAPI async stack

* Good, because modern, typed, OpenAPI-native
* Bad, because younger ecosystem patterns than Django for some admin use cases

### Django + DRF

* Good, because batteries included
* Bad, because async story and Clean Architecture packaging are clumsier for this constitution

### NestJS / Node

* Good, because one language with Electron
* Bad, because duplicates stack and abandons the chosen Python foundation

## More Information

* [`backend-python/pyproject.toml`](../../backend-python/pyproject.toml)
* [`docs/API_STANDARDS.md`](../API_STANDARDS.md)

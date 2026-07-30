---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0007. Database-driven RBAC

## Context and Problem Statement

POS staff roles differ (Admin, Cashier, Inventory, Laundry). How should authorization be modeled and enforced?

## Decision Drivers

* Least privilege
* Store-configurable role compositions
* Fail closed until Users exists
* Permission keys usable in OpenAPI and guards

## Considered Options

* Hardcoded role checks in code (`if user.role == "admin"`)
* Database-driven RBAC (permissions, roles, role_permissions)
* External IAM/OIDC-only authorization

## Decision Outcome

Chosen option: "Database-driven RBAC (permissions, roles, role_permissions)", with `require_permission*` dependencies that fail closed until a real principal exists.

### Consequences

* Good, because permission catalog is data and seedable
* Good, because multiple roles per user are natural later
* Bad, because admin RBAC APIs are sensitive and must be authenticated (Users)
* Neutral, because direct user-permission grants are deferred (Identity Rules)

### Future Impact

* Every protected route declares permission keys
* Users module assigns roles to users; effective permissions = union of roles (+ future directs)
* UI hiding never replaces server checks

## Validation

* RBAC module + migrations + tests
* Guards live under `modules/rbac/dependencies.py`

## Pros and Cons of the Options

### Hardcoded role checks

* Good, because simple
* Bad, because inflexible and scatters authorization

### Database-driven RBAC

* Good, because ERP-standard and auditable
* Bad, because more tables and admin UX

### External IAM only

* Good, because centralized enterprise identity
* Bad, because unsuitable as sole model for closed single-store desktop v1

## More Information

* [`docs/IDENTITY_RULES.md`](../IDENTITY_RULES.md)
* ADR [0008](0008-closed-directory-identity.md)

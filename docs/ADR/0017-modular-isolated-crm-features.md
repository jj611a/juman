# ADR 0017: Modular Isolated CRM Features (DDD Layout)

## Context and Problem

The Juman frontend has many large transaction modules (Rentals, Reservations, Sales). As we rebuild the frontend on React + Electron, coupling the domain entities or business layouts of one module with another can cause dependency entanglements, making the client hard to test and modify. We need a clear layout structure for the Customers CRM module that stays completely self-contained.

## Decision

We enforce a modular, Domain-Driven Design (DDD) file system boundary for the Customers module:

1. **Self-Containment:**
   - All components, forms, validation hooks, dialog models, and routes related specifically to Customer CRM are strictly encapsulated inside:
     `src/features/customers/`
   - Reusable layout primitives (like global sidebars, DataTable frameworks, money formatting badges) are imported from the `src/shared/` or `src/layouts/` folders. No logic or UI component from `features/customers/` is ever imported by another domain module (like `features/rentals/`).

2. **Route and Component Isolation:**
   - Routes are mapped inside `AppRouter` using isolated pages from the feature folder:
     - `CustomerListPage.tsx`
     - `CustomerDetailPage.tsx`
   - Data state queries are fully cached under TanStack Query keys starting with `['customer', ...]` and `['customers', ...]`. Invalidation is targeted only to these keys on mutations.

## Consequences

- **Pros:**
  - Zero cross-module coupling. We can refactor or replace any domain module without affecting others.
  - Better developer experience (DX) and clear developer ownership maps.
  - Isolated testing blocks (we can test the CRM components individually).
- **Cons:**
  - Requires clear naming hygiene to avoid name collisions across module routes.

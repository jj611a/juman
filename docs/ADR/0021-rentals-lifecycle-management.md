# ADR 0021: Rentals Lifecycle Management

## Context and Problem

Managing physical rentals requires robust tracking of item custody, checkouts, returns, and completeness states. Offloading states or rules to the client would create data inconsistency hazards.

## Decision

1. **Rely Entirely on Backend Transitions:**
   - The React renderer offloads checkout deposits, item returns, cancellations, and status validations entirely to the backend controllers (`POST /rentals/:id/checkout`, `POST /rentals/:id/return`, `POST /rentals/:id/complete`, and `POST /rentals/:id/cancel`).
2. **Permission-Aware Transitions:**
   - The UI controls are protected by local user-permissions checker: `rental.checkout`, `rental.return`, `rental.cancel`, and `rental.view`.
3. **State Mutation Invalidation:**
   - After any success action on state transition, react-query invalidates queries for `['rentals']` and `['rental', id]` to fetch updated timeline states.

## Consequences

- **Pros:**
  - Guarantees settlement balances are updated atomically during returns.
  - Zero duplication of transitions business rules.
- **Cons:**
  - Detail screen relies on multiple api fetches to resolve full timelines.

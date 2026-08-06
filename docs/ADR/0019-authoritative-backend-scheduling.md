# ADR 0019: Authoritative Backend Scheduling (Reservations)

## Context and Problem

In rental operations, checking dress/item availability across overlapping calendar dates is highly critical. If the client performs availability calculations or overlap logic locally, it runs the risk of getting out of sync with other cashiers, resulting in double-bookings.

## Decision

We enforce an authoritative backend scheduling pattern for reservations:

1. **Zero Frontend Scheduling Logic:**
   - The frontend does not calculate date overlap or range conflicts.
   - All calendar dates and inventory item availabilities are displayed exactly as returned by the backend.
2. **Server-Side Conflict Checks:**
   - When creating or editing a reservation, the frontend submits the desired dates (`startDate`, `expectedCheckoutDate`, `expectedReturnDate`) and `itemId`s directly to the backend.
   - The backend validates the lifecycle states and returns standard error DTOs (e.g. `ConflictException`) if an overlap occurs.
   - The frontend intercepts these exceptions and renders detailed Arabic error toasts.

## Consequences

- **Pros:**
  - Single source of truth (the database) for reservation bookings.
  - Prevents race conditions between concurrent cashiers on desktop clients.
  - Simplifies frontend state management.
- **Cons:**
  - Requires a network roundtrip to validate a reservation draft.

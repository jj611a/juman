# ADR 0020: Read-Only Availability Query Endpoints

## Context and Problem

Staff needs to preview calendar availability and item conflicts. Previously, this was a placeholder. Offloading overlap calculations to the client risks dual-stack synchronization drift.

## Decision

We expose a new read-only `AvailabilityController` inside `AvailabilityModule` in the backend:

1. **Expose Existing Services:**
   - Expose the pre-existing `AvailabilityService.findConflicts` through standard HTTP endpoints.
   - Introduce `GET /availability`, `GET /availability/calendar`, and `GET /availability/item/:id` endpoints.
2. **Read-Only Enforcements:**
   - These endpoints only execute database reads and do not perform mutations or write sequence counter locks.
   - Gated under the permission key `availability.view`.
3. **Availability Panel Component:**
   - In the frontend, replace the legacy calendar query text with an `AvailabilityPanel` component. This panel query hook speaks directly to `GET /availability/item/:id` to check active conflicts and resolve next available dates.

## Consequences

- **Pros:**
  - Standardizes calendar checks against a single database source.
  - Zero duplication of overlap rules in the frontend.
  - Quick, low-overhead database queries with indexed fields.
- **Cons:**
  - Incremental HTTP load on item detail loads.

# ADR 0023: POS Operator Experience Redesign

## Context and Problem

A cashier needs a highly responsive and visually clear workspace for continuous operations.

## Decision

1. **Top Ribbon & Favorites:**
   - Place a horizontal ribbon at the top of the POS workspace for one-click insertion of favorite codes.
2. **Keyboard Function Key Bindings:**
   - Bind `F1`-`F5` natively to bypass the mouse:
     - `F1`: Switch to Rental Mode.
     - `F2`: Switch to Sale Mode.
     - `F3`: Focus barcode scanner input.
     - `F4`: Clear Cart.
     - `F5`: Confirm / Process Transaction.
3. **Glassmorphism Styling:**
   - Apply translucent glass panels, soft drop shadows, and gold highlights to achieve a state-of-the-art POS operator screen.

## Consequences

- **Pros:**
  - High cashier satisfaction and faster processing times.
  - Zero mouse movement required for regular checkout cycles.
- **Cons:**
  - Cashier must memorize function key layouts to work efficiently.

# ADR-0024: Enterprise POS Workspace

## Context and Problem

The cashier requires an enterprise cashier terminal (similar to Toast POS / Square POS) that prevents navigating away for sub-tasks.

## Decision

1. **In-POS Modal overlays:**
   - Instead of navigating to dedicated pages, sub-tasks (making payments, returning items, looking up reservations) are handled entirely inside modular modal overlays within the POS Workspace.
2. **Unified Status Bar & Clock:**
   - Display a status bar showing printer status, scanner status, current shift status, and cashier name.
3. **Advanced Keyboard layout (F1-F8):**
   - Implement function keys `F1` to `F8` for mouse-less operations.

## Consequences

- **Pros:**
  - Fast execution flow. Cashier stays on one screen.
- **Cons:**
  - Modals must be lightweight.

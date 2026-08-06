# ADR 0022: POS Workspace Flow

## Context and Problem

The cashier needs an optimized screen for fast checkout workflows. Menu navigation should be minimized. The terminal should rely on keyboard inputs and scans.

## Decision

1. **Unified 3-Column Operator Workspace:**
   - Organize the interface into distinct areas: Left (Customer selection & Shortcuts list), Center (Cart item scanner), and Right (Quick checkout action triggers).
2. **Keyboard-First Bindings:**
   - Bind direct listeners for global shortcuts (`Ctrl+N` for new cart, `Ctrl+F` to focus input, `Ctrl+R`/`Ctrl+S` for mode selections, `Esc` to clear search) to avoid mouse dependency.
3. **Scan Resolving workflow:**
   - Scanned codes lookup items in database using `itemsData` references.

## Consequences

- **Pros:**
  - High-performance input capturing and tactile confirmation states.
  - Zero redundant clicks.
- **Cons:**
  - Cashier must learn key shortcuts to utilize terminal at full speed.

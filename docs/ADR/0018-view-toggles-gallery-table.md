# ADR 0018: Instant Table-to-Gallery View Switcher (Inventory Ktalog)

## Context and Problem

The Juman Inventory Catalog is used in two main ways by staff:
1. As an operational list sheet: needing barcode searches, detailed prices, categories, and quick status columns (best in a condensed list table).
2. As a visual client gallery: showing items, colors, and designs during client consultations (best in a large cards photo gallery).

Performing database queries or reloading the page on layout switching causes loading stutters and bad user experience (UX) on desktop client screens.

## Decision

We implement a client-side view toggle architecture within `InventoryListPage.tsx`:

1. **State Isolation:**
   - Single parent query hook `useItemsList` loads the full item array once and stores it in React Query memory.
   - Switch state `viewMode: 'table' | 'gallery'` is handled inside local component state.
2. **Dynamic UI Rendering:**
   - When switching, the component changes the container from `<table>` to a grid `<div className="grid ...">`.
   - The same item data is parsed locally into either `InventoryTable` rows or `InventoryCard` gallery items.
   - Images are loaded lazily to preserve desktop CPU.

## Consequences

- **Pros:**
  - Instant view switches (0ms round-trip latency).
  - Preserves pagination offsets and filter parameters between view modes.
  - Less network traffic to NestJS.
- **Cons:**
  - Increases initial bundle memory slightly by keeping the same list state representation for two styles.

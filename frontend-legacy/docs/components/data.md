# Data components (Phase 2.5)

Reusable data presentation kit. Import only from `@/components/ui`. Features must never import `@tanstack/react-table`.

## Public API

| Export | Role |
|---|---|
| `createDataColumn<T>()` | Typed column definitions |
| `DataTable` | Controlled presentation table |
| `Pagination` | First/Prev/Next/Last + page size |
| `SearchBar` | Debounced search (wraps `SearchInput`) |
| `FilterBar` | Declarative filters → `DataColumnFilter[]` |
| `StatusBadge` + `mapStatus` | Semantic status tones |
| `KPICard` | KPI tile |
| `StatisticsCard` | Summary + comparison (`chartSlot` reserved) |
| `DropdownMenu` | Row actions primitive |
| `applyRangeSelection` / `useShiftSelectionAnchor` | Shift multi-select architecture |

## Why TanStack is hidden

TanStack Table is an implementation detail inside `src/components/ui/data-table/`. Feature modules depend only on Juman types (`DataColumnDef`, `DataSortingState`, …). Replacing the engine later must not require rewriting business screens.

## Column definitions

```tsx
const columns = [
  createDataColumn<Customer>({
    accessorKey: 'name',
    header: 'الاسم',
    sortable: true,
    resizable: true,
    filterable: true,
    align: 'start',
    cell: ({ row, getValue }) => <span>{String(getValue())}</span>
  })
]
```

Supported fields: `id`, `accessorKey`, `accessorFn`, `header`, `cell`, `footer`, `width` / `minWidth` / `maxWidth`, `sortable`, `filterable`, `resizable`, `hideable`, `pinnable`, `searchable`, `exportable`, `align`, `meta`.

`exportable` / `pinnable` / `searchable` are **reserved flags** for future tooling — no runtime in 2.5.  
`footer` is accepted on column defs but **DataTable does not render `<tfoot>` yet**.

## Controlled DataTable contract

Parent owns state (server-driven ready):

```tsx
<DataTable
  columns={columns}
  data={rows}
  sorting={sorting}
  onSortingChange={setSorting}
  pagination={pagination}
  onPaginationChange={setPagination}
  globalFilter={query}
  columnFilters={filters}
  rowSelection={selection}
  onRowSelectionChange={setSelection}
  columnVisibility={visibility}
  onColumnVisibilityChange={setVisibility}
  columnOrder={order}
  onColumnOrderChange={setOrder}
  columnSizing={sizing}
  onColumnSizingChange={setSizing}
  manual={false}
/>
```

- **`manual={false}` (default):** TanStack client row models run on the provided `data` using controlled state.
- **`manual={true}`:** Parent slices `data` and supplies `pageCount` / `totalItems` (React Query / API lists).

## Server-driven pattern (features later)

1. `SearchBar` / `FilterBar` / `Pagination` / sort headers update local query state.
2. React Query fetches with those params.
3. Pass `manual`, server `data`, and `pageCount` into `DataTable`.

## Row actions + permissions

```tsx
actions={[
  { id: 'view', label: 'عرض', icon: 'Eye', permission: 'customer.view', onClick },
  { id: 'delete', label: 'حذف', tone: 'danger', permission: 'customer.delete', onClick }
]}
```

Each action with `permission` is wrapped in `PermissionGate` (UX only — never the authorization authority).

## Selection

- Checkbox column + select-all when `enableRowSelection`.
- Shift-click range select via `applyRangeSelection` (wired in the checkbox cell).
- Selected rows use a gold start border accent (token-aligned).

## Loading / empty / error / skeleton

| Prop | Behavior |
|---|---|
| `loading={true}` | Overlay spinner |
| `loading="skeleton"` | Pulse rows |
| `empty` | Empty body slot |
| `error` | Error body slot |

## Virtualization (architecture-ready)

```tsx
virtualization={{ enabled: true, estimateSize: 40 }}
```

Accepted and documented — **no** `@tanstack/react-virtual` runtime yet. Enabling has **no scroll virtualizer**. In development, DataTable logs a one-time `console.warn` when `enabled: true` so features cannot silently assume scale is handled.

## Column order

`columnOrder` / `onColumnOrderChange` are **parent-owned**. There is no built-in drag-reorder UI in 2.5 — parents may reorder programmatically.

## Status mapping

```tsx
const mapped = mapStatus(dress.status, {
  AVAILABLE: { tone: 'success', label: 'متاح' },
  RENTED: { tone: 'info', label: 'مؤجّر' }
})
<StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
```

Tones: `success` | `warning` | `danger` | `info` | `neutral`.

## SearchBar

- Debounce default `300ms`.
- Clear button.
- `shortcutHint` + `onShortcut` / Ctrl+K focus ready.

## FilterBar field types

`text` | `number` | `date` | `select` | `multiSelect` | `boolean`

Emits `DataColumnFilter[]` (`{ id, value }`) with **serializable** `DataFilterValue`:

- `string` | `number` | `boolean` | `string[]`
- **Dates are ISO calendar strings** (`YYYY-MM-DD`) — never `Date` objects in the filter payload (safe for server query params).

## KPICard

Renders `title`, `value`, optional `subtitle`, and optional `trend` / `trendLabel` **together** (subtitle and trend are independent lines).

## Accessibility

- Sortable headers: keyboard Enter/Space, `aria-sort`.
- Pagination: `role="navigation"` + Arabic labels.
- Row action menu: icon button `aria-label`.
- Always test/demo under `dir="rtl"`.

## DEV showcase

`#/dev/data`

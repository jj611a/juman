# Reports module (5.10)

Arabic RTL feature under `src/features/reports/`.

## Transport

- Domain: `apiClient.reports.*` — raw JSON DTOs (no success envelope)
- Chart library: **recharts** (official Juman v1)

## Surfaces

Home + category pages: dashboard, inventory, rentals, reservations, customers, inspections, processing, sales, financial.

## Permissions

- Ops: `reports.view`
- Money: `reports.financial.view`
- Export seeded unused — UI placeholder only

## Locks

- Charts presentation-only; sparse `financial/daily` with no zero-fill
- Named financial metrics only (no unlabeled revenue)
- Print placeholder; saved filters stub future-ready

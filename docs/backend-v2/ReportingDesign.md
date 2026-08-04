# Backend V2 Reporting Design (Phase 7.0)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/reports`  
**Role:** Read-only reporting engine over Inventory, Rental, Settlement, Finance, and (future) Sales data.

## Scope

**In scope:** Dashboard KPIs; financial / rental / inventory / customer reports; shared filters; export abstraction (CSV + JSON implemented; PDF/Excel adapters stubbed); RBAC; Prisma aggregates; report indexes.

**Out of scope:** Mutating Inventory / Rentals / Sales / Finance / Settlement / Ledger; changing settlement formulas; late-fee scheduler; invoices; Electron integration; PDF/Excel rendering; **Phase 6.7 sales aggregates (deferred — Settlement `entityType=sale` is already queryable without redesign)**.

## Architecture rules

1. `ReportsModule` is a **read-only** bounded context.
2. Reports **never** call Inventory / Rental / Settlement / Finance **write** services.
3. Reads go through `ReportsRepository` → Prisma aggregates / `groupBy` / paginated `findMany` (no N+1 loops).
4. Money figures for rental obligations come from **Settlement** fields (`remainingFils`, `totalFils`, …) or completed Payments / posted ledger rows — reports do **not** recalculate formulas.
5. Export uses `ReportExporter` interface via `ReportExportRegistry`.

```
HTTP /reports/*
  → ReportsController (RBAC)
  → ReportsService (filters, pagination, sort, export flatten)
  → ReportsRepository (Prisma read aggregates)
  → ReportExportRegistry → CSV | JSON | (PDF/Excel stubs)
```

## Permissions

| Permission | Use |
|------------|-----|
| `reports.view` | Non-financial operational reports |
| `reports.financial.view` | Financial summary + customer payment history |
| `reports.export` | `GET /reports/export` (financial kinds also require financial.view) |

No financial **write** permissions are granted by this module.

## HTTP surface

| Method | Path | Notes |
|--------|------|-------|
| GET | `/reports/dashboard` | KPI snapshot |
| GET | `/reports/financial` | Revenue, payments, outstanding, refunds, discounts, late fees, adjustments, deposits, charges |
| GET | `/reports/rentals/{current\|overdue\|returns\|reservations\|history}` | Paginated |
| GET | `/reports/inventory/{value\|availability\|category\|brand\|color\|size\|lifecycle\|retired\|maintenance}` | Aggregates or lists |
| GET | `/reports/customers/:id/{rentals\|outstanding\|payments\|reservations}` | Customer-scoped |
| GET | `/reports/export?report=&format=` | CSV/JSON; PDF/Excel return validation error |

### Filters (query)

`from`, `to`, `status`, `categoryId`, `brandId`, `colorId`, `sizeId`, `customerId`, `employeeId`, `itemId`, `settlementId`, `sortBy`, `sortDir`, `offset`, `limit`.

## Dashboard fields

Active rentals · Today's checkouts · Today's returns · Open settlements · Outstanding balance · Revenue today · Revenue this month · Inventory count · Reserved items · Available items.

## Export

```ts
interface ReportExporter {
  readonly format: string;
  export(payload: ReportExportPayload): ReportExportResult;
}
```

- **CSV / JSON:** implemented
- **PDF / Excel:** adapters present; throw until a later phase

## Performance

- Dashboard / financial use `Promise.all` of aggregates.
- Taxonomy summaries use `groupBy` + one label lookup query.
- Indexes added: `Rental.actualReturnDate`, `Payment.completedAt`, `Payment(status, completedAt)`, `FinancialTransaction(status, type, createdAt)`.

## Tests

```
pnpm test:cov:reports   # ≥95% lines/statements on src/reports
```

## Explicit non-goals

- Do not modify `settlement.formula.ts` or any Settlement / Finance write path.
- Do not begin Electron packaging from this module.

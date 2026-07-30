# Reports Module - Juman

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients  
**Status:** Implemented (v1 read-only reporting)  
**Scope:** Operational and financial JSON reports over completed domain data — no writes, no exports, no Electron dashboard UI

Related: [RENTAL_FINANCIAL_SETTLEMENT.md](RENTAL_FINANCIAL_SETTLEMENT.md), [SALES.md](SALES.md), [RENTALS.md](RENTALS.md), [DRESS_STATE_MACHINE.md](DRESS_STATE_MACHINE.md).

---

## 1. Purpose

Reports aggregates existing transactional and inventory records into read-only summaries for cashiers, inventory staff, and admins.

Reports **must not** create or modify rentals, sales, settlements, dress status, calendar blocks, or payments.

---

## 2. Domain boundaries

| Owns | Does not own |
|---|---|
| Read-only SQL aggregates | Transaction posting |
| Named financial metrics | Generic unlabeled "revenue" |
| Date-range resolution (Baghdad day → UTC) | PDF/CSV export (`reports.export` unused) |
| Permission split view vs financial | Notifications / Electron UI |

---

## 3. Date and timezone policy

- Storage/compare: UTC via `ensure_utc` / `utc_now`
- Business day: setting `default_timezone` (seed `Asia/Baghdad`)
- Query params: `date_from`, `date_to` as date or datetime
- Date-only → half-open `[00:00 local from, 00:00 local to)` converted to UTC
- Datetime → `ensure_utc`, half-open `[from, to)`
- Reject `from >= to`; reject span > **366 days**

Period columns:
- Rentals created: `rentals.rental_at`
- Reservations created: `reservations.created_at`
- Inspections: `inspections.inspected_at`
- Processing started/completed: `started_at` / `completed_at`
- Sales: `sales.sold_at`
- Settlement charges: `rental_settlements.created_at`
- Cash collected: payment `received_at`

---

## 4. Permissions

| Key | Roles |
|---|---|
| `reports.view` | Admin, Cashier, Inventory |
| `reports.financial.view` | Admin, Cashier |
| `reports.export` | Admin (seeded; unused in v1) |

Laundry has no reports permissions.

---

## 5. API catalogue

Mount: `/api/v1/reports`

| Path | Perm | Notes |
|---|---|---|
| GET `/dashboard` | view | Ops snapshot; no money |
| GET `/inventory/summary` | view | Status / category / size / colour / brand |
| GET `/inventory/never-rented` | view | Paginated |
| GET `/rentals/summary` | view | Range + active/overdue snapshot |
| GET `/rentals/details` | view | Paginated |
| GET `/reservations/summary` | view | |
| GET `/customers/summary` | view | |
| GET `/customers/top` | view (+ financial for value metrics) | `metric=rental_count\|rental_gross\|sale_value` |
| GET `/inspections/summary` | view | |
| GET `/processing/summary` | view | |
| GET `/sales/summary` | financial | Frozen `actual_sale_price` |
| GET `/sales/details` | financial | Paginated |
| GET `/financial/summary` | financial | Named metrics |
| GET `/financial/daily` | financial | Baghdad calendar days |

Pagination: `offset` / `limit` (max 200) + `PaginationMeta`. Sort fields allow-listed.

---

## 6. Financial metric definitions

| Field | Kind | Source |
|---|---|---|
| `rental_charges_gross` | Charged | Σ `rental_settlements.gross_total` (created in range; not VOIDED/deleted) |
| `rental_charges_rental` | Charged | Σ `rental_charge_amount` |
| `rental_charges_late` | Charged | Σ `late_penalty_amount` |
| `rental_charges_minor_damage` | Charged | Σ `minor_damage_penalty_amount` |
| `rental_adjustments` | Adjusted | Σ `manual_adjustment_amount` |
| `rental_initial_credits` | Credit | Σ `initial_payment_credit` (not cash collected) |
| `rental_payments_collected` | Collected | Σ settlement payments `received_at` in range |
| `rental_outstanding` | Outstanding | Σ `remaining_balance` OPEN/PARTIALLY_PAID (snapshot) |
| `sale_revenue` | Charged=Collected (v1) | Σ completed `sales.total_amount` by `sold_at` |
| `sale_revenue_normal` / `_mandatory` | Split by origin | |
| `sale_payments_collected` | Collected | Σ `sale_payments.amount` by `received_at` |
| `total_cash_collected` | Collected | rental payments + sale payments |
| `total_charged` | Charged | rental gross + sale revenue |

**Do not** add `rentals.initial_payment_value` into cash collected (it is settlement credit).  
**Mandatory damage purchases** count as sale revenue only.  
**Cancelled rentals** produce no settlement rows.  
Historical totals use frozen settlement/sale amounts — never live dress defaults.

---

## 7. Operational metric notes

- Dress status counts omit live use of `RETURNED` (engine-rejected).
- Completed rentals = settlement `PAID` (not unused `RentalStatus.COMPLETED`).
- Overdue = `ACTIVE` ∧ `expected_return_at` < now.
- Never rented = no rental_items on non-deleted rentals excluding `CANCELLED`/`DRAFT`.
- Customer payloads: `id`, `customer_number`, `full_name` only.

---

## 8. Privacy and audit

- No password/token fields.
- Report GETs do **not** write audit rows.

---

## 9. Performance

- Aggregates in SQL; separate payment vs header queries to avoid 1-N multiplication.
- Indexes added: `sales.sold_at`, `rentals.expected_return_at`, settlement/sale payment `received_at`.
- No reporting tables or materialized views in v1.

---

## 10. Exclusions

Refunds/void, PDF/CSV, Electron dashboard, Notifications, POS `payment.*`, speculative low-activity scores, unlabeled revenue, Laundry role report access.

Migration: `20260729_0028_reports`.

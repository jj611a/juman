# Rental Financial Settlement — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients  
**Status:** Implemented (v1 post-return settlement)  
**Scope:** Settle post-return money (frozen rental charge, late penalty, minor-damage penalties, adjustments, payments) — no Sales, refunds, or operational completion

Related: [`RENTALS.md`](RENTALS.md), [`RETURNS.md`](RETURNS.md), [`INSPECTION.md`](INSPECTION.md), [`PROCESSING.md`](PROCESSING.md).

---

## 1. Purpose

After return + completed inspection, Cashier creates one live settlement per rental:

- Snapshot rental charge (`estimated_total`) and initial-payment credit
- Compute late penalty from frozen item dailies
- Include minor-damage repair penalties (MAJOR / ruined excluded)
- Collect payments until `PAID`
- Optional signed adjustments (Admin)

**Financial `PAID` ≠ operational complete.** Settlement never sets rental `COMPLETED`, never touches Processing/Calendar/dress status.

---

## 2. Domain boundaries

| Owns | Does not own |
|---|---|
| Post-return balances & payments | Sales / forced purchase |
| Late + minor-damage money lines | Refunds / overpayment |
| Manual adjustments | Grace-period settings |
| `STL-########` numbering | General POS (`payment.*`) |

Permissions use dedicated `rental.settlement.*` keys. Leave Cashier `payment.*` seeds for future POS.

---

## 3. Eligibility

- Rental status `RETURN_PENDING`
- Live Return with status `INSPECTION_COMPLETED`
- Completed Inspection
- One live (non-`VOIDED`) settlement per rental

---

## 4. Late-day calculation

```text
late_seconds = max(0, (returned_at_utc - expected_return_at_utc).total_seconds())
late_days    = 0 if late_seconds == 0 else ceil(late_seconds / 86400)
late_penalty = Σ (item.agreed_daily_rental_price × late_days)
```

Uses frozen `agreed_daily_rental_price` only. Grace period: **0** (no settings key).

---

## 5. Money model (integer fils)

| Snapshot / field | Meaning |
|---|---|
| `rental_charge_amount` | `rental.estimated_total` |
| `initial_payment_credit` | `rental.initial_payment_value` (charge line, not a payment) |
| `late_penalty_amount` | Computed at create |
| `minor_damage_penalty_amount` | Sum of MINOR `repair_penalty_amount ≥ 1` |
| `manual_adjustment_amount` | Running signed sum |
| `gross_total` | rental + late + damage + adjustments |
| `total_due` | `max(0, gross - initial_credit)` |
| `total_paid` | Sum of payment rows |
| `remaining_balance` | `max(0, gross - credit - paid)` |

`remaining = gross - initial_credit - Σ(payments)`. No refunds if remaining would go negative.

---

## 6. Data model

Migration: `20260728_0026_settlements`.

### `rental_settlements`

`settlement_number`, `rental_id` (unique among live non-VOIDED), `return_id`, `status`, money snapshots, `settled_at` / `settled_by`, `notes`, audit + soft delete.

### `rental_settlement_charges` (append-only)

Types: `RENTAL` \| `LATE` \| `DAMAGE` \| `INITIAL_CREDIT`.  
`inspection_item_id` unique when set (one DAMAGE per inspection item).

### `rental_settlement_payments` (append-only)

`amount > 0`, method `CASH` \| `CARD` \| `BANK_TRANSFER` \| `OTHER`, `received_at`, `received_by`, optional reference/notes.

### `rental_settlement_adjustments` (append-only)

Signed `amount ≠ 0`, required `reason` (strip, length ≥ 3).

Settings: `settlement.number.prefix/separator/padding` defaults `STL` / `-` / `8` (category `financial`).

---

## 7. Lifecycle

```text
OPEN ──partial pay──► PARTIALLY_PAID ──final pay──► PAID
  ▲                        │
  └── adjustment (paid=0)  └── more partial / adjust
```

- `remaining == 0` → `PAID` (+ `settled_at` / `settled_by`)
- `0 < total_paid` and remaining > 0 → `PARTIALLY_PAID`
- `total_paid == 0` → `OPEN`

`VOIDED` reserved; no void API in v1. No PATCH/DELETE on payments, charges, or posted settlements.

---

## 8. API

Mount: `/api/v1/rental-settlements` (+ `GET /api/v1/rentals/{rental_id}/settlement`).

| Method | Path | Permission |
|---|---|---|
| POST | `/rental-settlements` | `rental.settlement.create` |
| GET | `/rental-settlements` | `rental.settlement.view` |
| GET | `/rental-settlements/{id}` | `rental.settlement.view` |
| GET | `/rentals/{rental_id}/settlement` | `rental.settlement.view` |
| POST | `/rental-settlements/{id}/payments` | `rental.settlement.collect` |
| POST | `/rental-settlements/{id}/adjustments` | `rental.settlement.adjust` |

Cashier: view / create / collect. Adjust: Admin only (unless granted).

Concurrency: payment/adjustment take `SELECT … FOR UPDATE` on the settlement row, recompute paid/remaining, then insert.

---

## 9. Audit

Module `"settlement"`: create settlement; create payment + update/complete settlement; custom adjustment.

---

## 10. Out of scope (v1)

Sales, forced purchase, refunds, void API, invoices, reports, notifications, grace-period settings, flipping rental/dress operational completion.

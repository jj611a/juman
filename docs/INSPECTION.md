# Inspection Module — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients  
**Status:** Implemented (v1 condition assessment)  
**Scope:** Evaluate returned dresses; record repair penalties without collecting money; route dresses via Status Engine — no Laundry, Sales, or Payments

Related: [`RETURNS.md`](RETURNS.md), [`DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md), [`RENTALS.md`](RENTALS.md).

---

## 1. Purpose

Inspection assesses every dress on a `PENDING_INSPECTION` return:

- Scaffold one InspectionItem per ReturnItem
- Record condition: `GOOD` / `MINOR_DAMAGE` / `MAJOR_DAMAGE`
- On complete: Status Engine transitions + mark return `INSPECTION_COMPLETED`
- Calendar blocks remain untouched

---

## 2. Lifecycle

```text
[*] ──POST──► PENDING ──PATCH items──► PENDING ──PATCH complete──► COMPLETED
```

No reopen after COMPLETED.

---

## 3. Condition rules

| Condition | Penalty | Laundry | Status |
|---|---|---|---|
| `GOOD` | Forbidden | Optional → `PROCESSING` if true, else `AVAILABLE` | |
| `MINOR_DAMAGE` | Required ≥ 1 fils | Forced true → `PROCESSING` | |
| `MAJOR_DAMAGE` | Forbidden | Forbidden; `send_to_ruined` required → `RUINED_PENDING_SALE` | |

`RUINED_PENDING_SALE` is new; future Sales moves to `SOLD` / `RUINED`.

---

## 4. Database

### `inspections`

`inspection_number` (`INS-########`), `return_id` (unique alive), `inspected_at` / `inspected_by` (set on complete), `status`, `notes`, audit + soft delete.

### `inspection_items`

`return_item_id`, `dress_id`, `condition` (nullable until filled), `repair_penalty_amount`, `repair_notes`, `requires_laundry`, `send_to_ruined`, `notes`.

Migration: `20260728_0024_inspection`.  
Settings: `inspection.number.prefix/separator/padding` (defaults `INS` / `-` / `8`).

---

## 5. API

Permissions: `inspection.view` / `inspection.create` / `inspection.update` (Inventory, Laundry, Admin).

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/inspections` | `{return_id, notes?}` → PENDING scaffold |
| `GET` | `/api/v1/inspections` | list |
| `GET` | `/api/v1/inspections/{id}` | detail |
| `PATCH` | `/api/v1/inspections/{id}` | items + optional `complete: true` |

Audit: create, update, complete (`module="inspection"`); return complete; dress status via Status Engine.

---

## 6. Explicit non-goals

Laundry execution lives in [`PROCESSING.md`](PROCESSING.md). Payments/settlement, forced purchase / Sales, rental completion, calendar release, `RUINED_PENDING_SALE → RUINED`.

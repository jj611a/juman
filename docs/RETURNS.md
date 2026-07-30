# Returns Module — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients  
**Status:** Implemented (v1 receipt)  
**Scope:** Record that rented dresses have physically returned — hand off to Inspection; no penalties, payments, or laundry

Related: [`RENTALS.md`](RENTALS.md), [`DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md), [`CALENDAR_ENGINE.md`](CALENDAR_ENGINE.md).

---

## 1. Purpose

Returns records **full physical receipt** of all dresses on an ACTIVE rental:

- Create one Return + one ReturnItem per live RentalItem
- Dress Status: `RENTED → INSPECTION`
- Rental Status: `ACTIVE → RETURN_PENDING`
- Calendar `RENTAL` blocks are **not** modified

---

## 2. Lifecycle (v1)

```text
[*] ──create──► PENDING_INSPECTION ──(Inspection complete)──► INSPECTION_COMPLETED ──► COMPLETED
```

| Status | v1 usage |
|---|---|
| `PENDING_INSPECTION` | Created on successful receipt |
| `INSPECTION_COMPLETED` / `COMPLETED` | Enum + DB only |

No PATCH / cancel in v1. Partial returns are not supported.

---

## 3. Database schema

### `returns`

| Column | Notes |
|---|---|
| `return_number` | Immutable `RET-########` |
| `rental_id` | FK rentals; unique among live returns |
| `customer_id` | Denormalized from rental |
| `returned_at` | Receipt time (default now) |
| `status` | `PENDING_INSPECTION` on create |
| `returned_by` | Staff user id |
| `notes` | optional |

### `return_items`

| Column | Notes |
|---|---|
| `rental_item_id` | FK rental_items |
| `dress_id` | FK dresses |
| `returned_at` | Same as header in v1 |
| `notes` | optional |

Migration: `20260728_0023_returns`.  
Settings: `returns.number.prefix/separator/padding` (defaults `RET` / `-` / `8`).

---

## 4. Rental & status integration

| Step | Action |
|---|---|
| Validate | Rental exists, `ACTIVE`, no prior live return, ≥1 item |
| Persist | Return + items |
| Status Engine | `RENTED → INSPECTION` per dress |
| Rental | `RentalService.mark_return_pending` → `RETURN_PENDING` + audit `return` |

Never write `Dress.status` directly. Never call Calendar in this module.

---

## 5. API

Permissions: `return.view`, `return.create` (Cashier + Laundry + Admin). `return.update` / `rental.return` unused.

| Method | Path | Perm |
|---|---|---|
| `POST` | `/api/v1/returns` | create |
| `GET` | `/api/v1/returns` | view |
| `GET` | `/api/v1/returns/{id}` | view |

Create body: `rental_id`, optional `customer_id` / `returned_at` / `notes`. Items derived from rental.

Audit: `module="returns"` create; rental `return`; dress status via Status Engine.

---

## 6. Explicit non-goals

Laundry, payments/settlement, late fees, damage fees, Sales, calendar block removal, partial returns. Condition assessment lives in [`INSPECTION.md`](INSPECTION.md).

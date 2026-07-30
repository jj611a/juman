# Rentals Module — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients  
**Status:** Implemented (v1 handover)  
**Scope:** Immediate dress handover (walk-in or from Confirmed reservation) with estimated total + initial payment only — no returns, penalties, or final settlement

Related: [`RESERVATIONS.md`](RESERVATIONS.md), [`CALENDAR_ENGINE.md`](CALENDAR_ENGINE.md), [`DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md).

---

## 1. Purpose

Rentals record **physical handover** of one or more dresses to a customer:

- Walk-in: check Calendar availability, create `RENTAL` blocks, `AVAILABLE → RENTED`
- From Confirmed reservation: replace `RESERVATION` blocks with `RENTAL`, `RESERVED → RENTED`, mark reservation `CONVERTED_TO_RENTAL`
- Snapshot estimated total and initial payment; remaining balance is **derived** (not stored)

---

## 2. Lifecycle (v1)

```text
[*] ──create──► Active ──cancel──► ValidationError (always; audit cancel attempt)
                  │
                  └── (future Returns) → ReturnPending → Completed
```

| Status | v1 usage |
|---|---|
| `ACTIVE` | Created on successful handover |
| `DRAFT` / `RETURN_PENDING` / `COMPLETED` / `CANCELLED` | Enum + DB only; no transitions yet |

**PATCH Active:** notes only. Item/date/payment mutation after handover is rejected.

**Cancel:** always Arabic `ValidationError` after writing a cancel-attempt audit row — use [`RETURNS.md`](RETURNS.md) for physical receipt.

---

## 3. Database schema

### `rentals`

| Column | Notes |
|---|---|
| `rental_number` | Immutable `RENT-########` (settings-driven) |
| `customer_id` | FK → customers |
| `reservation_id` | FK → reservations (nullable; set when converted) |
| `rental_at` / `expected_return_at` | Handover window → calendar `[start, end)` |
| `status` | `DRAFT` / `ACTIVE` / `RETURN_PENDING` / `COMPLETED` / `CANCELLED` |
| `initial_payment_type` | `FIXED_AMOUNT` \| `PERCENTAGE` |
| `initial_payment_rate` | percentage 1–max when type=PERCENTAGE |
| `initial_payment_value` | fils amount recorded |
| `estimated_total` | snapshot at create |
| `notes` | optional |
| audit + soft delete | mixins |

**Not stored:** remaining balance = `estimated_total − initial_payment_value` (API/response derived).

### `rental_items`

| Column | Notes |
|---|---|
| `dress_id` | FK → dresses |
| `agreed_daily_rental_price` | snapshot (fils/day) |
| `expected_rental_days` | `max(1, ceil((end−start)/86400))` — same for all items |
| `calendar_block_id` | `RENTAL` block id |
| `notes` | optional |

Migrations: `20260727_0021_rentals`, `20260728_0022_rentals_align` (drop `remaining_balance`, rename `FIXED` → `FIXED_AMOUNT`).  
Settings: `rentals.number.prefix/separator/padding` (defaults `RENT` / `-` / `8`).

---

## 4. Payment validation

```text
estimated_total = sum(agreed_daily_rental_price * expected_rental_days)
max_pct = settings.maximum_initial_payment_percentage  # 0–100

FIXED_AMOUNT: rate=null; value in [0, estimated_total]
PERCENTAGE:   rate in [1, max_pct]; value = round(estimated_total * rate / 100)
remaining_balance = estimated_total - value  # derived only
```

No ledger, refunds, or final settlement in v1.

---

## 5. Calendar & status

| Path | Calendar | Status Engine |
|---|---|---|
| Walk-in create | `is_available` → `create_block(RENTAL)` | `AVAILABLE → RENTED` |
| From reservation | `remove_block(RESERVATION)` → `create_block(RENTAL)` | `RESERVED → RENTED` |
| Cancel | none | none |

Never write `Dress.status` directly. Never DIY overlap.

---

## 6. API

Permissions: `rental.view`, `rental.create`, `rental.update`, `rental.cancel` (seeded). `rental.return` reserved unused.

| Method | Path | Perm |
|---|---|---|
| `POST` | `/api/v1/rentals` | create |
| `GET` | `/api/v1/rentals` | view |
| `GET` | `/api/v1/rentals/{id}` | view |
| `PATCH` | `/api/v1/rentals/{id}` | update — notes only |
| `POST` | `/api/v1/rentals/{id}/cancel` | cancel — always 422 (+ cancel-attempt audit) |

Create body: `customer_id`, `expected_return_at`, `initial_payment_type`, payment value/rate, optional `rental_at` / `notes` / `reservation_id`, `items[]` (required for walk-in; derived when from reservation).

From reservation: `rental_at = utc_now()`; `expected_return_at` taken from reservation.

Audit: `module="rentals"`, `entity_type="Rental"` (create / update / cancel attempt); reservation conversion audited as `convert` on reservations.

---

## 7. Explicit non-goals

Returns, Inspection, Laundry, Sales, late fees, damage penalties, final payment collection, DRAFT handover flow, usable cancel after handover, `RENTED → AVAILABLE`.

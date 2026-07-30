# Sales Module - Juman

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients  
**Status:** Implemented (v1 atomic dress sales)  
**Scope:** Complete walk-in and mandatory damage-purchase sales with full payment - no void/refund, no partial payment, no general POS

Related: [INSPECTION.md](INSPECTION.md), [RENTAL_FINANCIAL_SETTLEMENT.md](RENTAL_FINANCIAL_SETTLEMENT.md), [RESERVATIONS.md](RESERVATIONS.md), [DRESS_STATE_MACHINE.md](DRESS_STATE_MACHINE.md).

---

## 1. Purpose

Sales posts **atomic, fully paid** transactions that remove dresses from rental inventory:

- **NORMAL_SALE** - sell AVAILABLE dresses at default or overridden price
- **MANDATORY_DAMAGE_PURCHASE** - sell dresses in RUINED_PENDING_SALE after major damage inspection

Each sale is created **COMPLETED** in one request (header + items + payment). There is no draft sale and no v1 void API.

---

## 2. Domain boundaries

| Owns | Does not own |
|---|---|
| Dress sale at full payment | Rental settlement collection |
| Price snapshot per line item | Refunds / void (SaleStatus.VOIDED reserved) |
| Mandatory purchase from inspection | Partial payments / layaway |
| SAL-######## numbering | General POS (payment.*) |
| Status -> SOLD on success | Reports |

Permissions: sale.view, sale.create (Cashier + Admin). Seeds also define sale.update / sale.cancel for future use.

---

## 3. Workflows

### 3.1 Normal sale

```text
AVAILABLE dress + optional customer -> lock dress -> validate -> issue SAL number
  -> persist sale/items/payment -> Status Engine SOLD -> audit CREATE + COMPLETE
```

### 3.2 Mandatory damage purchase

```text
COMPLETED inspection (MAJOR_DAMAGE, send_to_ruined, no penalty)
  -> dress RUINED_PENDING_SALE -> mandatory sale with matching rental customer
  -> link rental/return/inspection/inspection_item -> SOLD
```

Normal sale of RUINED_PENDING_SALE is rejected; mandatory path is required.

---

## 4. Eligibility

### Normal sale (NORMAL_SALE)

- Dress is_active = true
- Dress status AVAILABLE
- Dress not soft-deleted
- No future RESERVATION calendar block with end_at > now (see section 5)
- Each dress appears once per sale
- Payment amount must equal sum of line actual_sale_price

### Mandatory sale (MANDATORY_DAMAGE_PURCHASE)

- Exactly one item; inspection_item_id required
- customer_id required and must equal rental customer (sale_customer_mismatch if not)
- Inspection item: MAJOR_DAMAGE, send_to_ruined = true, repair_penalty_amount null
- Inspection status COMPLETED
- Dress status RUINED_PENDING_SALE
- Inspection item not already sold (unique constraint)
- Same future reservation rule as normal sale

### Rejected states (normal sale)

| Dress status | Result |
|---|---|
| RENTED | ValidationError |
| PROCESSING | ValidationError |
| RESERVED | ValidationError (status gate before calendar check) |
| RUINED_PENDING_SALE | ValidationError - use mandatory |
| SOLD | ValidationError |
| Soft-deleted | NotFoundError at lock |

---

## 5. Future reservation rule

Before persisting any sale, SaleService._reject_future_reservation scans the dress calendar from now forward.

If any live block has:

- block_type = RESERVATION, and
- end_at > now

the sale fails with BusinessError code **sale_blocked_by_future_reservation**.

**Notes:**

- Past reservation blocks (end_at <= now) do not block.
- Cancelled/expired reservations remove blocks; sale proceeds.
- Confirmed reservations typically leave dress RESERVED, which normal sale already rejects; the calendar rule still protects AVAILABLE dresses with orphaned future reservation blocks.

---

## 6. Pricing

- Default line price: dress default_sale_price at lock time (integer fils).
- actual_sale_price optional on input; defaults to dress default when omitted.
- Line stores **frozen** default_sale_price + actual_sale_price snapshots.
- Setting allow_manual_sale_price_override (default true): when false, actual_sale_price must equal default.
- Overrides trigger audit action CUSTOM with message for price difference.

---

## 7. Customer policy

- Normal sale: customer_id optional.
- Mandatory sale: customer_id **required** and must match the originating rental customer.
- Mismatch raises BusinessError code **sale_customer_mismatch**.

---

## 8. Payment

- Exactly **one** payment row per sale (v1).
- payment.amount must equal total_amount (sum of line actual prices).
- Methods: CASH, CARD, BANK_TRANSFER, OTHER.
- Optional reference_number (max 100), notes, received_at (defaults to sale time).

No partial payment, change tracking, or settlement credit.

---

## 9. Data model

Migration: 20260728_0027_sales.

### sales

sale_number, origin, status (COMPLETED; VOIDED reserved), optional customer_id, optional rental_id / return_id / inspection_id, total_amount, sold_at, sold_by, notes.

### sale_items

Append-only. Unique dress_id (one completed sale per dress lifetime). Optional unique inspection_item_id for mandatory sales. Frozen price snapshots.

### sale_payments

Append-only payment against the sale header.

Settings seeds: sale.number.prefix (SAL), sale.number.separator (-), sale.number.padding (8).

---

## 10. Status transitions

On successful sale (both origins):

```text
AVAILABLE | RUINED_PENDING_SALE  --sale_completed-->  SOLD
```

Status changes go through DressStatusService only. Calendar blocks from reservations/rentals are **not** auto-removed by Sales v1.

---

## 11. Permissions

| Key | Cashier | Admin | Laundry |
|---|---|---|---|
| sale.view | yes | yes | no |
| sale.create | yes | yes | no |

APIs under /api/v1/sales require Bearer + permission.

---

## 12. Audit

Module key: sales, entity type Sale.

| Event | Action |
|---|---|
| Sale persisted | CREATE |
| Sale completed | COMPLETE |
| Price override | CUSTOM (metadata overrides) |
| Mandatory completed | CUSTOM (inspection_item_id metadata) |

---

## 13. Concurrency

- Dress rows locked with SELECT ... FOR UPDATE via DressRepository.get_for_update before validation and persist.
- Sale numbers issued via BarcodeCounter row lock (SaleNumberService.generate_next).
- Duplicate dress in concurrent sales: second transaction fails on unique sale_items.dress_id or status gate.

---

## 14. Exclusions (v1)

- No void / cancel API (SaleStatus.VOIDED enum only)
- No partial or split payments
- No multi-payment tenders
- No automatic calendar cleanup
- No integration with rental settlement balances
- No sale.update / sale.cancel HTTP routes

---

## 15. API summary

| Method | Path | Permission |
|---|---|---|
| GET | /api/v1/sales | sale.view |
| GET | /api/v1/sales/{id} | sale.view |
| POST | /api/v1/sales | sale.create |

List filters: status, origin, customer_id, sort_by, sort_dir, pagination.

---

## 16. Next integration points

- General POS module (payment.*) for non-dress tenders
- Reports (sales by period, cashier, origin)
- Optional void flow using seeded sale.cancel permission

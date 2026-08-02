# Backend V2 Settlement Design (Phase 6.2)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/finance/settlement`  
**Role:** Sole authority for rental **financial completion**.

## Scope

**In scope:** `RentalSettlement`, `SettlementHistory`, settlement statuses, `SettlementService` (create / apply payment / outstanding / mark paid / close / cancel), HTTP `/settlements`, RBAC, rental checkout + complete integration, audit.

**Out of scope:** Late fees, penalty engine, reports, invoices, notifications.

## Architecture rules

1. Settlement is a **separate service** inside the finance bounded context.
2. Rental **never** calculates balances or decides financial completion.
3. Payments **never** determine completion — only Settlement status does.
4. Settlement **never edits** Payment rows; it asks `FinanceService.registerPaymentInTx`.
5. Rental operational completion (`return_pending → completed`) requires `SettlementService.assertFinanciallyComplete`.
6. Checkout creates Settlement after charge/deposit; payment against a rental obligation goes through `POST /settlements/:id/payment`.

## Statuses

| Status | Meaning |
|--------|---------|
| `open` | Obligation unpaid |
| `partially_paid` | Some payments applied |
| `paid` | `remainingFils === 0` — financially complete |
| `cancelled` | Voided with no applied payments |
| `closed` | Books closed after paid |

Transitions:

```
open → partially_paid | paid | cancelled
partially_paid → partially_paid | paid | cancelled
paid → closed
cancelled / closed → ∅
```

Financial completion for rental close: status ∈ `{ paid, closed }`.

## Models

### RentalSettlement
One per rental (`rentalId` unique). Fields: `totalFils`, `paidFils`, `remainingFils` (IQD fils), `status`, link to `FinancialAccount`.

Total = charge − deposit at checkout. Deposit reduces settlement total; it does not invent a separate settlement balance on Rental.

### SettlementHistory
Append-only trail: created, payment_applied (with `paymentId` + `amountFils`), marked_paid, closed, cancelled.

## SettlementService API

| Method | Effect |
|--------|--------|
| `createForRental` | Idempotent settlement after checkout |
| `applyPayment` | Register Payment via Finance + CAS update balances |
| `outstandingOf` / remaining on public model | Remaining balance |
| `markPaid` | Force `paid` when remaining is already 0 |
| `close` | `paid → closed` |
| `cancel` | Cancel only if `paidFils === 0` |
| `assertFinanciallyComplete` | Rental complete gate |

Concurrent payments use settlement row lock + CAS on `(remainingFils, status)`.

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| GET | `/settlements` | finance.settlement.view |
| GET | `/settlements/:id` | finance.settlement.view |
| POST | `/settlements/:id/payment` | finance.settlement.manage |
| POST | `/settlements/:id/close` | finance.settlement.manage |
| POST | `/settlements/:id/cancel` | finance.settlement.manage |

Rental: `POST /rentals/:id/complete` (requires financially complete settlement).

## RBAC

`finance.settlement.view` · `finance.settlement.manage`

## Audit

Platform audit + settlement history for: created, payment_applied, closed, cancelled (and marked_paid).

## Technical debt (do not ignore)

**Ledger payment vs settlement payment.** `POST /finance/payments` still mutates account outstanding without updating `RentalSettlement`. Rental financial completion ignores ledger outstanding and reads Settlement only. Until a later phase unifies this (e.g. block ledger payments while an open settlement exists, or require `settlementId` on payment), operators must use `/settlements/:id/payment` for rental obligations. Leaving both paths unconstrained will produce silent balance drift.

## Coverage

```bash
pnpm test:cov:finance
```

Gate: ≥95% lines/functions/statements on `src/finance/**` (includes settlement).

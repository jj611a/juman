# Backend V2 Financial Design (Phase 6.1 + 6.2)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/finance`  
**Role:** Accounting foundation + settlement completion authority.

## Scope

**In scope:** FinancialAccount, FinancialTransaction, Payment, MoneyMovement, FinancialAudit; Money value object (IQD fils); createCharge / registerDeposit / registerPayment; outstanding; Settlement (`RentalSettlement`, `SettlementHistory`); HTTP foundation; RBAC; rental checkout + complete integration.

**Out of scope:** Late fees, penalties, invoices, reports, export, notifications.

See also: `SettlementDesign.md` (Phase 6.2).

## Architecture rules

1. Financial is a **separate bounded context**.
2. Rental **never** stores balances.
3. Inventory **never** stores balances.
4. Payments **never** mutate rental rows.
5. `RentalsService` requests `FinanceService.createCharge` / `registerDeposit` and `SettlementService.createForRental`.
6. `SettlementService` owns rental **balances** and **financial completion**.
7. `FinanceService` publishes append-only ledger entries (charge, deposit, payment, movement).
8. Ledger never owns rental balances — outstanding for accounts with settlements is Settlement remaining.
9. Standalone `POST /finance/payments` is rejected while open/partial settlements exist.
10. Settlement never edits Payment rows; it calls `registerPaymentInTx` to publish ledger history.

## Money

`Money` value object (`src/finance/money/money.value.ts`):

- Currency: **IQD only**
- Storage: **integer fils** (1000 fils = 1 IQD)
- No floating-point arithmetic in domain paths
- Centralized add/subtract/validate via shared `Fils` helpers

## Models

### FinancialAccount
One open ledger per customer (`customerId` unique). `accountNumber` FIN-########.

### FinancialTransaction
Types: `rental_charge` · `deposit` · `payment` · `refund` (foundation) · `adjustment`  
Status: `pending` · `posted` · `voided`  
Outstanding delta: charge/refund **+**; deposit/payment **-**; adjustment uses signed amount.

### Payment
Statuses: `pending` · `completed` · `cancelled` · `refunded` (foundation)  
`paymentNumber` PAY-########. Completing a payment posts a `payment` transaction + money movement.

### MoneyMovement
Immutable trail: `in` / `out` with kind charge|deposit|payment|refund|adjustment.

### FinancialAudit
Append-only finance-domain audit (complements platform `AuditService`).

### RentalSettlement / SettlementHistory
See `SettlementDesign.md`. One settlement per rental; status decides financial completion.

## FinancialService API

| Method | Effect |
|--------|--------|
| `createCharge` | Post rental_charge; +outstanding |
| `registerDeposit` | Post deposit; −outstanding |
| `registerPayment` | Complete payment + post payment txn; −outstanding |
| `registerPaymentInTx` | Same inside outer TX (used by Settlement) |
| `outstandingForAccount` / `getOutstanding` | Sum posted deltas |
| list accounts / transactions / payments | Read models |

## Rental integration

On checkout:

1. Inventory/lifecycle TX completes
2. `syncCheckoutFinance` → `createCharge` (+ optional `registerDeposit`)
3. `SettlementService.createForRental` (total = charge − deposit)

On complete (`return_pending → completed`):

1. `SettlementService.assertFinanciallyComplete(rentalId)`
2. Only then transition rental to `completed`

Rental operational close ≠ financial completion unless Settlement says so.

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| GET | `/finance/accounts` | finance.view |
| GET | `/finance/transactions` | finance.view |
| GET | `/finance/payments` | finance.view |
| POST | `/finance/payments` | finance.payment |
| GET | `/finance/outstanding` | finance.view |
| GET | `/settlements` | finance.settlement.view |
| GET | `/settlements/:id` | finance.settlement.view |
| POST | `/settlements/:id/payment` | finance.settlement.manage |
| POST | `/settlements/:id/close` | finance.settlement.manage |
| POST | `/settlements/:id/cancel` | finance.settlement.manage |

## RBAC

`finance.view` · `finance.payment` · `finance.adjustment` · `finance.settlement.view` · `finance.settlement.manage`

## Coverage

```bash
pnpm test:cov:finance
```

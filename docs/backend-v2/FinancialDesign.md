# Backend V2 Financial Design (Phase 6.1)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/finance`  
**Role:** Accounting foundation — charges, deposits, payments, outstanding balance.

## Scope

**In scope:** FinancialAccount, FinancialTransaction, Payment, MoneyMovement, FinancialAudit; Money value object (IQD fils); createCharge / registerDeposit / registerPayment; outstanding; HTTP foundation; RBAC; rental checkout integration.

**Out of scope:** Settlement, late fees, penalties, invoices, reports, export, notifications, refunds beyond foundation type.

## Architecture rules

1. Financial is a **separate bounded context**.
2. Rental **never** stores balances.
3. Inventory **never** stores balances.
4. Payments **never** mutate rental rows.
5. `RentalsService` requests `FinanceService.createCharge` / `registerDeposit`.
6. `FinanceService` owns all money mutations.
7. Balances are **computed**, never denormalized on the account row.

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

## FinancialService API

| Method | Effect |
|--------|--------|
| `createCharge` | Post rental_charge; +outstanding |
| `registerDeposit` | Post deposit; −outstanding |
| `registerPayment` | Complete payment + post payment txn; −outstanding |
| `outstandingForAccount` / `getOutstanding` | Sum posted deltas |
| list accounts / transactions / payments | Read models |

Allocation of numbers + account lock serialize concurrent payments on SQLite.

## Rental integration

On rental (and reservation→rental) checkout:

1. Inventory/lifecycle TX completes
2. `RentalsService.syncCheckoutFinance` → `createCharge(sum agreedRentalPrice)`
3. Optional `depositAmountFils` → `registerDeposit`

Charges are idempotent per `(rental_charge, rental, rentalId)`.

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| GET | `/finance/accounts` | finance.view |
| GET | `/finance/transactions` | finance.view |
| GET | `/finance/payments` | finance.view |
| POST | `/finance/payments` | finance.payment |
| GET | `/finance/outstanding` | finance.view |

## RBAC

`finance.view` · `finance.payment` · `finance.adjustment` (seeded; adjustment HTTP deferred)

## Coverage

```bash
pnpm test:cov:finance
```

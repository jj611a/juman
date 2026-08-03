# Backend V2 Financial Design (Phase 6.1–6.6)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/finance`  
**Role:** Accounting foundation + **Settlement as sole financial authority**.

## Scope

**In scope:** FinancialAccount, FinancialTransaction, Payment, MoneyMovement, FinancialAudit; Money VO (IQD fils); charge / deposit / payment; Settlement + Refund / Adjustment / Discount / LateFee domain; centralized formulas; HTTP; RBAC; rental checkout + complete.

**Out of scope:** Dashboards as a separate product surface beyond Reports HTTP; invoices; late-fee **scheduler**; desktop integration. Reporting reads Settlement/Finance/Payment aggregates but lives in `ReportsModule` — see `ReportingDesign.md`.

See also: `SettlementDesign.md`.

## Architecture rules

1. Financial is a **separate bounded context**.
2. Rental / inventory **never** store balances.
3. **Every monetary change** passes through `SettlementService` (or checkout `*InTx` under Settlement create).
4. Payments **never** mutate rental rows; Settlement **never** mutates Payment rows.
5. Ledger is **append-only** (void = status change, not delete).
6. Standalone `POST /finance/payments` rejected while open/partial settlements exist.
7. Platform audit may sit outside Prisma TX; `FinancialAudit` / settlement history inside.

## Authoritative formula (single source)

`src/finance/settlement/settlement.formula.ts`:

```
Charges        = chargeFils − depositFils   // deposit reduces charges at checkout
Settlement Total =
  Charges
+ Late Fees
+ Adjustments        // signed
− Discounts
− Refunds

Outstanding / remaining = Settlement Total − paidFils
```

Do **not** duplicate this arithmetic elsewhere.

## Engines (Phase 6.6)

| Engine | Entity | Ledger type | Effect on total |
|--------|--------|-------------|-----------------|
| Refund | `SettlementRefund` + `SettlementRefundHistory` | `refund` | − |
| Adjustment | `SettlementAdjustment` | `adjustment` (signed) | ± |
| Discount | `SettlementDiscount` (fixed / %) | `discount` | − |
| Late fee | `SettlementLateFee` (flat / daily + max) | `late_fee` | + |

HTTP (Settlement-owned):

- `POST /settlements/:id/refund`
- `POST /settlements/:id/adjustment` (`finance.adjustment`)
- `POST /settlements/:id/discount`
- `POST /settlements/:id/late-fee` — **assessment only**, no scheduler

## Money

`Money` value object — integer fils only; no floats.

## Coverage

```bash
pnpm test:cov:finance
```

Gate: ≥95% on `src/finance/**`.

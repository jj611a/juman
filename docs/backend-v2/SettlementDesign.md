# Backend V2 Settlement Design (Phase 6.2–6.6)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/finance/settlement`  
**Role:** **Sole authority** for rental financial state and completion.

## Scope

**In scope:** Settlement create / payment / refund / adjustment / discount / late-fee assessment; status machine; HTTP `/settlements`; RBAC; checkout + complete gates; centralized formulas.

**Out of scope:** Reports, dashboards, late-fee scheduler, invoices.

## Formula (authoritative)

See `settlement.formula.ts` and `FinancialDesign.md`:

```
Total = (charge − deposit) + lateFees + adjustments − discounts − refunds
Remaining = Total − paidFils
```

## Statuses

| Status | Meaning |
|--------|---------|
| `open` | Unpaid |
| `partially_paid` | Some payments |
| `paid` | remaining === 0 |
| `cancelled` | Voided (open unpaid / zero-obligation) |
| `closed` | Books closed after paid |

HTTP cancel: **open unpaid only**. Partial/paid rental cancel still requires refund product path when money was collected.

## Models

### RentalSettlement
Components: `chargeFils`, `depositFils`, `lateFeeFils`, `adjustmentFils`, `discountFils`, `refundFils`, plus `totalFils` / `paidFils` / `remainingFils`.

### SettlementRefund + SettlementRefundHistory
Credit-note refunds. Append-only history. Never mutates Payment.

### SettlementAdjustment / SettlementDiscount / SettlementLateFee
Posted modifiers with ledger compensation via `FinanceService.postSettlementModifierInTx`.

## HTTP

| Method | Path |
|--------|------|
| POST | `/settlements/:id/payment` |
| POST | `/settlements/:id/refund` |
| POST | `/settlements/:id/adjustment` |
| POST | `/settlements/:id/discount` |
| POST | `/settlements/:id/late-fee` |
| POST | `/settlements/:id/close` |
| POST | `/settlements/:id/cancel` |

## Coverage

```bash
pnpm test:cov:finance
```

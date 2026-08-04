# Backend V2 Sales Design (Phase 6.7)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/sales`  
**Role:** Permanent sale engine for inventory items. Sales owns only the sale document; Inventory/Lifecycle, Settlement, Finance, Barcode, and Media remain authoritative for their domains.

## Scope

**In scope:** `Sale` / `SaleItem` / `SaleHistory`; draft → confirmed → completed workflow; cancel before completion; Walk-in customer; polymorphic Settlement (`entityType=sale`); `sale_*` ledger types; HTTP `/sales`; RBAC; exclusive TX orchestration via `SalesTransactionService`.

**Out of scope:** POS UI, receipts, scanners, returns/exchanges, refund product path, analytics dashboards, report HTTP changes (docs only for future aggregates).

## Architecture rules

1. `SalesService` never mutates inventory or money directly.
2. `SalesTransactionService` orchestrates `AvailabilityService` → `LifecycleService` → `SettlementService` → `FinanceService` inside one Prisma TX (`runExclusive`).
3. Settlement formulas stay in `settlement.formula.ts` — Sales never recalculates obligations.
4. Lifecycle mutations only via `LifecycleService.transition`.
5. Barcodes stay attached (`activated`); media stays on the item via MediaReference.

```
HTTP /sales
  → SalesController (RBAC)
  → SalesService (document CRUD)
  → SalesTransactionService (confirm / payment / complete / cancel)
       → AvailabilityService.runExclusive
       → LifecycleService
       → SettlementService
       → FinanceService
       → AuditService
```

## Status machine

| Status | Meaning |
|--------|---------|
| `draft` | Document + lines only |
| `confirmed` | Items held (`for_sale`); Settlement + `sale_charge` posted |
| `completed` | Items `sold`; irreversible |
| `cancelled` | Before completed only |

## Confirm / complete / cancel

| Step | Effects |
|------|---------|
| Confirm | Verify `isSellable` → `available\|for_sale → for_sale` → Settlement (`entityType=sale`) → `sale_charge` → status `confirmed` |
| Payment | `SettlementService.applyPayment` → ledger `sale_payment` |
| Complete | `for_sale → sold` → optional payment → `completed` |
| Cancel (draft) | Status only |
| Cancel (confirmed) | Void `sale_charge` + cancel settlement + `for_sale → available` (blocked if paid) |

## Walk-in customer

Seeded `WALK-IN` customer + FinancialAccount on boot. Anonymous sales settle there. Assigning `customerId` before completion reassigns Settlement account via `SettlementService.reassignCustomerInTx`.

## Lifecycle

Allowed sell edges: `available → sold`, `available → for_sale → sold`.  
Sold is terminal for rent/reserve/restore; only `sold → retired` remains. Soft-delete blocked for `sold` and `for_sale`.

## Settlement polymorphism

`RentalSettlement` rows carry `entityType` + `entityId` (source of truth).  
`rentalId` / `saleId` kept for convenience + back-compat.  
`createForRentalInTx` is a façade over `createForEntityInTx`.

## Ledger types

| Type | Use |
|------|-----|
| `sale_charge` | Sale obligation |
| `sale_payment` | Payment against sale settlement |
| `sale_discount` / `sale_adjustment` / `sale_refund` | Reserved for future Settlement modifiers |

Never reuse `rental_charge` for sales.

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| GET | `/sales` | `sales.view` |
| GET | `/sales/:id` | `sales.view` |
| GET | `/sales/:id/history` | `sales.view` |
| POST | `/sales` | `sales.create` |
| POST | `/sales/:id/confirm` | `sales.create` \| `sales.complete` |
| POST | `/sales/:id/payment` | `sales.payment` |
| POST | `/sales/:id/complete` | `sales.complete` |
| POST | `/sales/:id/cancel` | `sales.cancel` |

Legacy aliases `sale.*` remain seeded for Cashier roles.

## Coverage

```bash
pnpm test:cov:sales
```

Gate: lines ≥88% / statements ≥85% on `src/sales/**` (Phase 6.7 interim; target 95% remediation).

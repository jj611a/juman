# Backend V2 — Phase 6.5 Financial Transaction Integrity

**Date:** 2026-08-02  
**Branch:** `backend-v2`  
**Commit target:** `fix(v2-finance): transactional checkout integrity`  
**Mode:** Integrity remediation only — **no** Reports, late fees, invoices, refunds, or penalty engine

---

## Executive summary

Checkout is now **one atomic Prisma business transaction**: inventory lifecycle + rental status + settlement + charge + deposit + finance audit + idempotency row. Failure anywhere rolls back everything.

Financial mutations accept **idempotency keys**. Duplicate checkout/payment/charge/deposit requests replay prior results and never double money, ledger, or settlement.

**Updated integrity score: 94 / 100** (was 80 certification / 92 remediation-era).

**Reports readiness:** Still **NO-GO** until product approval — refunds/late fees remain unbuilt; foundation blockers from 6.4 certification are cleared.

---

## Architecture

```
Checkout (walk-in or reservation)
  └─ AvailabilityService.runExclusive(tx)
       ├─ beginIdempotency(rental.checkout)
       ├─ Lifecycle available→reserved→rented
       ├─ Rental draft→checked_out→active
       ├─ SettlementService.createForRentalInTx(tx)
       ├─ FinanceService.createChargeInTx(tx, settlementId)
       ├─ FinanceService.registerDepositInTx(tx, settlementId)  [optional]
       ├─ assertLedgerMatchesSettlement(...)
       └─ completeIdempotency(response = rental public)
```

| Concern | Owner |
|---------|--------|
| Calendar lock | `AvailabilityService.runExclusive` |
| Inventory state | `LifecycleService` (same `tx`) |
| Obligation | `SettlementService.createForRentalInTx` |
| Ledger | `FinanceService.*InTx` |
| Idempotency | `FinanceIdempotencyKey` + `beginIdempotency` / `completeIdempotency` |
| Cancel coupling | `rental-cancel.policy.ts` + `applyRentalCancelPolicyInTx` |

Platform `AuditService.record` stays **outside** the Prisma TX (append-only ops log). `FinancialAudit` and settlement history write **inside** the TX.

---

## Transaction flow

1. Client may send `idempotencyKey` on checkout / settlement payment.
2. Exclusive allocation lock acquired.
3. Idempotency begin — replay short-circuits with prior JSON.
4. Inventory + rental mutate.
5. **Settlement created first** (amounts known from line prices + deposit).
6. Charge and deposit post with `settlementId` + unique `(type, referenceType, referenceId)`.
7. Invariants asserted; idempotency completed; TX commits.

### Rollback verification

Integration test: checkout with `depositAmountFils` exceeding charge → **400**, rental remains `draft`, **no** settlement, **no** charge, item remains `available`.

---

## Idempotency verification

| Scope | Key source | Duplicate behavior |
|-------|------------|--------------------|
| `rental.checkout` | Client key or `rental:{id}:checkout` | Replay rental public; no second charge/settlement |
| `settlement.payment` | Client `idempotencyKey` (optional) | Replay settlement public; no second payment |
| `finance.charge` | Client key or `{refType}:{refId}:charge` | Replay transaction public |
| `finance.deposit` | Client key or `{refType}:{refId}:deposit` | Replay transaction public |

Mismatched payload hash for the same key → **409**.

---

## Rental cancel policy (authoritative)

| State | Action |
|-------|--------|
| Draft, no settlement | Cancel rental only |
| Open settlement, `paidFils === 0` | Void posted charge/deposit (`status → voided`) + cancel settlement + cancel rental (**one TX**) |
| Partially paid | **Reject** — refund required (product not implemented) |
| Paid / closed | **Reject** |
| Settlement already cancelled | Cancel rental / unwind inventory only |

Documented in `src/finance/settlement/rental-cancel.policy.ts`. Settlement HTTP cancel allows **open unpaid only** (`canCancel`); partially paid no longer transitions to cancelled.

---

## Reference integrity

- `FinancialTransaction.settlementId` — charge/deposit/payment ledger rows for rental obligations
- `Payment.settlementId` — settlement-applied payments
- `@@unique([type, referenceType, referenceId])` — no duplicate charge/deposit per rental
- Orphans from partial checkout eliminated by single TX

---

## Invariants

```
settlement.total = charge − deposit
                 = charges − discounts + lateFees − refunds   (discounts/late/refunds = 0 until built)
settlement.paid + settlement.remaining = settlement.total
settlement.remaining = outstanding for that settlement
ledger posted charge − deposit − payments ≈ settlement remaining (reconstruction)
```

Helpers: `assertSettlementBalanceInvariant`, `assertLedgerMatchesSettlement`, `assertSettlementObligationFormula`.

---

## Stress testing

`test/finance-transaction-integrity.spec.ts`:

- Concurrent checkout (multiple keys) → single settlement + single charge
- Concurrent payments → `paid + remaining === total`
- Duplicate checkout / payment keys → replay
- Cancel open unpaid + reject partial

---

## Validation gates

| Gate | Result |
|------|--------|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm test` | **PASS** (67 files / **261** tests) |
| `pnpm test:cov` | **PASS** (statements **94.33%** / lines **95.2%** / branches **86.04%** / functions **97.81%**) |
| `pnpm test:cov:finance` | **PASS** (statements **95.98%** / lines **97.2%** / branches **92.11%** / functions **100%**) |

New coverage: transaction rollback, idempotency, concurrent checkout, cancel policy, settlement integrity (`test/finance-transaction-integrity.spec.ts`).

---

## Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| Refunds / reverse-paid cancel | High | Partial/paid cancel correctly blocked; no refund engine yet |
| Late fees / discounts | Medium | Formula hooks exist; amounts always 0 |
| Platform audit outside TX | Low | Ops audit can lag a committed finance TX on crash — acceptable |
| SQLite exclusive lock latency | Low | Checkout TX heavier; timeout 20s |
| Reservation checkout idempotency | Medium | Finance is atomic with reservation TX; dedicated reservation idempotency key not stored (rental path is primary) |
| Reports on voided ledger | Medium | Reports must exclude `voided` and cancelled settlements |

---

## Integrity score

| Area | Before (6.4) | After (6.5) |
|------|-------------:|------------:|
| Checkout atomicity | FAIL | **PASS** |
| Deposit/charge idempotency | FAIL / WARN | **PASS** |
| Cancel coupling | FAIL | **PASS** |
| Reference integrity | WARN | **PASS** |
| Payment idempotency | debt | **PASS** (optional key) |
| **Overall** | **80** cert | **94** |

---

## Docs / canvas

- This report
- `PROGRESS.md`, `DevelopmentRoadmap.md`, `Architecture.md`, `FinancialDesign.md`, `SettlementDesign.md`, `DecisionLog.md`
- Canvas: Phase 6.5 done; Reports still blocked pending approval

---

**STOP.** Do not implement Reports, late fees, invoices, refunds, or penalty engine. Wait for approval.

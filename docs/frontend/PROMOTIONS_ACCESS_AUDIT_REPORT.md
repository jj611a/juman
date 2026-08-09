# PROMOTIONS + ACCOUNT ACCESS AUDIT REPORT

**Juman V2** — Electron + React + NestJS + Prisma + SQLite
**Mode:** EXISTING SYSTEM AUDIT FIRST (read-only)
**Date:** 2026-08-09
**Branch:** backend-v2
**Auditor:** opencode (read-only exploration + direct verification)

---

## 1. Executive Summary

Juman V2 does **not** have a Promotions domain, coupons, or offers. What exists is a
**real, well-guarded settlement-level discount engine** plus a **fixed-fils sale discount**
captured at document creation. The backend is the authoritative owner of all money:
integer-fils everywhere, negative-total guards, paid/closed protection, idempotency, and
three layers of audit. The frontend's discount UI already talks to these real endpoints —
the POS discount is **not fake/local-only**.

The account-access model is **strong on the security side** (session-bound JWTs, refresh
rotation with reuse detection, lockout + rate limiting, password policy, fresh permission
resolution per request) and **absent on the management side** (no users/roles/permissions
HTTP surface at all, so no admin UI is possible and the admin-safety guards are latent).

The dominant findings are **naming/drift defects in the permission catalog**:
- **`availability.view` is enforced by 3 backend endpoints but never seeded** → every role,
  **including Admin**, gets 403 on all `/availability/*` endpoints.
- **Frontend gates reservations/rentals/availability with keys the backend never seeds or
  never enforces** (`reservation.checkout`, `reservation.expire`, `rental.checkout`,
  `availability.view`), so the corresponding UI actions are permanently hidden for every
  non-Admin user while the backend would actually permit them.
- **40+ of 104 seeded permission keys are never enforced by any controller**, and the
  singular/plural legacy families (`sale.*`/`sales.*`, `rental.*`/`rentals.*`,
  `reservation.*`/`reservations.*`, `rental.settlement.*`/`finance.settlement.*`) create
  audit ambiguity.

No implementation changes were made in this audit phase. A set of **frontend-only, backend-
supported corrections** is proposed in §16 pending approval. Backend changes are explicitly
NOT performed (§17).

---

## 2. Existing System Discovery

| Layer | Location | State |
|---|---|---|
| Backend | `backend-node/` (NestJS 10 + Prisma + SQLite) | ~95% complete, Nest contract frozen, all gates green |
| Frontend | `frontend/` (React 19 + Vite + daisyUI 5 + TanStack Query v5) | Phase 9.9A done (~99.3%) |
| Legacy | `frontend-legacy/` | FROZEN, reference only |
| Docs | `docs/` + `docs/backend-v2/` + `docs/frontend/` + `frontend/docs/` | Phase reports, ADRs, PROGRESS, feature maps |

### Backend modules (Nest)
`auth`, `audit`, `availability`, `barcode`, `config`, `core`, `customers`, `database`,
`exceptions`, `finance` (+ nested `finance/settlement`), `health`, `inventory` (items,
lifecycle, brands, categories, colors, sizes), `logging`, `media`, `permissions`, `rentals`,
`reports`, `reservations`, `roles`, `sales`, `security`, `settings`, `shared`, `storage`,
`users`, `validation`.

### Frontend features (`frontend/src/features/`)
`audit`, `authentication`, `barcode`, `brands`, `categories`, `colors`, `customers`,
`dashboard`, `diagnostics`, `finance`, `hardware`, `inventory`, `media`, `permissions`,
`pos`, `receipts`, `rentals`, `reports`, `reservations`, `roles` (empty scaffold), `sales`,
`settings` (empty scaffold), `settlements`, `shell-placeholders`, `sizes`, `startup`,
`users` (empty scaffold).

### Architecture invariant (preserved)
Renderer never calls Nest directly. Renderer → `window.juman.api.invoke` (IPC `api:invoke`)
→ Electron Main (`register.ts` → axios with token refresh) → Nest HTTP. Renderer never holds
JWTs; permissions arrive inside `SessionView.user.permissions`.

---

## 3. Backend Promotions Capability

**There is no Promotions domain.** No module, controller, service, or table named
`promotion`/`coupon`/`offer` exists (grep = 0 matches in `backend-node/src` and the Prisma
schema).

The discount machinery that **does** exist:

1. **Settlement discount (real, rich):**
   - `POST /settlements/:id/discount` — `settlement.controller.ts:78-87`,
     DTO `settlement-modifiers.dto.ts:50-79` (`kind: percentage|fixed`,
     `basis: rental|settlement`, `percentBps` 1–10000, `amountFils` ≥1, `reason` required,
     optional `idempotencyKey`).
   - Executor `SettlementModifierService.applyDiscount` (`settlement-modifier.service.ts:276`),
     invoked only via `SettlementService` (`settlement.service.ts:798`).
   - Persisted as `SettlementDiscount` rows (`schema.prisma:1024-1052`) and posted to the
     ledger as `FINANCIAL_TX_TYPE.DISCOUNT`.
2. **Sale discount (fixed-fils only, at creation):**
   - `POST /sales` accepts header `discountFils` and per-line `discountFils`
     (`sale.dto.ts:28,57`); computed in `sales.service.ts:161-188`.
   - No percentage, no post-create edit (sales controller has no PATCH/PUT).
3. **Rental discount:** only at settlement level after checkout (`rentals.service.ts:387-390`
   creates settlement with zero discount; discount comes via the settlement endpoint).

**Answer set (Part 2):**
- A. Promotions domain? **No.** B. Promotion tables? **No.** C. SettlementModifierService? **Yes.**
- D. Sale discounts? **Yes, fixed-fils at creation only.** E. Rental discounts? **Yes, settlement-level only.**
- F. Cashier manual discount via API? **Yes** (`finance.settlement.manage` + `sales.create` are Cashier-granted).
- G. Permission-controlled? **Yes** — `finance.settlement.manage` for settlement discounts, `sales.create`/`sale.create` for sale discounts. No dedicated `discount.*` key, no per-role discount cap, no approval workflow.
- H. Audited? **Yes, 3 layers** (§5). I. In settlement totals? **Yes** (authoritative formula). J. In reports? **Partially** (financial summary only; sale discounts invisible because `SALE_DISCOUNT` is never posted — see §14).

---

## 4. Frontend Promotions Capability

- **POS discount is real, not fake.** `POSWorkspace.tsx:297` sends `discountFils: discountAmount * 1000`
  to `POST /sales`. Backend recomputes `subtotal/discount/total` authoritatively
  (`sales.service.ts:183-199`).
- **Settlements discount is real.** `SettlementsPage.tsx:99` calls `POST /settlements/:id/discount`
  — **but only ever `kind: 'fixed'`**. Percentage (`percentBps`) exists in backend + TS types
  (`settlements/api/api.ts:90-103`) and is **unused by any UI**.
- **Money is computed independently in the renderer in several places** (see §5 of the frontend
  discount exploration and §13 of this doc): POS cart estimate (`POSWorkspace.tsx:338-340`),
  input conversions (`Math.round(Number(x)*1000)`), receipt fallbacks
  (`receipts/utils/receipt.ts:128,185-192`). All are **display estimates or input conversion**;
  the authoritative totals always come back from backend DTOs. There is **no fake local persistence**.
- No promotions/coupons UI anywhere (grep `promotion` = 0 matches in `frontend/`).

---

## 5. Discount / Settlement Flow

```
Checkout (rental)  → RentalSettlement created, chargeFils = Σ agreedRentalPrice, discount=0
Sale create        → Sale.subtotalFils, discountFils (header + line), totalFils (backend)
Sale confirm       → settlement created with chargeFils = sale.totalFils (already net of sale discount)
POST /settlements/:id/discount
   → SettlementModifierService.applyDiscount
        basis = charge − deposit   (basis=rental)   |   basis = current totalFils  (basis=settlement)
        computed = floor(basis * percentBps / 10000) | computed = amountFils
        writes SettlementDiscount row (posted)
        posts ledger FINANCIAL_TX_TYPE.DISCOUNT (direction IN, reduces outstanding)
        recalculateSettlementBalances → totalFils = (charge − deposit) + late + adjustment − discount − refund
        assertSettlementComponentsMatchTotal + assertSettlementBalanceInvariant (integrity guards)
```

**Money representation:** integer fils everywhere. `Fils` branded int + `assertFils`
(`src/shared/money/money.ts:6-36`); `Money` VO (`finance/money/money.value.ts`); percentages
as integer basis points (`Math.floor(basis * percentBps / 10000)`, `settlement.formula.ts:126`).
Frontend mirrors fils via `Math.round(Number(x)*1000)` conversions. **No floats for money
anywhere in the backend.**

**Audit (3 layers):** ① `AuditService.record('discount_applied')` (`settlement.service.ts:799-808`);
② `SettlementHistory` row (`settlement.repository.ts:345-356`); ③ `FinancialAudit` row
(`finance.service.ts:513-521`). Actors (`createdBy`/`updatedBy`) recorded.

**Safety invariants (backend-enforced):** total ≥ 0 (`settlement.formula.ts:68-72`);
`paid ≤ total` (`settlement.formula.ts:79-83`) → a discount can never push a paid settlement
below its paid amount; computed discount must be > 0 (`settlement-modifier.service.ts:330-332`);
DTO bounds (`percentBps` 1–10000, `amountFils` ≥ 1); modifiers blocked on `CLOSED`/`CANCELLED`
(`settlement-modifier.service.ts:521-530`); `CLOSED` terminal; cancel requires open + zero paid.

---

## 6. Promotion Security Audit

| Concern | Status |
|---|---|
| Discount makes total negative | **Prevented** (formula + integrity asserts) |
| Fixed discount exceeds basis | **Prevented** (computed = min semantics + total ≥ 0) |
| Percentage out of range | **Prevented** (DTO 1–10000 bps) |
| Money converted unsafely | **No** — integer fils + `assertFils`; no float money |
| Duplicate application | **Prevented** — idempotency keys (`FinanceIdempotencyKey`) |
| Discount after paid | **Effectively prevented** — discount reducing total below `paidFils` is rejected; refund/positive adjustments on a fully-paid settlement are blocked by the paid guard |
| Discount after completion | **Prevented** — `CLOSED`/`CANCELLED` are terminal |
| Ledger integrity on cancel | **Preserved** — cancel requires `OPEN` + zero paid; closed sales require sale-cancel first (`settlement.service.ts:697-709`) |
| Settlement formula | **Backend-owned; NOT modified** |
| Unauthorized discount application | Guarded by `finance.settlement.manage` / `sales.create` (backend authority) |
| Dedicated discount permission / cashier cap | **MISSING** — no `discount.*` key, no per-cashier limit, no approval workflow → documented as a limitation |
| Void/reversal of a posted discount | **MISSING** — `SettlementDiscount.status` supports `voided` but no endpoint reverses it |

---

## 7. User / Role / Permission Architecture

- **Backend** (all real, seeded at runtime `OnModuleInit`):
  - `User` (username, passwordHash, roleId, isActive, isLocked, mustChangePassword,
    failedLoginAttempts, lockedUntil, deletedAt soft-delete), `Role` (isSystem, isActive),
    `Permission` (key, displayName, module), `RolePermission`.
  - `LoginSession`, `RefreshToken` (SHA-256 hashed, rotation + reuse-detection family revoke),
    `LoginHistory`, `PasswordHistory`.
  - Guards (global, in order): `JwtAuthGuard` → `PermissionsGuard` → `PasswordChangeGuard`
    (`app.module.ts:57-61`). Decorators: `@Public`, `@RequirePermissions` (all),
    `@RequireAnyPermission` (any), `@CurrentUser`.
  - **Principal = live session.** Every request resolves the user + **role liveness** and
    re-reads permission keys fresh from DB (`auth.service.ts:460-497`) — permissions are never
    cached in the JWT; role/permission changes propagate immediately.
  - Lockout (5 attempts / 15 min), login rate limit (30/IP, 20/username per 15 min),
    password policy (min length 10 default, 3-of-4 complexity, history 5).
- **Frontend** (`PermissionProvider` / `RouteGuard` / nav filtering) is **UI-only visibility**;
  the backend guard is the security boundary. Renderer permission flow:
  `SessionManager` (Main) → `SessionView.user.permissions` via IPC → `SessionProvider` state →
  `PermissionProvider.can()`.

---

## 8. Permission Catalog Findings

Source of truth: `backend-node/src/permissions/permission.seeds.ts:22-127` — **104 seeded keys**
(module derived as first dot-segment).

Key findings:
1. **`availability.view` ORPHANED (HIGH).** Enforced by `availability.controller.ts:16,50,124`
   (`availability.constants.ts:2`) but **absent from `DEFAULT_PERMISSIONS`** → never inserted,
   no role (including Admin) has it → **all `/availability/*` endpoints 403 for every seeded role**.
2. **40+ seeded keys are never enforced** by any controller. Entire dead modules:
   `users.*` (except `users.unlock`), `roles.*`, `permissions.*`, `settings.*`, `payment.*`,
   `return.*`, `inspection.*`, `processing.*`, `system.*`, `notifications.*`, `calendar.*`,
   `rental.settlement.*`, legacy `rental.*`, legacy `reservation.*`, `media.manage`,
   `users.view_login_history`.
3. **Dual/alias families** (`sale.*`/`sales.*`, `rental.*`/`rentals.*`,
   `reservation.*`/`reservations.*`, `finance.settlement.*`/`rental.settlement.*`):
   - Sales: `sale.view/create/update/cancel` are **actively accepted** (any-of) alongside
     `sales.*` — compatibility is safe to keep.
   - Rentals/Reservations: singular keys are **seeded but dead**; controllers enforce only plural.
   - `finance.settlement.*` enforced; `rental.settlement.*` seeded but dead (incl. the
     Admin-only `rental.settlement.adjust`).
4. **`sales.complete` required for both confirm and complete**; no `sales.update` exists.
5. **No receipt/printing permission keys exist** anywhere in the RBAC model.
6. **Frontend drift (HIGH, user-facing):** `frontend/src/shared/constants/permissions.ts` uses
   keys the backend never seeds/enforces: `reservation.checkout`, `reservation.expire`,
   `rental.checkout` (backend has only `reservations.checkout/expire`, `rentals.checkout`);
   and `availability.view`. Result: **checkout/expire buttons and availability badge are
   permanently hidden for every non-Admin user even though the backend would permit them.**
   Additionally `RESERVATIONS_VIEW`/`RENTALS_VIEW` alias to the singular `reservation.view`/
   `rental.view` while controllers enforce the plural keys.
7. Backend keys never referenced by the frontend: `users.*`, `roles.*`, `permissions.*`,
   `settings.*`, `audit.view`, `calendar.*`, `return.*`, `inspection.*`, `processing.*`,
   `sale.*`, `payment.*`, `notifications.*`, `system.*`, `rental.settlement.*`, plural
   `reservations.*`/`rentals.*`.
8. Dead frontend constants (defined, never used): `media.*`, `barcode.*`, `sales.create`,
   `reports.financial.view`.

---

## 9. Role Matrix (ROLE × PERMISSION × UI ACTION)

Seeded system roles: **Admin / Cashier / Inventory / Laundry** (`core/auth.constants.ts:43-48`).

| Role | Permission set | Frontend reach |
|---|---|---|
| **Admin** | ALL 104 seeded keys (`permission.seeds.ts:226-231`) | Full UI via `isUnrestricted` heuristic |
| **Cashier** | 48 keys incl. `sales.*`, `rentals.*`, `reservations.*`, `finance.*`, `finance.settlement.*`, `reports.view`, `reports.financial.view`, `customer.*`, `inventory.view`, `media.view/upload` (`seeds.ts:232-236`) | POS, sales, rentals, reservations, settlements, finance, reports, customers |
| **Inventory** | 26 keys incl. `inventory.*`, `categories.*`, `barcode.*`, `media.*`, `inspection.*`, `calendar.view`, `reports.view` (`seeds.ts:237-241`) | Inventory + barcode + media (media/barcode UI not yet built) |
| **Laundry** | 12 keys: `processing.*`, `inspection.*`, `return.*`, `inventory.view`, `rental.view` (`seeds.ts:242-246`) | No dedicated screens yet (return/processing UI absent) |

Notable: **Cashier holds `finance.settlement.manage`** → can apply settlement discounts,
payments, refunds, late fees, and can close/cancel settlements. There is **no higher-approval
gate for large discounts**; the only differentiator is `finance.adjustment` (admin-only seed,
but note: `finance.adjustment` **is** granted to Cashier at `seeds.ts:159`).

Matrix defects:
- **Excessive:** Cashier gets `finance.adjustment` + full `finance.settlement.manage`
  (payment + refund + close + cancel) — a single cashier role can alter any settlement.
- **Hidden:** the four frontend drift keys (§8.6) hide actions backend would permit.
- **Orphaned:** `availability.view` 403s all roles (including Admin) on `/availability/*`.
- **Unused:** `rental.settlement.adjust` (Admin-only) references a feature the settlement
  controller keys as `finance.adjustment`.

---

## 10. Account Access Findings

- **No users/roles/permissions HTTP surface.** `users.*`, `roles.*`, `permissions.*` keys are
  seeded but no controller enforces them; `UsersService` admin methods (`setActive`,
  `disableAccount`, `enableAccount`) are **never called** by any endpoint; `createUser` only
  via `AdminBootstrapService`. → No user/role/permission admin is possible over HTTP today.
  The frontend therefore has **no Users/Roles/Permissions pages** (only empty scaffolds).
- **No admin-safety guards:** no last-admin protection, no system-role edit/delete guard, no
  privilege-escalation check (all latent because no mutation endpoints exist).
- **Bootstrap admin:** username `IDENTITY_BOOTSTRAP_USERNAME` or `admin`; password
  `IDENTITY_BOOTSTRAP_PASSWORD` or static `Juman!Bootstrap1` with `mustChangePassword: true`
  enforced by `PasswordChangeGuard` (softens, but does not eliminate, the default-password risk).
- **Profile UX:** only a modal (`UserProfileDialog.tsx`) that renders **raw permission-key chips**
  and the role name; no dedicated profile page. Dashboard shows `roles.join(', ')`.
  `POSWorkspace.tsx:352` hardcodes "أمين الصندوق: admin".
- **Password change:** real endpoint `POST /auth/change-password`, forced-change flow works;
  revocation of other sessions on change is backend-enforced.
- **Lockout/rate-limit/login-history** are implemented backend-side, but **no endpoint exposes**
  login history (`users.view_login_history` seeded, unused).

---

## 11. Session / Auth Findings

- **Token ownership (correct):** Electron Main owns `TokenBundle` (`SafeStorage` only when
  Remember-Me); renderer receives sanitized `SessionView` only. **No raw JWT in renderer, no
  localStorage, no React Query cache of permissions.**
- **Refresh flow (correct):** opaque refresh tokens, SHA-256 stored, rotation with reuse
  detection revoking the session family; access JWT is session-bound (useless without a live
  server session).
- **Logout:** revokes session + refresh family; renderer calls `queryClient.clear()`.
- **Session restore:** `GET /auth/session` revalidates; 4xx clears persisted store.
- **Idle timeout:** renderer-only 15-min idle auto-logout with 1-min warning modal
  (`SessionProvider.tsx:36-37,98-115,195-220`).
- **Role/permission changes mid-session:** propagate on next request (permission re-read) and
  on `auth:changed` push. No forced re-login on role change.
- **Backend unavailable:** handled at startup gate (Phase 9.9A); during a session, requests
  surface errors via `apiInvoke`.
- **Gaps:** no session-list / remote-revoke endpoint; no forced re-authentication on sensitive
  actions (e.g., discount) beyond normal permission checks.

---

## 12. POS Integration Findings

- **Discount is real backend functionality.** Fixed IQD discount → fils → `POST /sales`
  (`POSWorkspace.tsx:297`); rental discounts only via settlement screen.
- **Cashier cannot freely override price for sales** — `priceFils` sent is the item's
  `salePrice`; the backend *accepts* arbitrary `priceFils` on `POST /sales`
  (`sales.service.ts:158-160`) so price override is possible but the UI does not expose it.
- **Payment total:** the POS payment modal collects `paymentAmountFils` and the authoritative
  totals come from backend `SaleDto`. The on-screen "final total" is a **renderer estimate**
  (`subtotal − discount`, `POSWorkspace.tsx:338-340`) that ignores `taxFils`; POS never sends
  tax, so it currently agrees with the backend. **No change/tendered calculator exists.**
- **Sale completion uses Settlement:** create → confirm (settlement created) → payment →
  complete. Rental payment uses the settlement model after checkout.
- **`mode === 'return'` is NOT implemented** — falls through to the sale path
  (`POSWorkspace.tsx:269`); no refund logic in POS.
- **Hardcoded display:** "الرصيد المتبقي: 0.00 د.إ" (`POSWorkspace.tsx:474`) and
  "أمين الصندوق: admin" (`:352`) — cosmetic, not backend-derived.

---

## 13. Receipt Integration Findings

- Receipts render **real backend discount values**: line discount
  (`DefaultReceiptTemplate.tsx:173`, `render.ts:73`) and invoice-level discount when
  `settings.showDiscount && t.discountFils > 0` (`DefaultReceiptTemplate.tsx:191-193`).
- **Rental receipts always print `discountFils: 0`** (`receipts/utils/receipt.ts:179,186` —
  rental discount flow never reached from UI).
- Receipt builder has **fallback local math** only when a backend field is missing
  (`receipt.ts:128,185-192`) — documented, low risk, display-only.
- `showDiscount` setting is **localStorage-only** (`useReceiptSettings.ts`), not server-persisted.
- **No fabrication of promotions** — receipts show discount rows only from backend DTOs.

---

## 14. Reporting Integration Findings

- **Discounts in financial summary: YES.** `reports.repository.ts:207-211,241-242` aggregates
  posted `DISCOUNT` ledger transactions → `discountsFils`, `discountsCount`; surfaced in
  `GET /reports/financial` and the ReportsPage KPI "الخصومات".
- **Sale discounts invisible in reports:** `FINANCIAL_TX_TYPE.SALE_DISCOUNT` is declared but
  **never posted**; a sale's discount is embedded in `chargeFils` (net of discount). So the
  discount aggregate omits sale-discount-only totals.
- **Not present:** dashboard summary, rental listing report, gross-vs-net sales breakdown.
- **No gross/net sales split** anywhere; settlement modifiers appear only as the aggregates above.

---

## 15. Problems Found

| # | Severity | Problem |
|---|---|---|
| P1 | **HIGH** | `availability.view` enforced but never seeded → all `/availability/*` 403 for every role incl. Admin |
| P2 | **HIGH** | Frontend gates with keys the backend never seeds/enforces (`reservation.checkout`, `reservation.expire`, `rental.checkout`, `availability.view`) → real actions permanently hidden for non-admins |
| P3 | **MED** | Singular/plural permission drift (`reservation.*`/`rentals.*` vs `reservations.*`/`rentals.*`) breaks custom roles with only plural keys |
| P4 | **MED** | 40+ seeded permission keys never enforced (dead catalog, audit ambiguity) |
| P5 | **MED** | No admin-safety guards (last-admin, system-role, escalation) — latent until a management API exists |
| P6 | **MED** | No users/roles/permissions HTTP surface → no admin UI possible; `UsersService` admin methods dead |
| P7 | **MED** | `SALE_DISCOUNT`/`SALE_ADJUSTMENT`/`SALE_REFUND` never posted → sale discounts invisible in financial reports |
| P8 | **MED** | No dedicated discount permission / cashier discount cap / approval workflow; Cashier holds `finance.settlement.manage` (pay/refund/close/cancel) + `finance.adjustment` |
| P9 | **LOW** | POS local total is an independent renderer calc (ignores tax); no change calculator; `mode==='return'` unimplemented; hardcoded "admin" + "0.00 د.إ" displays |
| P10 | **LOW** | Settlement discount UI is fixed-only; backend percentage discount unused |
| P11 | **LOW** | Rental discounts reachable only via settlement screen; rental receipts always 0 |
| P12 | **LOW** | `/settings/receipts` gated by `finance.settlement.view` (wrong semantic key) |
| P13 | **LOW** | Dead code: `ComponentGuard`, `PermissionDenied`, several `PERMISSION` constants; raw string keys in `AppRouter.tsx` |
| P14 | **LOW** | No void/reverse endpoint for posted discounts; no session-list/remote-revoke endpoint; login history unexposed |

---

## 16. Fixes Applied

**NONE.** This is the audit phase. No implementation files were modified
(see §24 — only this report was created).

**Proposed corrections (frontend-only, backend-supported) — pending approval:**

1. **Fix frontend permission keys (P2, P3)** in `frontend/src/shared/constants/permissions.ts`
   and their call sites so the UI matches backend-enforced keys:
   - `reservation.checkout → reservations.checkout`
   - `reservation.expire → reservations.expire`
   - `rental.checkout → rentals.checkout`
   - `RESERVATION_VIEW`/`RESERVATIONS_VIEW` → `reservations.view`
   - `RENTAL_VIEW`/`RENTALS_VIEW` → `rentals.view`
   - Keep `reservation.create/cancel`, `rental.create/return/cancel` only if backend keeps
     seeding them as any-of aliases; otherwise align to plural.
2. **Remove/repair dead constants** (P13) and switch `AppRouter.tsx` string literals to the
   `PERMISSION` constant object.
3. **Repair `/settings/receipts` gate** (P12) to `reports.view` or a neutral key, or document
   the intent (receipt settings are localStorage-only today).
4. **POS polish (P9):** replace hardcoded "أمين الصندوق: admin" with the session role; remove or
   back the hardcoded "الرصيد المتبقي" with a real `customerOutstanding` value (backend-supported);
   keep the renderer total explicitly labeled as an estimate or derive it from the server response.
5. **Settlement discount UX (P10):** add percentage-discount option (backend `percentBps`
   already supported) with Arabic-first labels (السعر الأصلي / الخصم / الإجمالي) and show who
   applied it (from `discounts[].createdBy` if surfaced) — backend-supported.
6. **Wire or remove dead guards (P13):** either use `ComponentGuard` in the new features or
   delete it (cleanup).

**Proposed backend-facing corrections — NOT performed (need explicit approval):**
- Seed `availability.view` and grant to Admin (+ Calendar) to unblock `/availability/*`.
- Add a `discount`-specific permission / cashier discount cap (needs DTO + guard change).
- Post `SALE_DISCOUNT` ledger entries so sale discounts appear in financial reports.
- Add users/roles/permissions read endpoints (permission-gated) to enable admin UI.
- Add last-admin / system-role protection when a management API is added.

---

## 17. Backend Gaps

**NestJS backend changes: NONE** (this phase).

Documented gaps (each would require backend work to close; frontend-only implementation would be unsafe):

| Gap | Required endpoint/DTO | Required permission | Required schema | Security implications | Why frontend-only is unsafe |
|---|---|---|---|---|---|
| `/availability/*` unreachable | — | seed `availability.view` (+ Admin grant) | none | availability data readable by any role today → data exposure once seeded; must grant intentionally | UI gating alone cannot make the API reachable |
| No discount-specific permission/cap | new DTO field or new endpoint for cap/approval | new `discount.apply` / `discount.approve` keys | none (RBAC only) | unbounded discount authority for Cashier | a frontend cap can be bypassed; backend must enforce |
| Sale discounts invisible in reports | post `SALE_DISCOUNT` ledger tx on sale create/confirm | — | none | ledger completeness | a frontend-adjusted report figure would diverge from the ledger |
| No users/roles/permissions admin API | `users` CRUD, `roles` CRUD, `permissions` read controllers | `users.*`, `roles.*`, `permissions.*` (already seeded) | none | admin management is the highest-risk surface | frontend forms with no backend are fake UI |
| No last-admin / system-role / escalation guard | guards in future user/role services | — | none | lockout/privilege-escalation | React-only protection is cosmetic |
| No discount void/reversal | `POST /settlements/:id/discount/:id/void` | `finance.settlement.manage` | `SettlementDiscount.status` supports `voided` already | ledger integrity of reversals | a local reversal would corrupt the ledger |
| No session-list/remote-revoke | `GET/DELETE /auth/sessions` | `users.view_login_history` / new | none | session takeover recovery | client-side "log out all" cannot revoke Main-held tokens alone |

---

## 18. Security Findings

- **Positive:** session-bound JWTs; refresh rotation + reuse-detection family revoke; fresh
  per-request permission/role-activity resolution; integer-fils money with negative-total and
  paid-below-total guards; idempotency on finance mutations; three-layer discount audit;
  lockout + rate limit + timing dummy; `mustChangePassword` guard; soft-delete patterns.
- **Findings:**
  1. **Frontend-only authorization is present but explicitly UX-only** — acceptable, backend is
     authoritative; must remain that way.
  2. **`isUnrestricted` heuristic** (role `Admin`/`admin`, `*`, or >40 permissions) is UI-only —
     fine for visibility, must never gate backend calls.
  3. **Bootstrap default password** `Juman!Bootstrap1` if env unset (softened by forced change).
  4. **Cashier over-privilege:** `finance.settlement.manage` (refund + close + cancel) +
     `finance.adjustment` — a single cashier can modify settlement money beyond discounting.
  5. **No last-admin/system-role protection** (latent — no mutation endpoints yet).
  6. **Raw permission keys in `AppRouter.tsx`** and raw chips in the profile modal (maintainability,
     not a direct leak).
  7. **No discount approval flow / per-cashier cap** — money-risk gap.
  8. **`sales.payment` vs overpayment:** backend 422s overpayments; client pre-guards.
- **No token/password leakage found.** No passwords in localStorage/sessionStorage/React state/
  query cache; tokens never leave Main.

---

## 19. Performance Findings

- Permission catalog is small (104 keys) and resolved per-request from SQLite — negligible.
- React Query: list hooks use `placeholderData`; mutations invalidate scoped key families; no
  unbounded refetch loops observed.
- POS sale flow performs create→confirm→payment→complete sequentially over IPC — 4 round-trips;
  acceptable, but a combined endpoint would cut latency (backend change, not required).
- Profile modal re-renders raw permission chips; nav filter is O(nav×permissions) — trivial.
- No performance regression risk from the proposed corrections.

---

## 20. Tests

No implementation changes → **no new tests added and no tests run in this phase.**
Existing quality gates last verified green (Phase 9.9A): `pnpm lint` PASS, `pnpm test`
(66 tests / 11 files) PASS, `pnpm validate:arch` PASS, `pnpm build` PASS.

Planned tests for the approved corrections:
- PROMOTIONS: valid/invalid discount payload; permission-restricted UI (fixed + percentage);
  backend-authoritative total display; paid/closed protection feedback.
- ACCESS: anonymous access redirect; forbidden vs permitted role on the repaired keys
  (`reservations.checkout/expire`, `rentals.checkout`, `reservations.view`, `rentals.view`);
  nav filtering; route guards; current-user profile; logout/session behavior.

---

## 21. Manual Verification

**NOT PERFORMED in this phase** (read-only audit). Recommended before/after implementation:
- Start backend + `pnpm dev`; log in as admin and as cashier.
- POS: apply fixed discount, confirm backend total matches display.
- Settlements: apply fixed and (after fix) percentage discount; verify 3-layer audit rows.
- `/availability` for admin (currently 403 — reproduces P1).
- Rental checkout button visibility for cashier (currently hidden — reproduces P2).

---

## 22. TESTED

- (Read-only) Static verification of every finding above against source with exact file:line.
- Confirmed `availability` absent from `permission.seeds.ts` (grep) and present in
  `availability.constants.ts`.
- Confirmed `SettlementDiscountDto` supports `percentage`/`fixed` + `percentBps` bounds.
- Confirmed POS sends `discountFils` to `POST /sales` and settlements page sends `kind:'fixed'`.
- Confirmed frontend `permissions.ts` drift keys.
- No runtime/manual testing performed (no code changed).

## 23. NOT TESTED

- Runtime behavior against a live backend (no manual E2E in this phase).
- Percentage-discount path end-to-end (UI never sends it today).
- `/availability` endpoints live (expected 403 — P1).
- Anything requiring a code change (none applied).

---

## 24. Files Changed

- `docs/frontend/PROMOTIONS_ACCESS_AUDIT_REPORT.md` — **created** (this report).
- No implementation files modified in this phase.

---

## 25. Skills Used

- `audit`, `daisyui`, `fixing-accessibility`, `frontend-ui-engineering` (loaded skill set;
  design skills to be applied during implementation of approved corrections).

---

## 26. Remaining Debt

- Dead permission catalog (40+ unenforced keys) — audit/cleanup task.
- No management API/UI for users, roles, permissions.
- No discount approval workflow or cashier cap.
- Sale discounts not visible in financial reports (ledger gap).
- Availability endpoints blocked for all roles.
- POS `return` mode, change calculator, hardcoded displays.
- Receipt settings not server-persisted; rental discounts/receipts.

---

## 27. Recommendation

**Proceed with the approved, frontend-only corrections first** (permission-key alignment P2/P3,
dead-constant cleanup, POS hardcoded displays, settlement percentage-discount UI, route-gate
repair) — all safe and fully supported by the existing backend. Then, with explicit sign-off,
tackle the backend-facing gaps in priority order: (1) seed `availability.view`, (2) discount
permission/cap, (3) `SALE_DISCOUNT` ledger posting, (4) users/roles/permissions read API with
admin-safety guards. **Do not** build a promotions engine or frontend-only money math.

## 28. Final Verdict

**CONDITIONAL PASS** — the existing promotions/discount implementation is real, backend-owned,
and safe; the account-access security backbone is solid. The audit is complete and green for
read-only review. Implementation of the approved corrections requires a separate approval step
and a new command.

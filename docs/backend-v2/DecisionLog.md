# Backend V2 Decision Log

## ADR-V2-001 - Replace Python stack with Nest + Prisma + SQLite

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Desktop-first product; PostgreSQL and Alembic increase install friction.
- **Decision:** Backend V2 uses Node.js LTS, TypeScript, NestJS, Prisma, SQLite (`data/juman.db`).
- **Consequences:** Reimplement behavior; dual backends until parity; Electron still on Python until Phase 8.

## ADR-V2-002 - Rename `backend/` to `backend-python/`

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Clear separation of V1 spec vs V2 implementation.
- **Decision:** On branch `backend-v2`, rename source tree to `backend-python/`. Installer *runtime* folder name `%INSTDIR%\backend\` stays for V1 packaging until Phase 8.
- **Consequences:** Repo scripts that stage from source must use `backend-python`.

## ADR-V2-003 - Dev HTTP port 8787

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Avoid colliding with Python API on `:8000` during dual-run development.
- **Decision:** Nest listens on `8787` by default.
- **Consequences:** Electron must be retargeted in Phase 8.

## ADR-V2-004 - Health contract without `/api/v1`

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Foundation-only surface; V1 used `/api/v1/health`.
- **Decision:** V2 Phase 1 exposes `GET /health` with `{ status, version, database, uptime, environment }`.
- **Consequences:** Clients must adapt at integration time; versioned prefix can return later if needed.

## ADR-V2-005 - Long-lived branch `backend-v2`

- **Date:** 2026-08-01
- **Status:** Accepted
- **Decision:** All V2 work lands on `backend-v2`; do not modify `main` for V2 features until merge policy is defined.

## ADR-V2-006 - Phase 1.1 production foundation hardening

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Initial scaffold needed production logging, config/juman.env bootstrap, and fuller lifecycle handling.
- **Decision:** Winston + daily rotate JSON logs (application/errors/startup/requests); load/generate `config/juman.env`; global filter + process handlers; health returns `database: connected|disconnected` and `environment`.
- **Consequences:** Tests silence file transports under `VITEST=true`; Electron still on Python until Phase 8.

## ADR-V2-007 - Authentication foundation (Phase 2.1)

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Desktop-only Electron client; Python identity uses session-bound JWT + opaque refresh + Argon2id + RBAC.
- **Decision:** Reimplement auth cleanly in Nest with Prisma models (User/Role/Permission/Session/RefreshToken/LoginHistory/PasswordHistory); Argon2id; JWT `aud=juman-desktop`; opaque refresh with reuse detection; permissions from DB; `GET /api/v1/auth/me` returns permissions; seed full RBAC catalog.
- **Consequences:** No business modules yet; Electron path aliases deferred to Phase 8; intentional deviations documented in AuthenticationDesign.md.

## ADR-V2-008 - Authentication implementation (Phase 2.2)

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Phase 2.1 foundation needed a complete Electron-compatible auth surface.
- **Decision:** Ship `/auth/{login,logout,change-password,session,me}`; audit events LOGIN/LOGOUT/LOGIN_FAILED/PASSWORD_CHANGED/ACCOUNT_LOCKED; seed Administrator; keep refresh rotation behind session restore header for cold start.
- **Consequences:** Electron path mapping required in Phase 8; admin user/role HTTP CRUD deferred; coverage gates enforced via Vitest+SWC.

## ADR-V2-009 - Phase 2 architecture audit gate

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Auth/foundation code complete; entering business domain without audit would freeze defects.
- **Decision:** Mandatory Phase 2.3 audit produced `docs/backend-v2/AUDIT_PHASE_2.md` with overall **56/100 FAIL**. Phase 3 blocked until Must-fix items are remediated and re-audited. No features in audit commit.
- **Consequences:** Next work is hardening (2.4), not customers/inventory.

## ADR-V2-010 - Phase 2.4 release blocker remediation

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Phase 2.3 audit FAILED (56/100) with packaging and security Must-Fix items blocking Phase 3.
- **Decision:** Remediate only Must-Fix items: loopback bind + HOST, migrate-on-boot, timed lockout + unlock API, atomic refresh rotation, pinned deps, disable→revoke, dummy Argon2, expanded coverage, APP_GUARD/repo boundary cleanup, docs. Optional SQLite PRAGMAs included. No business modules.
- **Consequences:** Re-audit in `AUDIT_PHASE_2_RETEST.md`; Phase 3 still requires PASS gate.

## ADR-V2-011 - Shared business foundation (Phase 3.1)

- **Date:** 2026-08-01
- **Status:** Accepted
- **Context:** Domain modules must not duplicate cross-cutting logic; Phase 3 needs a stable substrate.
- **Decision:** Introduce shared primitives (`src/shared`) plus Settings/Audit/Media/Barcode modules with Prisma models `AppSetting`, `MediaFile`, `MediaReference`, `Barcode`, `SequenceCounter`, `AuditLog`. Money = integer fils (1000 = 1 IQD). Soft-delete = `deletedAt`. Audit writes only via `AuditService.record`. No domain HTTP for media/barcode/search yet.
- **Consequences:** Customers/inventory must import these services; coverage gate `pnpm test:cov:shared` enforces ≥95% on shared infra.
## ADR-V2-012 - Customer domain (Phase 3.2)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** First business module after shared foundation; Python V1 allows duplicate phones and has no restore/city.
- **Decision:** Implement Nest `CustomersModule` with Prisma `Customer` (soft delete, restore, city, status, normalized phones). Block duplicate **active** primary phones. Reuse shared Audit/Settings/SequenceCounter/phone/pagination. No CustomerAttachment/CustomerAudit/CustomerNote tables ? use shared media/audit and a notes column. Permissions remain singular `customer.*` (+ `customer.restore`). HTTP under `/customers` without `/api/v1`.
- **Consequences:** Categories/settings HTTP still pending; inventory blocked. Coverage gate `pnpm test:cov:customers` ?95%.

## ADR-V2-013 - Media subsystem (Phase 3.3)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Every future module needs files; duplicating attachment tables or ad-hoc disk writes would freeze technical debt.
- **Decision:** Extend Phase 3.1 `MediaModule` into the sole blob authority: typed storage categories under configured `storage/`, SHA-256 checksums, MIME/magic validation, soft-delete **keeping** blobs for restore, polymorphic `MediaReference` only. HTTP under `/media` without exposing absolute paths. No thumbnails/camera/cloud yet.
- **Consequences:** Inventory/rentals must attach Media IDs. Coverage gate `pnpm test:cov:media` ?95%. Download streaming HTTP can follow without schema changes.

## ADR-V2-014 - Phase 3 engineering certification

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Features through Media shipped; need a non-feature gate before Phase 3.5.
- **Decision:** Run logical/functional/API/DB/perf/security/architecture/TS/coverage/packaging/docs review; publish `PHASE_3_ENGINEERING_CERTIFICATION.md` with score **85 PASS WITH WARNINGS**. No barcode/inventory work in this commit.
- **Consequences:** Phase 3.5 requires approval; tracked Medium/High debt must not be forgotten when multi-client or inventory starts.

## ADR-V2-015 - Reusable barcode platform (Phase 3.5)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Inventory and other modules will need barcodes; embedding generation in inventory would fork symbology, uniqueness, and hardware concerns.
- **Decision:** Extend Phase 3.1 `Barcode` into a dedicated platform: configurable types (Code-128 default, Code-39, EAN-13/8, UPC-A, QR-ready), lifetime-unique `code`, statuses reserved/activated/retired, service API (generate/reserve/activate/release/retire/validate/find/exists/normalize), generic HTTP `/barcodes`, RBAC `barcode.*`, audit events, hardware port interfaces only. No inventory workflows.
- **Consequences:** Domains call `activate` to bind entities. Never recycle retired values. Coverage gate `pnpm test:cov:barcode` ≥95%. Label printers/scanners remain future adapters.

## ADR-V2-016 - Inventory catalog engine (Phase 4.1)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Need inventory foundation without freezing a dress-only model or embedding rental availability.
- **Decision:** Implement a reusable Item Catalog (Category/Brand/Color/Size/Item) with catalog-only statuses, soft delete/restore, `ItemMedia`/`ItemBarcode` joins that reference Media/Barcode platforms (no local generation or blobs). Frontend may keep “Dress” terminology; backend entity type remains `item`.
- **Consequences:** Reservations/rentals/calendar remain blocked. Coverage gate `pnpm test:cov:inventory` ≥95%. Future item types extend taxonomy without redesigning Item.

## ADR-V2-017 - Inventory lifecycle foundation (Phase 4.2)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Rentals/sales will mutate item availability; embedding ad-hoc status flags in those modules would fork state machines.
- **Decision:** Add operational `lifecycleState` (separate from catalog `status`) with a closed transition graph, append-only `ItemStateHistory`, CAS transitions, `inventory.transition` RBAC, and availability predicates (`isOperational`/`isRentable`/`isSellable`/`isEditable`). No reservations/calendar/payments.
- **Consequences:** All future domains must call `LifecycleService`. Invalid/concurrent transitions → 409. Lost/damaged supported without schema redesign.

## ADR-V2-018 - Phase 4 inventory engineering certification

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Catalog + lifecycle shipped; entering rentals without a gate would freeze integrity defects.
- **Decision:** Run logical/functional/API/DB/perf/security/architecture/TS/coverage review; publish `PHASE_4_ENGINEERING_CERTIFICATION.md` with score **78 PASS WITH WARNINGS**. No rentals/reservations/calendar/sales in this commit. Harness: `scripts/cert-phase43.cjs` → `cert_p43_harness.json`.
- **Consequences:** Rental Engine blocked until Must-Fix items (soft-delete mid-lifecycle, barcode release, transactional bind, restore status, draft transitions, media dual-write) are remediated and re-probed.

## ADR-V2-019 - Inventory integrity remediation (Phase 4.4)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Phase 4.3 certification blocked rentals on six Must-Fix integrity defects.
- **Decision:** (1) Reject soft-delete in mid-ops lifecycle states; (2) release barcodes + soft-delete `ItemBarcode`/`MediaReference` on delete and reverse on restore; (3) atomic create (`createAtomic`) for item+barcode+media+history; (4) restore prior catalog status via `statusBeforeDelete`; (5) LifecycleService transitions require catalog `active` only; (6) **MediaReference-only** attachments — drop `ItemMedia`.
- **Consequences:** Integrity score raised to **88**. Rental Engine still requires explicit approval before implementation. Report: `PHASE_4_REMEDIATION_REPORT.md`.

## ADR-V2-020 - Rental workflow core (Phase 5.1)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Inventory integrity gate cleared; need a rental workflow foundation without payments/settlements.
- **Decision:** Introduce `Rental` / `RentalItem` / `RentalStatusHistory` with closed status graph. Checkout/return/cancel mutate inventory **only** through `LifecycleService.transition` inside shared Prisma transactions. No reservations, fees, or settlements in this phase.
- **Consequences:** Walk-in path uses inventory `available→reserved→rented`. Return stops at `return_pending`. Coverage gate `pnpm test:cov:rentals` ≥95%. Docs: `RentalDesign.md`.

## ADR-V2-021 - Reservation engine (Phase 5.2)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Need date-window holds before physical handover without folding reservations into rentals.
- **Decision:** Independent `Reservation` documents with closed status graph; `AvailabilityService` detects reservation/rental overlaps; checkout materializes a `Rental` and inventory transitions only through `LifecycleService` in one TX. Expire is service/HTTP foundation without a scheduler.
- **Consequences:** Calendar module can reuse AvailabilityService. No payments/fees/settlement in this phase. Coverage gate `pnpm test:cov:reservations` ≥95%. Docs: `ReservationDesign.md`.

## ADR-V2-022 - Phase 5 engineering certification gate

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Rental + Reservation foundations shipped; Financial must not start on unverified integrity.
- **Decision:** Phase 5.3 is verification-only. Certify workflow foundations with explicit Must-Fix blockers before Phase 6: (1) walk-in rentals must use `AvailabilityService`, (2) concurrent reservation create must be single-winner, (3) restore `pnpm test:cov:rentals` thresholds. Overall score **76** — PASS WITH WARNINGS. Financial readiness = **NO**.
- **Consequences:** No Feature work in 5.3. Remediation required before Financial. Report: `PHASE_5_ENGINEERING_CERTIFICATION.md`. Harness: `scripts/cert-phase53.cjs`.

## ADR-V2-023 - Phase 5.4 rental integrity remediation

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Phase 5.3 Must-Fix: walk-in skipped AvailabilityService, reservation TOCTOU, rentals coverage gate fail.
- **Decision:** Extract shared `AvailabilityModule`. All allocation (walk-in create/checkout, reservation create/checkout) runs under `AvailabilityService.runExclusive` (write lock + assert + persist). Restore `pnpm test:cov:rentals` ≥95%. Integrity score **90**.
- **Consequences:** No Financial in this phase. Product approval still required before Phase 6. Report: `PHASE_5_REMEDIATION_REPORT.md`.

## ADR-V2-024 - Financial core (Phase 6.1)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Need an accounting foundation before settlement/reports without polluting rental/inventory with balances.
- **Decision:** Introduce `FinanceModule` as sole money owner: `FinancialAccount` (per customer), `FinancialTransaction`, `Payment`, `MoneyMovement`, `FinancialAudit`. IQD integer fils via `Money` value object. Rentals call `createCharge` / `registerDeposit` only. Outstanding is computed. No settlement, late fees, invoices, or reports in this phase.
- **Consequences:** Checkout creates idempotent rental charges. Coverage gate `pnpm test:cov:finance` ≥95%. Docs: `FinancialDesign.md`.

## ADR-V2-025 - Settlement engine (Phase 6.2)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Ledger outstanding alone must not decide rental financial completion; rental must not compute balances.
- **Decision:** Introduce `SettlementService` as sole financial-completion authority. Models: `RentalSettlement` (1:1 rental), `SettlementHistory`. Checkout creates settlement; payments applied via settlement update balances with CAS; rental `complete` requires status ∈ {paid, closed}. Settlement never mutates Payment rows — it calls `FinanceService.registerPaymentInTx`.
- **Consequences:** Dual payment paths (`/finance/payments` vs `/settlements/:id/payment`) remain a documented debt until unified. No late fees/penalties/invoices/reports. Docs: `SettlementDesign.md`. Coverage via `pnpm test:cov:finance`.

## ADR-V2-026 - Financial integrity remediation (Phase 6.3)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Phase 6.2 left a dual payment path: ledger payments could zero outstanding while settlements stayed open.
- **Decision:** Settlement is the only owner of rental financial state. `registerPayment` rejects accounts with open/partial settlements. Settlement continues to publish ledger via `registerPaymentInTx`. Outstanding HTTP uses settlement remaining when settlements exist (`balanceSource`). Invariant helpers enforce balance and status integrity. No late fees/refunds/reports in this phase.
- **Consequences:** Integrity score **92**. Remaining risks: non-atomic checkout finance, future refunds must reuse the gate. Report: `PHASE_6_FINANCIAL_REMEDIATION.md`.

## ADR-V2-027 - Financial engineering certification (Phase 6.4)

- **Date:** 2026-08-02
- **Status:** Accepted
- **Context:** Need a formal GO/NO-GO before Reports, after 6.1–6.3 delivered settlement ownership and dual-path closure.
- **Decision:** Certify financial **foundation** as **PASS WITH WARNINGS (overall 80)**. **NO-GO for Reports** until Must-Fix: (1) atomic checkout finance TX, (2) deposit/charge reference uniqueness + idempotency, (3) rental cancel ↔ settlement coupling policy. Payment idempotency keys and refund/adjustment remain High/Medium debt, not Reports blockers only if Reports stay unbuilt.
- **Consequences:** Do not start Phase 7 Reports, late fees, invoices, or refunds without remediation approval. Report: `PHASE_6_ENGINEERING_CERTIFICATION.md`.

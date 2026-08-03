# Phase 8.1 — End-to-End Certification Matrix

**Date:** 2026-08-03  
**Branch:** `backend-v2`  
**Harness:** `backend-node/scripts/cert-phase81-e2e.cjs` → `docs/certification/cert_p81_harness.json`  
**Mode:** Verification + integration bug fixes only (no new features)

Legend: **PASS** · **WARNING** · **FAIL** · Risk: critical / high / medium / low

---

## AUTH

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| AUTH-01 | Bootstrap admin | Login wrong password | 401 | 401 | PASS | high |
| AUTH-02 | — | Login bootstrap | 200 + tokens | OK | PASS | critical |
| AUTH-03 | Login | Permissions on token user | non-empty | 99 keys | PASS | high |
| AUTH-04 | Bearer | Change password | 200 | 200 | PASS | high |
| AUTH-05 | New password | Relogin | 200 + tokens | OK | PASS | critical |
| AUTH-06 | Bearer | GET /auth/session | session.user | OK | PASS | high |
| AUTH-07 | Refresh token | GET /auth/session + X-Refresh-Token | rotate/restore | tokens returned | PASS | high |
| AUTH-08 | Bearer | GET /auth/me | permissions | OK | PASS | medium |
| AUTH-09 | No token | GET /customers | 401 | 401 | PASS | critical |
| AUTH-10 | Bearer | POST /auth/logout | 200 | 200 | PASS | high |
| AUTH-11 | After logout | GET /customers with old token | 401 | 401 | PASS | high |
| AUTH-FE-01 | Electron Main | Renderer never stores JWT | IPC SessionView only | Design verified (SessionManager) | PASS | critical |

---

## CUSTOMERS

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| CUS-01 | Auth | Create | 201 | 201 | PASS | critical |
| CUS-02 | Existing phone | Duplicate phone | 409 | 409 | PASS | high |
| CUS-03 | Customer | Patch fullName | 200 | 200 | PASS | high |
| CUS-04 | Customer | Search + sort + page | items+meta | total≥1 | PASS | high |
| CUS-05 | Customer | Soft delete | 200 | 200 | PASS | high |
| CUS-06 | Deleted | Restore | 200 | 200 | PASS | high |
| CUS-FE-01 | UI | Media gallery refs | Nest MediaReference HTTP | V2_UNSUPPORTED | WARNING | medium |
| CUS-FE-02 | UI | Customer audit HTTP | Nest audit list | V2_UNSUPPORTED | WARNING | medium |

---

## INVENTORY

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| INV-01 | Auth | Create category/brand/color/size | IDs | OK | PASS | high |
| INV-02 | Taxonomy | Create item + barcode | 201 lifecycle=available | OK | PASS | critical |
| INV-03 | Items | Search items | total≥2 | OK | PASS | medium |
| INV-04 | Item | Soft delete item | 200 | 200 | PASS | medium |
| INV-05 | Deleted | Restore item | 200 | 200 | PASS | medium |
| INV-FE-01 | Dress create | Resolve taxonomy by name | Resolve IDs | Cannot without lookup | WARNING | high |
| INV-FE-02 | Dress photos | Mapped to item media | Photos API | Unsupported; item media OK | WARNING | medium |

---

## MEDIA

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| MED-01 | Auth | Upload PNG multipart | 200/201 | OK | PASS | high |
| MED-02 | Media + item | Attach to item | 200/201 | OK | PASS | medium |
| MED-03 | Attached | Soft delete media | 200 | 200 | PASS | medium |
| MED-04 | Deleted | Restore media | 200 | 200 | PASS | medium |
| MED-FE-01 | UI | Binary download route | Present | Missing → V2_UNSUPPORTED | WARNING | medium |

---

## RESERVATIONS

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| RES-01 | Customer + item | Create | 201 confirmed | OK | PASS | critical |
| RES-02 | Overlap window | Overlapping create | 409 | 409 | PASS | critical |
| RES-03 | Reservation | Cancel | 200 | 200 | PASS | high |
| RES-04 | Confirmed | Reservation checkout | 200 + rental | OK | PASS | critical |
| RES-FE-01 | UI | PATCH reservation | Supported | V2_UNSUPPORTED | WARNING | medium |
| RES-FE-02 | UI | Calendar timeline HTTP | Availability UI | No Nest calendar HTTP; nav hidden | WARNING | high |
| RES-FE-03 | UI | Permission keys | rentals/reservations singular+plural | anyOf both | PASS | high |

---

## RENTALS

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| REN-01 | Customer + item | Walk-in create | 201 | 201 | PASS | critical |
| REN-02 | Draft rental | Checkout + deposit | 200 | 200 | PASS | critical |
| REN-03 | Checkout | Idempotency key | idempotent | 200 | PASS | high |
| REN-04 | Checked out | Return | 200 return_pending | OK | PASS | critical |
| REN-FE-01 | UI | PATCH rental | Supported | V2_UNSUPPORTED | WARNING | low |
| REN-FE-02 | UI | Status case | UPPER_SNAKE UI ↔ lowercase Nest | legacyBridge maps | PASS | high |
| REN-FE-03 | UI | Permission keys | rental(s).* anyOf | fixed | PASS | high |

---

## FINANCE / SETTLEMENT

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| FIN-01 | After checkout | Settlement exists | exists | OK | PASS | critical |
| FIN-02 | Settlement | Formula Total=(charge−deposit)+… | matches DB | charge 7000 deposit 1000 total 6000 | PASS | critical |
| FIN-03 | Open settlement | Partial payment | 200 | OK | PASS | critical |
| FIN-04 | Open | Discount fixed | 200 | OK | PASS | high |
| FIN-05 | Open | Adjustment | 200 | OK | PASS | high |
| FIN-06 | Open | Late fee flat | 200 | OK | PASS | high |
| FIN-07 | Remaining | Pay remaining | paid/cleared | OK | PASS | critical |
| FIN-08 | Paid | Refund | &lt;500 | status=400 (state-dependent) | WARNING | medium |
| FIN-FE-01 | UI | Permission keys | finance.settlement.* vs rental.settlement.* | anyOf both | PASS | high |
| FIN-FE-02 | UI | Status mapping | lowercase → legacy UPPER | bridge maps PAID/VOIDED/… | PASS | high |
| FIN-FE-03 | UI | Amount coerce | amountFils Number | Number(amount) | PASS | medium |

---

## REPORTS

| ID | Preconditions | Steps | Expected | Actual | Result | Risk |
|----|---------------|-------|----------|--------|--------|------|
| RPT-01 | Data | Dashboard | KPIs | OK | PASS | high |
| RPT-02 | Data | Financial aggregate | revenueFils | OK | PASS | high |
| RPT-03 | Data | Inventory availability | array | OK | PASS | medium |
| RPT-04 | Data | Rentals current | paginated | OK | PASS | medium |
| RPT-05 | Auth | Export CSV | 200 | 200 | PASS | high |
| RPT-06 | Auth | Export JSON | 200 | 200 | PASS | high |
| RPT-07 | Auth | Export PDF stub | 400 | 400 | PASS | low |
| RPT-08 | Auth | Customer outstanding | 200 | 200 | PASS | medium |
| RPT-FE-01 | UI | Daily report unsupported | Must not block summary | FinancialReportPage skips daily | PASS | high |

---

## STRESS

| ID | Load | Metric | Actual | Result | Risk |
|----|------|--------|--------|--------|------|
| STR-01 | 120 items list | list &lt;2s | 40ms, total≥120 | PASS | high |
| STR-02 | 40 checkouts | ≥70% success | 40/40 | PASS | high |
| STR-03 | Dashboard after load | &lt;3s | 19ms | PASS | medium |
| STR-04 | RSS delta | &lt;400MB | boot 131 → 231 (+100) | PASS | medium |
| STR-N | Scaled note | Full 1000/500/300 | Harness used 120/80/40 (CI time); pattern holds | WARNING | medium |

---

## HARDWARE / SETTINGS / IPC

| ID | Area | Expected | Actual | Result | Risk |
|----|------|----------|--------|--------|------|
| HW-01 | Scanner/printer/drawer | Local IPC | Not in Nest harness | WARNING | medium |
| SET-01 | Settings persistence | Nest HTTP | Absent → unsupported | WARNING | medium |
| IPC-01 | api.invoke + auth channels | Whitelisted | Verified in code | PASS | high |
| IPC-02 | Backend launcher | Nest preferred | serviceStatus prefers backend-node | PASS | high |
| IPC-03 | Diagnostics repairs | No PG/Python | UI still lists PG/Python actions | WARNING | high |

---

## ARCHITECTURE / CONSISTENCY

| ID | Area | Expected | Actual | Result | Risk |
|----|------|----------|--------|--------|------|
| ARCH-01 | Response shapes | Stable UI contracts | Nest camelCase → legacyBridge | WARNING | medium |
| ARCH-02 | Module coverage | All UI modules HTTP | Settings/Audit/Calendar/Users absent | WARNING | medium |
| ARCH-03 | Diagnostics | Nest/SQLite only | Still PG/Python-oriented | WARNING | high |

---

## Aggregate (live harness + FE audit)

| Metric | Value |
|--------|------:|
| Harness PASS | 53 |
| Harness WARNING | 6 |
| Harness FAIL | 0 |
| Harness errors | 0 |
| Startup | 2064 ms |
| Migrate | 7191 ms |
| Dashboard after stress | 19 ms |
| Settlement formula | **OK** (6000 = 7000 − 1000) |
| Frontend lint/build/test | **PASS** (226 tests) |

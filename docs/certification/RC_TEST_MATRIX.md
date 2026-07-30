# Juman v1.0 — Release Candidate Test Matrix

**Product:** جمان (Juman)  
**Version under test:** 1.0.0 RC  
**Status legend:** `PASS` | `FAIL` | `BLOCKED` | `NOT EXECUTED`  
**Rule:** Never mark PASS without executed evidence.

Fill **Result** and **Evidence** columns during certification. Agent-automated rows may be filled from CI/local runs; operator rows require VM/hardware notes.

---

## 1. Installation (critical)

| ID | Check | Win10 | Win11 | Result | Evidence |
|----|-------|-------|-------|--------|----------|
| INST-01 | Installer launches (Setup.exe) | req | req | NOT EXECUTED | |
| INST-02 | Silent PostgreSQL install succeeds | req | req | NOT EXECUTED | |
| INST-03 | PostgreSQL service starts (`postgresql-x64-16`) | req | req | NOT EXECUTED | |
| INST-04 | `JumanApi` service installs and starts | req | req | NOT EXECUTED | |
| INST-05 | Database `juman` created | req | req | NOT EXECUTED | |
| INST-06 | Alembic migrations succeed | req | req | NOT EXECUTED | |
| INST-07 | `config\juman.env` generated with SECRET_KEY | req | req | NOT EXECUTED | |
| INST-08 | Storage/logs/data/runtime folders exist | req | req | NOT EXECUTED | |
| INST-09 | Desktop shortcut launches app | req | req | NOT EXECUTED | |
| INST-10 | Start Menu shortcut launches app | req | req | NOT EXECUTED | |
| INST-11 | Application reaches login / first-run | req | req | NOT EXECUTED | |

## 2. Services (critical)

| ID | Check | Win10 | Win11 | Result | Evidence |
|----|-------|-------|-------|--------|----------|
| SVC-01 | PostgreSQL service RUNNING | req | req | NOT EXECUTED | |
| SVC-02 | JumanApi service RUNNING | req | req | NOT EXECUTED | |
| SVC-03 | Startup order: PG before JumanApi | req | req | NOT EXECUTED | |
| SVC-04 | After reboot both services RUNNING | req | req | NOT EXECUTED | |
| SVC-05 | Graceful stop (`JumanApi.exe stop`) | req | one | NOT EXECUTED | |
| SVC-06 | Recovery after kill `juman-api.exe` / service restart | req | one | NOT EXECUTED | |
| SVC-07 | Health `http://127.0.0.1:8000/health` OK | req | req | NOT EXECUTED | |

## 3. Repair

| ID | Check | OS | Result | Evidence |
|----|-------|-----|--------|----------|
| REP-01 | Repair restores missing backend binaries | Win10+ | NOT EXECUTED | |
| REP-02 | Repair re-registers JumanApi service | Win10+ | NOT EXECUTED | |
| REP-03 | Repair preserves DB | Win10+ | NOT EXECUTED | |
| REP-04 | Repair preserves storage uploads | Win10+ | NOT EXECUTED | |
| REP-05 | Repair re-runs migrate if needed | Win10+ | NOT EXECUTED | |

## 4. Uninstall

| ID | Check | OS | Result | Evidence |
|----|-------|-----|--------|----------|
| UN-01 | Application removed | Win10+ | NOT EXECUTED | |
| UN-02 | JumanApi service removed (no orphan) | Win10+ | NOT EXECUTED | |
| UN-03 | Optional keep database works | Win10+ | NOT EXECUTED | |
| UN-04 | Optional drop database works | Win10+ | NOT EXECUTED | |
| UN-05 | Optional keep storage works | Win10+ | NOT EXECUTED | |
| UN-06 | Optional delete storage works | Win10+ | NOT EXECUTED | |
| UN-07 | Optional PostgreSQL product uninstall | Win10+ | NOT EXECUTED | |
| UN-08 | No orphan scheduled tasks for Juman | Win10+ | NOT EXECUTED | |
| UN-09 | No unexpected Juman registry leftovers (if any used) | Win10+ | NOT EXECUTED | |

## 5. Upgrade

| ID | Check | OS | Result | Evidence |
|----|-------|-----|--------|----------|
| UP-01 | Install baseline then RC Setup over same dir | one | NOT EXECUTED | |
| UP-02 | `juman.env` passwords/config preserved | one | NOT EXECUTED | |
| UP-03 | Database migrated forward | one | NOT EXECUTED | |
| UP-04 | Uploaded files preserved | one | NOT EXECUTED | |
| UP-05 | Services upgraded / running | one | NOT EXECUTED | |
| UP-06 | Application launches after upgrade | one | NOT EXECUTED | |

## 6. Business regression

| ID | Workflow | Result | Evidence |
|----|----------|--------|----------|
| BUS-01 | Authentication (login / force-password if applicable) | NOT EXECUTED | |
| BUS-02 | Customers CRUD | NOT EXECUTED | |
| BUS-03 | Categories CRUD | NOT EXECUTED | |
| BUS-04 | Inventory / dresses | NOT EXECUTED | |
| BUS-05 | Reservations | NOT EXECUTED | |
| BUS-06 | Rentals / checkout | NOT EXECUTED | |
| BUS-07 | Returns | NOT EXECUTED | |
| BUS-08 | Processing / inspection | NOT EXECUTED | |
| BUS-09 | Sales | NOT EXECUTED | |
| BUS-10 | Settlements | NOT EXECUTED | |
| BUS-11 | Reports (view) | NOT EXECUTED | |
| BUS-12 | Settings | NOT EXECUTED | |
| BUS-13 | Users | NOT EXECUTED | |
| BUS-14 | Roles | NOT EXECUTED | |
| BUS-15 | Audit list/detail | NOT EXECUTED | |
| BUS-16 | Backup | NOT EXECUTED | |
| BUS-17 | Restore | NOT EXECUTED | |
| BUS-18 | Ops Dashboard home KPIs | NOT EXECUTED | |

## 7. Hardware regression

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| HW-01 | Barcode scanner HID + manual fallback | NOT EXECUTED | |
| HW-02 | USB ESC/POS receipt test | NOT EXECUTED | |
| HW-03 | Network ESC/POS probe + test print | NOT EXECUTED | |
| HW-04 | Cash drawer open | NOT EXECUTED | |
| HW-05 | Camera capture | NOT EXECUTED | |
| HW-06 | Hardware diagnostics page pass/fail | NOT EXECUTED | |

## 8. Performance (informational unless catastrophic)

| ID | Metric | Target (soft) | Measured | Result |
|----|--------|---------------|----------|--------|
| PERF-01 | Cold startup to login UI | < 15s | — | NOT EXECUTED |
| PERF-02 | Warm startup | < 8s | — | NOT EXECUTED |
| PERF-03 | Dashboard load | < 3s | — | NOT EXECUTED |
| PERF-04 | Report load | record | — | NOT EXECUTED |
| PERF-05 | Backup duration | record | — | NOT EXECUTED |
| PERF-06 | Restore duration | record | — | NOT EXECUTED |
| PERF-07 | Large list responsiveness | usable | — | NOT EXECUTED |
| PERF-08 | Memory after 30 min idle | record | — | NOT EXECUTED |

## 9. Security (critical must-pass)

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| SEC-01 | RBAC: forbidden without permission | PASS (unit) | FE unit gates; operator route smoke NOT EXECUTED |
| SEC-02 | Renderer has no JWT/access token storage | PASS | AUTO-04 static |
| SEC-03 | HTTP/JWT only via Main IPC | PASS | AUTO-04 static |
| SEC-04 | Install config/credentials ACLs not world-writable | NOT EXECUTED | |
| SEC-05 | Backend service runs as intended account | NOT EXECUTED | |

## 10. Accessibility

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| A11Y-01 | Keyboard navigation primary flows | NOT EXECUTED | |
| A11Y-02 | Focus visible / management | NOT EXECUTED | |
| A11Y-03 | RTL layout correct | PASS (unit) | Existing RTL/i18n unit coverage |
| A11Y-04 | ARIA basics on shell/login | NOT EXECUTED | |
| A11Y-05 | High-contrast readability | NOT EXECUTED | |

## 11. Automated gates (agent)

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| AUTO-01 | Frontend Vitest suite | PASS | After DEF-RC-01; isolation 11/11; retention 5/5 |
| AUTO-02 | Backend pytest smoke | PASS | 34 passed (health/security/config/token/rbac defaults) |
| AUTO-03 | Installer env/retention unit tests | PASS | generate_env 7; retention 5 |
| AUTO-04 | Security static grep (renderer JWT/Axios) | PASS | No axios/JWT storage in renderer; Main sessionManager |
| AUTO-05 | Packaging scripts + artifact presence gate | PASS | Scripts+gitignore; artifacts absent (INFO) |
| AUTO-06 | certify-smoke.ps1 (if install present) | NOT EXECUTED | No Program Files install on agent host |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Operator (VM) | | | |
| Reviewer | | | |
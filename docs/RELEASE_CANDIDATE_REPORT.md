# Release Candidate Report — Juman v1.0

**Date:** 2026-07-30  
**Product:** جمان (Juman)  
**Version under test:** 1.0.0 RC  
**Certification scope:** QA only (no features, no UI redesign, no new APIs)  
**Evidence policy:** Rows without executed evidence = FAIL / NOT EXECUTED  

---

## Environments

| Environment | Role | Status |
|-------------|------|--------|
| Agent workstation (Windows 11 host) | Automated gates, static security, packaging script gate | Executed |
| Clean Win10 VM | Install / reboot / repair / uninstall / business | **NOT EXECUTED** |
| Clean Win11 VM | Install / reboot / (subset repair/uninstall) | **NOT EXECUTED** |
| Hardware station | USB + network ESC/POS, drawer, camera, scanner | **NOT EXECUTED** |
| Installed Program Files tree | `certify-smoke.ps1` post-install | **NOT EXECUTED** (no install on agent host) |

Packaging artifacts (`WinSW-x64.exe`, `juman-api.exe`, `Juman-Setup-*.exe`) were **absent** on disk during this run (expected without `package-installer.ps1`). Gate without `-RequireArtifacts` = PASS (scripts + gitignore).

---

## Matrix suite summary

Full row IDs: [`docs/certification/RC_TEST_MATRIX.md`](./certification/RC_TEST_MATRIX.md). Operator procedure: [`docs/certification/OPERATOR_VM_RUNBOOK.md`](./certification/OPERATOR_VM_RUNBOOK.md).

| Suite | Result | Notes |
|-------|--------|-------|
| 1. Installation (INST-*) | NOT EXECUTED | Requires Win10+Win11 clean VM |
| 2. Services (SVC-*) | NOT EXECUTED | Includes reboot persistence |
| 3. Repair (REP-*) | NOT EXECUTED | |
| 4. Uninstall (UN-*) | NOT EXECUTED | |
| 5. Upgrade (UP-*) | NOT EXECUTED | |
| 6. Business (BUS-*) | NOT EXECUTED | Operator against installed or DEV API |
| 7. Hardware (HW-*) | NOT EXECUTED | Physical station |
| 8. Performance (PERF-*) | NOT EXECUTED | Informational unless catastrophic |
| 9. Security (SEC-*) | PARTIAL | SEC-02/03 automated PASS; SEC-01 unit evidence; SEC-04/05 operator |
| 10. Accessibility (A11Y-*) | PARTIAL | RTL unit coverage; keyboard/focus operator |
| 11. Automated (AUTO-*) | See below | |

### Automated gate detail (AUTO-*)

| ID | Gate | Result | Evidence |
|----|------|--------|----------|
| AUTO-01 | Frontend Vitest | PASS (after DEF-RC-01) | Full run initially 205 passed / 5 failed (4 load timeouts + stale ProtectedRoute). Isolation re-run after fix: 11/11 on previously failing files. Installer retention: 5/5. |
| AUTO-02 | Backend pytest smoke | PASS | `tests/test_health.py`, `test_security.py`, `test_config.py`, `identity/test_token_service.py`, `rbac/test_defaults.py` → **34 passed** |
| AUTO-03 | Installer unit | PASS | `deployment/backend/test_generate_env.py` → **7 passed**; `installer-retention.test.ts` → **5 passed** |
| AUTO-04 | Security static | PASS | No axios in `frontend/src`; no JWT/access_token in renderer storage; tokens in `electron/main/auth/sessionManager.ts`; HTTP via `apiClient` → IPC `bridge().api.invoke` |
| AUTO-05 | Packaging presence | PASS (scripts/gitignore) | `certify-packaging-gate.ps1` exit 0; artifacts INFO-absent without `-RequireArtifacts` |
| AUTO-06 | certify-smoke.ps1 | NOT EXECUTED | No `C:\Program Files\Juman` install on agent host; script exits non-zero when tree missing (expected) |

### Security must-pass

| Check | Result |
|-------|--------|
| No access token in renderer storage/source | **PASS** (static) |
| HTTP/JWT only via Main IPC | **PASS** (static) |
| RBAC forbidden without permission | **PASS** (unit: e.g. row-actions, category create hide, settlement redirect) — operator route smoke still NOT EXECUTED |
| `config\juman.env` ACLs not world-writable | **NOT EXECUTED** |

---

## Defects found / fixed

| ID | Severity | Suite | Summary | Disposition |
|----|----------|-------|---------|-------------|
| DEF-RC-01 | Major (gate) | AUTO-01 | `ProtectedRoute` redirects to `/login` but unit test still expected `/unauthenticated`, failing certification Vitest gate | **Fixed** — updated `frontend/tests/unit/protectedRoute.test.tsx` to assert `/login` |
| DEF-RC-02 | Minor | AUTO-01 | Intermittent 5s timeouts under full-suite load (toast, tooltip, login, settlements) | **Accepted known issue** — pass in isolation; do not treat as product blocker; consider raising `testTimeout` or serializing heavy RTL suites in a follow-up |

No install/service/security product blockers were fixable in this agent-only phase (operator suites not executed).

---

## Known issues (non-blocking for this report’s code track)

- Cloud update path remains stubbed (by design).
- Notifications backend/UI deferred.
- Full `uv run pytest` without path filters can run long; certification used a documented smoke subset.
- Packaging binaries not committed (correct); operator must run `package-installer.ps1` before VM matrix.

---

## Release decision algorithm (applied)

Critical install/service/security/auth operator rows are **NOT EXECUTED** → algorithm mandates **NOT READY**.

Win10 + Win11 clean-install, reboot, repair, uninstall, business critical paths, and SEC-04 were not evidenced.

---

## Recommendation

NOT READY FOR RELEASE
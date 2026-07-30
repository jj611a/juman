# Operator VM Runbook — Juman v1.0 RC

Maps 1:1 to IDs in `RC_TEST_MATRIX.md`. Run as Administrator on clean VMs.

## Prerequisites

1. Build RC on a packaging PC:
   ```powershell
   powershell -File deployment\scripts\package-installer.ps1
   ```
2. Copy `frontend\release\Juman-Setup-*.exe` to each VM.
3. Snapshot the clean VM before install.

## Win10 / Win11 clean install (INST-*, SVC-*)

1. Run Setup.exe elevated → complete wizard → note install dir (default `C:\Program Files\Juman`).
2. INST-01..11: confirm each checklist item; screenshot services + first window.
3. Services:
   ```powershell
   sc.exe query postgresql-x64-16
   sc.exe query JumanApi
   Invoke-WebRequest http://127.0.0.1:8000/health -UseBasicParsing
   ```
4. Post-install smoke:
   ```powershell
   powershell -File "C:\Program Files\Juman\scripts\certify-smoke.ps1" -InstallDir "C:\Program Files\Juman"
   ```
5. Reboot (SVC-04). Re-query services + health.
6. SVC-05: `"C:\Program Files\Juman\backend\JumanApi.exe" stop` then `start`.
7. SVC-06: End `juman-api` process or stop service; confirm restart policy recovers or manual start works.

## Repair (REP-*)

1. Delete `backend\juman-api.exe` (or rename) while noting DB row count / a file in `storage\`.
2. Start Menu → **Repair Juman Services** or re-run Setup Repair.
3. Confirm binaries restored, service running, DB/storage intact, health OK.

## Uninstall (UN-*)

1. Snapshot first.
2. Uninstall via Apps & Features.
3. Exercise Keep DB / Drop DB and Keep storage / Delete storage prompts once each (separate snapshots).
4. Confirm `sc query JumanApi` fails (service gone).
5. Optional PG uninstall prompt once.
6. Check Task Scheduler for Juman tasks; note registry under `HKLM\Software\Juman` if present.

## Upgrade (UP-*)

1. Install previous known build (or document baseline = first RC build).
2. Create sample data + one file under `storage\`.
3. Run new Setup over same directory.
4. Confirm env passwords unchanged, migrate OK, file present, app launches.

## Business (BUS-*)

Login as admin (first-run if needed). Walk each module ID in matrix; mark FAIL with screenshot on error.

Critical path minimum for release algorithm: BUS-01, BUS-02, BUS-04, BUS-05, BUS-06, BUS-07, BUS-09, BUS-10, BUS-18.

## Hardware (HW-*)

On a station with devices: `/hardware` + `/hardware/diagnostics`. Record device models.

## Performance (PERF-*)

Stopwatch or Measure-Command; record in matrix Measured column.

## Security ACLs (SEC-04)

```powershell
icacls "C:\Program Files\Juman\config"
icacls "C:\Program Files\Juman\config\install-credentials.txt"
```
Expect Administrators + SYSTEM; not Everyone:F.

## Returning results

Update `docs/certification/RC_TEST_MATRIX.md` Result/Evidence columns, then notify the certification owner to refresh `docs/RELEASE_CANDIDATE_REPORT.md`.
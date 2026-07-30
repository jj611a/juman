# Production Release Checklist — Juman v1.0.0

Status legend: `[x]` done with evidence · `[ ]` open / NOT EXECUTED · `[~]` partial

## Documentation and versioning

- [x] Version locked to **1.0.0** (packages, backend APP_VERSION, installer naming)
- [x] About dialog + status/login show desktop semver
- [x] LICENSE present
- [x] Windows `icon.ico` + electron-builder `win.icon`
- [x] Release notes `docs/RELEASE_NOTES_v1.0.0.md`
- [x] Operator manual
- [x] Administrator manual
- [x] Version + developer build manifests
- [x] Installation / Upgrade / Recovery guides linked (canonical under `deployment/`)

## Build

- [x] `Juman-Setup-1.0.0.exe` built on this machine
- [x] SHA-256 checksum recorded (see `frontend/release/Juman-Setup-1.0.0.exe.sha256`)
- [x] `validate-release.ps1 -RequireArtifacts` PASS
- [x] `BUILD_MANIFEST.json` populated with commit + checksum

## Operator / RC certification (from RC report — do not invent PASS)

- [ ] Installer validated (clean install)
- [ ] Windows 10 validated
- [ ] Windows 11 validated
- [ ] Upgrade validated
- [ ] Repair validated
- [ ] Uninstall smoke validated
- [ ] Hardware validated (physical station)
- [ ] Backup validated
- [ ] Restore validated
- [ ] Performance validated
- [ ] Security ACLs validated on install tree
- [ ] Accessibility (keyboard/focus) operator validated

## Automated (agent / CI)

- [x] Security static: no JWT/Axios in renderer (RC AUTO-04)
- [x] Packaging scripts + gitignore gate (RC AUTO-05)
- [~] Full FE/BE suites — use smoke + known flake notes from RC

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Prep owner | | | |
| Operator cert | | | |
| Release approver | | | |

**Ship rule:** All critical install/service/security operator rows must be `[x]` before production release approval.
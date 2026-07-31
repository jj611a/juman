# Installer Step Diagnostics — beta.5 fix (re-upload)

## Failure observed
Install aborted with exit 1 while targeting:
`C:\Users\ivan\AppData\Local\Programs\Juman\` (per-user path).

## Fixes in this re-upload
1. **perMachine: true** — default install is `C:\Program Files\Juman` (required for services + PostgreSQL).
2. **64-bit PowerShell via Sysnative** — NSIS is 32-bit; previously Wow64 redirected `Program Files` to `(x86)`, breaking EDB install/verify.
3. **ProgramW6432** for PostgreSQL prefix (`C:\Program Files\PostgreSQL\16`).
4. **Short TEMP copy** of the EDB EXE before silent install (path-length robustness).
5. **Retry ladder** for silent flags; capture installbuilder log tails into `postgresql-install.log`.
6. MessageBox shows the failed step from `installer.json`.

## Operator notes
- Uninstall any broken per-user Juman under AppData before reinstalling.
- If an old broken `postgresql-x64-16` exists, remove it from Apps & Features first.
- On failure read `%ProgramFiles%\Juman\logs\installer.json`.
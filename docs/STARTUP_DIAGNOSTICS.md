# Startup Diagnostics & Recovery Center

Operator/developer tool for diagnosing why Juman failed to start after installation.

**Does not change business logic.** Machine-level checks run in Electron main; deep DB/Alembic probes use `juman-api.exe diagnose --json`.

## Launch methods

| Method | How |
|--------|-----|
| Automatic | When the main window cannot reach `/api/v1/health` after first-run, Diagnostics opens once per session |
| Help menu | **مساعدة → التشخيص والاستعادة…** (`Ctrl+Shift+D`) |
| CLI | `Juman.exe --diagnostics` |
| Start Menu | **Juman → Diagnostics** |

## UI layout (RTL, black/gold)

- **Right (start):** check list — PASS / WARNING / FAIL, duration, timestamp
- **Center:** selected check details, root exception, evidence JSON
- **Left:** searchable logs (copy / refresh)
- **Bottom:** confirmed repair actions + overall summary

## Status meanings

| Status | Meaning |
|--------|---------|
| PASS | Subsystem healthy for startup |
| WARNING | Degraded but may still run |
| FAIL | Likely startup blocker |

Checks **never stop after the first failure** — all 11 groups always run.

---

## Check 1 — Application Information

Reports: application version, backend version (if reachable), Electron/Chrome/Node versions, installer/app version, `runtime/update-channel.json` manifest, configuration path, storage path, data path, logs path, install root.

## Check 2 — Configuration

Verifies `config\juman.env` (KEY=VALUE, **not** JSON/YAML):

- File exists / readable
- Parse errors with line numbers
- Required keys: `DATABASE_URL`, `SECRET_KEY`, `PORT`, `MEDIA_STORAGE_ROOT`
- Invalid values (PORT range, DATABASE_URL shape)
- Displays **redacted** parsed configuration

## Check 3 — Filesystem

Verifies directories: storage, logs, media, backup, temporary, data — readable/writable probes and disk free space (WARNING under ~2 GB).

## Check 4 — PostgreSQL

Verifies: EDB install (`postgres.exe`), version, Windows service `postgresql-x64-16`, running state, start type, `%ProgramData%\Juman\PostgreSQL\16\data`, port 5432, auth/DB/user via diagnose JSON.

## Check 5 — Database

Via `juman-api.exe diagnose --json`: connection, schema version (`alembic_version`), latest head, migration status, pending migrations, latency.

## Check 6 — Alembic

Reports migration history, HEAD, current revision, upgrade possible; **downgrade disabled (expected PASS note)**.

## Check 7 — Backend

Verifies `backend\juman-api.exe` exists, SHA-256, diagnose launch exit/stdout/stderr, WinSW/`JumanApi` service, `/api/v1/health`, timing, crash hints.

## Check 8 — Electron ↔ Backend

Health reachability from main, IPC bridge (`diagnostics.ping`), API client path, renderer communication.

## Check 9 — Ports

Configured `PORT`, listeners (PID/process), conflicting process detection.

## Check 10 — Permissions

Administrator elevation status, folder R/W on config/logs/storage/data, service permission notes.

## Check 11 — Hardware

Validates `hardware-station.json` only (camera device id, barcode scan settings, printer names). **No device I/O.**

---

## Repair actions (confirmation required)

| Action | Behavior |
|--------|----------|
| إعادة تشغيل الخدمات | Elevated `start-services-elevated.ps1` |
| إعادة تشغيل PostgreSQL | `sc stop/start postgresql-x64-16` (elevated fallback) |
| إعادة تشغيل JumanApi | Existing restart helper |
| إصلاح الخدمات | `repair-install.ps1` / WinSW repair |
| إعادة الترحيلات | `juman-api.exe migrate` (+ elevated repair fallback) |
| إصلاح الصلاحيات | `set-install-acls.ps1` |
| إصلاح مجلدات الإعداد | `ensureInstallDirs` + ACLs (**no secret rotation**) |
| اختبار اتصال قاعدة البيانات | `diagnose --json` |
| فتح مجلد السجلات / التخزين / الإعدادات | `shell.openPath` |

After each repair, the full check suite re-runs.

## Logging

Collected sources (tailed):

- Electron main (`%APPDATA%\Juman\logs\electron-main.log`)
- Backend / WinSW logs under install `logs\` and `backend\`
- Installer: `postgresql-install.log`, EDB debugtrace, `%TEMP%\installbuilder_installer_*`
- PostgreSQL data `log\` when present

UI: search, copy, refresh. Unhandled exceptions are appended to the Electron main log and never swallowed in check results.

## Report export

**تصدير ZIP** → `diagnostics-report.zip` containing:

- System information
- Redacted configuration
- Environment metadata
- Installed versions / health report (full run JSON)
- Exception traces
- Log tails

Default suggestion: `%ProgramFiles%\Juman\logs\diagnostics-report-*.zip`

## Backend CLI

```bat
"%ProgramFiles%\Juman\backend\juman-api.exe" diagnose --json
"%ProgramFiles%\Juman\backend\juman-api.exe" migrate
```

Health contract for scripts and Electron: `http://127.0.0.1:8000/api/v1/health` (not `/health`).

## Escalation

If Diagnostics cannot restore startup, follow [deployment/RECOVERY_GUIDE.md](../deployment/RECOVERY_GUIDE.md).

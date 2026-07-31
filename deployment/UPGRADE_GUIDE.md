# Juman Upgrade Guide

1. Close Juman desktop app.
2. Stop service: `"%ProgramFiles%\Juman\backend\JumanApi.exe" stop`
3. Run the new **Install Juman.exe** (repair/upgrade preserves DB + storage).
4. NSIS refreshes backend source, requirements, embed Python, scripts.
5. First launch (or repair) re-runs bootstrap if `requirements.sha256` fingerprint changed, then migrate + WinSW restart.
6. Confirm `sc query JumanApi` is RUNNING and health OK.

## Notes

- Do not delete `config\juman.env` during upgrade.
- Live PyPI is required when requirements fingerprint changes.
- Forward-only Alembic migrations via `run_api.py migrate`.
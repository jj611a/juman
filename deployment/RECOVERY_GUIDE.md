# Juman Recovery Guide

## Backend not starting after install

1. Confirm PostgreSQL: `sc query postgresql-x64-16` is RUNNING.
2. Confirm `config\juman.env` exists under `%ProgramFiles%\Juman`.
3. Re-run elevated bootstrap (needs PyPI):
   - Start Menu → **Bootstrap Backend**, or
   - `"%ProgramFiles%\Juman\scripts\elevate-bootstrap.cmd"`
4. Check `%ProgramFiles%\Juman\logs\bootstrap-*.log`.

## Migrate / repair

```bat
"%ProgramFiles%\Juman\backend\.venv\Scripts\python.exe" "%ProgramFiles%\Juman\backend\run_api.py" migrate
"%ProgramFiles%\Juman\backend\JumanApi.exe" restart
```

Or elevated repair (re-bootstrap + migrate + WinSW):

```bat
"%ProgramFiles%\Juman\scripts\elevate-repair.cmd"
```

## Corrupt WinSW registration

```bat
"%ProgramFiles%\Juman\backend\JumanApi.exe" stop
"%ProgramFiles%\Juman\backend\JumanApi.exe" uninstall
"%ProgramFiles%\Juman\backend\JumanApi.exe" install
"%ProgramFiles%\Juman\backend\JumanApi.exe" start
```

(Requires `backend\.venv` already bootstrapped.)

## Broken / half-installed venv

Delete `%ProgramFiles%\Juman\backend\.venv` and `%ProgramFiles%\Juman\config\backend.bootstrap.ok`, then run Bootstrap Backend again (internet required).

## Port conflict

Stop the conflicting process or change `PORT=` in `config\juman.env`, then restart `JumanApi`.
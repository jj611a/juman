# Juman Uninstall Guide (Phase 7.0)

## Default (safe)

Uninstaller:

1. Stops and removes `JumanApi` WinSW service.
2. Removes application files / shortcuts.
3. **Asks** whether to keep the `juman` database (default: keep).
4. **Asks** whether to keep `storage\` uploads (default: keep).
5. **Asks** whether to uninstall PostgreSQL 16 product (default: no).

## Drop database only

Choose No on “Keep database” and confirm. Uses `scripts\drop-database.ps1` with the install-time PG super password from `.install-secrets.env`.

## Remove PostgreSQL product

Optional prompt launches EDB `uninstall-postgresql.exe` when present. Prefer backup first.

## Preserve uploads

Choose Yes on storage retention. Files remain under the former install path until manually deleted.
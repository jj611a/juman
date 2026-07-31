# Juman Uninstall Guide

## Default (safe)

Uninstaller:

1. Stops and removes `JumanApi` WinSW service.
2. Removes application files / shortcuts.
3. **Asks** whether to keep the `juman` database (default: keep).
4. **Asks** whether to keep `storage\` uploads (default: keep).
5. Does **not** uninstall PostgreSQL — it is operator-owned (installed via **Install PostgreSQL.exe**).

## Drop database only

Choose No on “Keep database” and confirm. Uses `scripts\drop-database.ps1` with credentials from the install environment / app config as applicable.

## Remove PostgreSQL product

Not performed by Juman Setup. Use Windows Apps & Features / EDB uninstall for the PostgreSQL 16 product if you intentionally want to remove it. Prefer backup first.

## Preserve uploads

Choose Yes on storage retention. Files remain under the former install path until manually deleted.

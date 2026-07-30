# Juman (جمان) Release Notes — v1.0.0

**Product:** جمان — Arabic RTL desktop ERP for dress rental and sales  
**Version:** 1.0.0  
**Date:** 2026-07-30  

## Major features

- Desktop Electron shell (Arabic RTL) with IPC-only API access (no JWT in renderer)
- Identity: login, force password change, sessions via Main process
- RBAC: roles, permissions, permission-gated UI
- Domains: Categories, Customers, Inventory/Dresses, Calendar, Reservations, Rentals/Checkout, Returns, Inspection, Processing, Sales, Settlements
- Reports and Ops Dashboard home (KPIs from dashboard report API)
- Administration: Users, Roles, Settings, Audit, System backup/restore/maintenance
- Hardware station: HID barcode, USB + network ESC/POS, cash drawer, camera, diagnostics
- Windows installer (NSIS): PostgreSQL silent install, DB bootstrap, Alembic migrate, WinSW `JumanApi`, health gate, repair/uninstall policies, first-run wizard

## Supported hardware

- Barcode scanner (HID keyboard wedge) + manual entry fallback
- ESC/POS receipt printers (USB and TCP/IP network)
- Cash drawer (via ESC/POS pulse)
- Webcam / capture devices for dress and customer photos

Device models vary by station; validate with `/hardware/diagnostics`.

## System requirements

- Windows 10 or Windows 11 (x64)
- Administrator rights for install
- Local PostgreSQL 16 (bundled silent install path)
- Disk space for application, database, and `storage\` media
- LAN optional for network printers only (no cloud required for core ops)

## Known limitations (intentional)

- In-app **Notifications** require a backend Notifications module (not shipped)
- **Cloud auto-updates** are stubbed (`checkUpdates` returns not implemented)
- Top-bar global search, command palette, company switcher, profile edit, and some export actions show «قريبًا» by design
- Cloud media providers (S3/MinIO/Azure/GCS) are not enabled; local filesystem storage only
- Desktop filesystem helper IPC remains a stub

## Deferred features

- Notifications UI (and backend module)
- Cloud update channel
- POS mode (future)
- Full store certification remains operator-owned (Win10/Win11 VM matrix)

## Breaking changes

None — first public **1.0.0** line. Fresh install or upgrade from internal RC builds follows [`deployment/UPGRADE_GUIDE.md`](../deployment/UPGRADE_GUIDE.md).

## Related docs

- [Installation](../deployment/INSTALLATION_GUIDE.md) · [Upgrade](../deployment/UPGRADE_GUIDE.md) · [Recovery](../deployment/RECOVERY_GUIDE.md) · [Uninstall](../deployment/UNINSTALL_GUIDE.md)
- [Operator Manual](./release/OPERATOR_MANUAL.md) · [Administrator Manual](./release/ADMINISTRATOR_MANUAL.md)
- [RC Report](./RELEASE_CANDIDATE_REPORT.md) · [Production Checklist](./PRODUCTION_RELEASE_CHECKLIST.md)
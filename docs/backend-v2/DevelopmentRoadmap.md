# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | Auth + audit remediation |
| 3 | Core Business | **3.1–3.5 DONE** (shared → customers → media → cert → barcode) |
| 4 | Inventory Engine | **4.1 Catalog DONE** — availability/rentals later |
| 5 | Rental Engine | Reservations → returns |
| 6 | Financial Engine | Sales, settlements, payments |
| 7 | Reports & Analytics | Operational + financial |
| 8 | Desktop Integration | Electron + Nest sidecar |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 4.1 Inventory Catalog Engine complete.**  
Doc: `InventoryDesign.md`.

**Next (requires approval):** inventory availability / rental workflows — still no reservations, calendar, laundry, inspection, or sales.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

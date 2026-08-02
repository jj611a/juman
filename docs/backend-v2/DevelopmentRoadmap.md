# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | Auth + audit remediation |
| 3 | Core Business | **3.1?3.4 DONE** (shared ? customers ? media ? certification) ? next slice TBD |
| 4 | Inventory Engine | Dresses / inventory |
| 5 | Rental Engine | Reservations ? returns |
| 6 | Financial Engine | Sales, settlements, payments |
| 7 | Reports & Analytics | Operational + financial |
| 8 | Desktop Integration | Electron + Nest sidecar |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 3.4 Engineering Certification complete (85 PASS WITH WARNINGS).**  
Doc: `PHASE_3_ENGINEERING_CERTIFICATION.md`. Prior: Media/Customer/SharedFoundation.

**Next (requires approval):** categories / settings HTTP ? still no inventory/rentals/sales.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

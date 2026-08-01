# Backend V2 Development Roadmap

Independent of the legacy master roadmap. Track progress on the **JUMAN BACKEND V2 ROADMAP** canvas.

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, `backend-python` rename, canvas |
| 1 | Foundation | Nest bootstrap, Prisma/SQLite, `/health`, tooling |
| 2 | Authentication | Identity foundation → full auth APIs (2.1 → 2.x) |
| 3 | Core Modules | Customers, categories, inventory/dresses, settings |
| 4 | Rental Engine | Reservations, rentals, returns, availability |
| 5 | Financial | Sales, settlements, payments |
| 6 | Reports | Operational and financial reports |
| 7 | Hardware | Printers, scanner, drawer bridges |
| 8 | Desktop Integration | Electron spawn, portable paths, installer |
| 9 | Testing | Parity suites vs Python behavior |
| 10 | Production | Hardening, packaging, cutover |

## Current milestone

**Phase 2.1 Authentication Foundation complete.**  
Next (approval required): Phase 2.2 — change-password, admin user/role APIs, unlock, bootstrap admin, logout-all/sessions list.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

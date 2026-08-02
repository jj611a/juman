# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | Auth + audit remediation |
| 3 | Core Business | **3.1–3.5 DONE** |
| 4 | Inventory Engine | **4.1–4.3 DONE** (catalog → lifecycle → certification) |
| 5 | Rental Engine | Reservations → returns (**blocked** until inventory Must-Fix) |
| 6 | Financial Engine | Sales, settlements, payments |
| 7 | Reports & Analytics | Operational + financial |
| 8 | Desktop Integration | Electron + Nest sidecar |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 4.3 Inventory Engineering Certification complete (78 PASS WITH WARNINGS).**  
Doc: `PHASE_4_ENGINEERING_CERTIFICATION.md`.

**Next:** Inventory Must-Fix remediation (requires approval) — still **no** reservations/rentals/calendar/payments until Must-Fix cleared.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

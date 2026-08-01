# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | 2.1–2.2 code → 2.3 audit FAIL → **2.4 remediation** → re-audit |
| 3 | Core Business | Customers, categories, settings |
| 4 | Inventory Engine | Dresses / inventory |
| 5 | Rental Engine | Reservations → returns |
| 6 | Financial Engine | Sales, settlements, payments |
| 7 | Reports & Analytics | Operational + financial |
| 8 | Desktop Integration | Electron + Nest sidecar |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 2.4 Release Blocker Remediation complete.**  
Re-audit: `docs/backend-v2/AUDIT_PHASE_2_RETEST.md`.

**Phase 3 remains gated** on re-audit Must-Fix clearance (see retest verdict).

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`. Audit phases may FAIL without implementing features.
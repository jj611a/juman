# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | Auth + audit remediation |
| 3 | Core Business | **3.1–3.5 DONE** |
| 4 | Inventory Engine | **4.1–4.4 DONE** |
| 5 | Rental Engine | **5.1–5.4 DONE** |
| 6 | Financial Engine | **6.1 DONE** (core ledger) — settlement/reports later |
| 7 | Reports & Analytics | Operational + financial |
| 8 | Desktop Integration | Electron + Nest sidecar |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 6.1 Financial Core complete.**  
Docs: `FinancialDesign.md`.

**STOP:** Do **not** implement settlement, late fees, penalties, invoices, reports, or export until approved.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

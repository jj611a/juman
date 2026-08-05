# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | Auth + audit remediation |
| 3 | Core Business | **3.1–3.5 DONE** |
| 4 | Inventory Engine | **4.1–4.4 DONE** |
| 5 | Rental Engine | **5.1–5.4 DONE** |
| 6 | Financial Engine | **6.1–6.7.1 DONE** — Sales engine + integrity certification |
| 7 | Reports & Analytics | **7.0 DONE** — reporting engine (read-only) |
| 8 | Desktop Integration | **8.0–8.1 DONE** — compat façade + E2E cert (packaging later) |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 6.7.1 Sales integrity hardening certified (PASS, overall 93/100).**  
Coverage ≥95% on `src/sales/**`; rollback / concurrency / Walk-in / RBAC / soft-delete certified.  
Reports: `PHASE_6_7_1_SALES_CERTIFICATION.md`, `cert_sales_671.json`.  

**STOP:** Do **not** build POS UI, receipts, returns, refund UI, sales reports, or change Settlement formulas until explicitly approved.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | Auth + audit remediation |
| 3 | Core Business | **3.1–3.5 DONE** |
| 4 | Inventory Engine | **4.1–4.4 DONE** |
| 5 | Rental Engine | **5.1–5.4 DONE** |
| 6 | Financial Engine | **6.1–6.7 DONE** — domain + Sales engine |
| 7 | Reports & Analytics | **7.0 DONE** — reporting engine (read-only) |
| 8 | Desktop Integration | **8.0–8.1 DONE** — compat façade + E2E cert (packaging later) |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 6.7 Sales domain backend complete (CONDITIONAL GO, readiness 90/100).**  
Polymorphic Settlement + Walk-in customer + `SalesModule`. Report: `PHASE_6_7_SALES_ENGINE_REPORT.md`.  
Prior: Phase 8.1 E2E cert CONDITIONAL GO.  

**STOP:** Do **not** build POS UI, change Settlement formulas, remove `legacyBridge`, or cut over installer packaging until explicitly approved.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

# Backend V2 Development Roadmap

| Phase | Name | Goal |
|------:|------|------|
| 0 | Architecture | Docs, branch, rename, canvas |
| 1 | Foundation | Nest + Prisma + SQLite + `/health` |
| 2 | Identity & Security | Auth + audit remediation |
| 3 | Core Business | **3.1–3.5 DONE** |
| 4 | Inventory Engine | **4.1–4.4 DONE** |
| 5 | Rental Engine | **5.1–5.4 DONE** |
| 6 | Financial Engine | **6.1–6.6 DONE** — domain complete |
| 7 | Reports & Analytics | **7.0 DONE** — reporting engine (read-only) |
| 8 | Desktop Integration | **8.0 DONE** — frontend Nest compat façade (packaging later) |
| 9 | Testing & Hardening | Parity suites |
| 10 | Production & Installer | Cutover |

## Current milestone

**Phase 8.0 Frontend↔Nest compatibility complete.**  
Electron `apiClient` talks to Nest on `:8787` via `src/services/v2` façade (legacy envelopes preserved). Nav pruned for modules without V2 HTTP. Installer packaging / Nest sidecar bundling remains later Phase 8/10 work.

**STOP:** Do **not** change Settlement formulas, redesign UI layouts, or cut over installer packaging until explicitly approved. Next: Phase 8 packaging / Phase 9 hardening on approval.

## Completion rule

A phase is complete when: docs/canvas updated, tests for the phase pass, and a dedicated commit exists on `backend-v2`.

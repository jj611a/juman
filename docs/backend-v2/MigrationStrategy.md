# Backend V2 Migration Strategy

This is **not** a code migration. Python is the specification.

## Flow per module

```
Python backend-python
        ↓
Analyze behavior (routes, invariants, edge cases, tests)
        ↓
Reimplement cleanly in Nest + Prisma + SQLite
        ↓
Verify behavior (automated + manual parity)
        ↓
Mark module completed on V2 roadmap canvas
```

## Rules

1. Do not copy Python code into TypeScript.
2. Do not delete `backend-python/` until **all** modules reach parity.
3. Prefer behavioral tests extracted from Python suites as acceptance criteria.
4. SQLite schema is designed for desktop single-writer workloads; do not assume Postgres features.
5. Installer cutover happens only after Phase 8–10 gates.

## Cutover

Only after full parity may `backend-python/` be archived (e.g. moved to `archive/` or removed in a dedicated release decision). Until then it remains read-only documentation.

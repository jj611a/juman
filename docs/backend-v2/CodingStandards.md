# Backend V2 Coding Standards

## Language and runtime

- TypeScript **strict** (`strict: true`, no implicit any)
- Node.js LTS
- NestJS only (no Express app shell, no Fastify unless Nest adapter is Nest-owned)
- Prisma only for persistence (no raw SQL drivers as primary ORM)
- SQLite only (no PostgreSQL, no Alembic)

## Style

- ESLint + Prettier enforced
- Prefer named exports for domain types; Nest uses class DI as framework requires
- No `any` without an explicit justification comment
- Async/await only; no untyped callbacks for control flow

## Architecture rules

1. **Feature-first folders** under `src/` for domain modules (from Phase 2+)
2. **SOLID** — thin controllers, use-case services, Prisma behind repository/adapters when domain grows
3. **Clean Architecture** — HTTP layer must not import Prisma client directly outside `database/` and feature repositories
4. **DDD where appropriate** — bounded contexts mirror Python modules only after behavior analysis
5. **No business logic in** `main.ts`, filters, or config loaders

## Testing

- Vitest for unit and HTTP smoke tests
- One logical feature → tests in the same patch when behavior is non-trivial
- Do not mock the entire Nest container when a focused unit test suffices

## Forbidden on `backend-v2`

- Editing `backend-python/**` application code
- Adding domain modules outside the approved phase
- Introducing PostgreSQL, Alembic, or Python runtimes into `backend-node`

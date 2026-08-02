# Customer API (Phase 3.2)

Base: Nest HTTP (no `/api/v1` prefix). Auth: Bearer access JWT. RBAC via `@RequirePermissions`.

## Endpoints

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | /customers | customer.view | List + filters/sort/pagination |
| GET | /customers/search | customer.view | Requires `q` |
| GET | /customers/number/:customerNumber | customer.view | Live row by number |
| GET | /customers/:id | customer.view | Live row by UUID |
| POST | /customers | customer.create | Create |
| PATCH | /customers/:id | customer.update | Partial update |
| DELETE | /customers/:id | customer.delete | Soft delete (200) |
| POST | /customers/:id/restore | customer.restore | Restore (200) |

## Create body

`fullName`, `phone` required. Optional: `secondaryPhone`, `address`, `city`, `nationalId`, `gender` (`MALE|FEMALE|OTHER`), `birthDate` (ISO date), `notes`, `status`.

## List / search query

- `q` ? partial match on name, phones (display + normalized), address, city, nationalId, notes, customerNumber
- `status`, `city`
- `createdFrom`, `createdTo`, `updatedFrom`, `updatedTo` (ISO)
- `deleted` ? `true` for soft-deleted only; `false`/omit for live (`parseOptionalBoolean`)
- `sortBy` ? `fullName|createdAt|updatedAt|phone|customerNumber`
- `sortDir` ? `asc|desc`
- `offset`, `limit` (shared pagination caps)

## Responses

Paginated lists return shared shape: `{ items, meta: { total, offset, limit, ... } }`.

## Errors

- 400 validation (DTO / phone / nationalId / birthDate / missing `q` on search)
- 401/403 authz
- 404 missing or soft-deleted (for live getters)
- 409 duplicate active primary phone; restore when not deleted or phone conflict

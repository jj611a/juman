# Backend V2 Customer Domain (Phase 3.2)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/customers`  
**Spec reference:** `backend-python/` (behavioral only ? not copied)

## Scope

First business module. Desktop-first CRUD for customers with soft delete, restore, search, filters, sort, pagination, phone normalization, duplicate primary-phone guard, and shared audit.

## Model

Prisma `Customer` (UUID PK):

| Field | Notes |
|-------|-------|
| customerNumber | Unique `CUS-########` from settings + SequenceCounter |
| fullName | Required |
| phone / phoneNormalized | Display preserved; digits normalized (Iraqi `07?` ? `9647?`) |
| secondaryPhone / secondaryPhoneNormalized | Optional |
| address, city, nationalId, gender, birthDate, notes | Optional |
| status | `active` | `inactive` |
| createdBy / updatedBy / deletedBy | Actor ids |
| createdAt / updatedAt / deletedAt | Soft delete |

**Not modeled as child tables:** notes stay on the row; attachments use shared `MediaReference` (`moduleName=customers`); audit uses shared `AuditLog` via `AuditService`.

## APIs

See `CustomerAPI.md`.

## Permissions

`customer.view` ? `customer.create` ? `customer.update` ? `customer.delete` ? `customer.restore`

## Architecture rules

- Repository private; module exports `CustomersService` only.
- Phone helpers live in `src/shared/phone` (not inside customers).
- Query boolean parsing uses `parseOptionalBoolean` (shared).
- No inventory / rentals / sales / reports in this phase.

## Coverage

```bash
pnpm test:cov:customers
```

Gate: lines/statements/functions ? 95%, branches ? 80% on customers + phone.

## Known limitations

- Case-insensitive `contains` depends on SQLite collation (ASCII-centric); Arabic search is substring match without full collation folding.
- View audit is optional (`recordView`) and not enabled on `GET /customers/:id` by default.
- No dedicated CustomerAddress / CustomerNote tables (address/city/notes are columns).
- Cursor pagination is not shipped; offset pagination uses shared `normalizePagination`.

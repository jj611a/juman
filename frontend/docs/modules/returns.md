# Returns module (5.7)

Arabic RTL feature under src/features/returns/.

## Transport

- Domain: piClient.returns.*
- Create only — no PATCH/cancel/complete in v1
- Pagination: offset / limit

## Surfaces

| Route | Behavior |
|---|---|
| #/returns | List: status, customer lookup, rental_id; item count |
| #/returns/new | Wizard: ACTIVE rental → review (rental money trio read-only) → POST |
| #/returns/:id | Detail + audit (Return); CTA to start inspection when PENDING_INSPECTION |

## Permissions

- 
eturn.view / 
eturn.create (
eturn.update unused)

## Locks

- Items derived from ACTIVE rental on the server
- No charges, penalties, or settlement on Returns
- Status display maps only — no client transitions
- Inspection and settlement are separate modules

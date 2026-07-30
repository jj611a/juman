# Sales module (5.9)

Arabic RTL feature under `src/features/sales/`.

## Transport

- Domain: `apiClient.sales.*`
- Create is atomic COMPLETED — no PATCH/void/refund

## Surfaces

| Route | Behavior |
|---|---|
| `#/sales` | List: status, origin, customer; `total_amount` from DTO |
| `#/sales/new` | NORMAL_SALE or MANDATORY_DAMAGE_PURCHASE |
| `#/sales/:id` | Detail + nested payments + audit (`Sale`) |

## Permissions

- `sale.view` / `sale.create`

## Locks

- No remaining_balance on sales — fully paid at create
- No client change/tender math

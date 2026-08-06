# Inspection + Processing module (5.8)

Arabic RTL feature under src/features/processing/ (single nav hub: المعالجة).

## Transport

- piClient.inspections.* — list/get/create/PATCH (items + complete)
- piClient.processing.* — list/get/create/PATCH notes/start/add-optional-day/complete
- Pagination: offset / limit

## Surfaces

| Route | Behavior |
|---|---|
| #/processing | Tabs: فحص / معالجة / جاهز mapped to API list filters |
| #/processing/inspections | Inspection list |
| #/processing/inspections/new?returnId= | Scaffold inspection from return |
| #/processing/inspections/:id | Condition edits + save/complete |
| #/processing/batches | Processing batch list |
| #/processing/batches/new | Create from laundry-bound inspection items |
| #/processing/batches/:id | Start / optional day / complete; API dates only |

## Permissions

- inspection.view|create|update
- processing.view|create|update|complete
- Nav shown if processing.view **or** inspection.view

## Locks

- No separate Cleaning/Repair HTTP queues
- Penalties displayed only — never collect payment here
- No inspection/processing photo upload; dress gallery view-only via inventory photos
- No client day/status math for processing windows
- Settlements / Sales out of scope

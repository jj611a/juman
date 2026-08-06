# Audit & System Management (5.12)

## Audit (`src/features/audit/`)

- `apiClient.audit.listLogs` / `getLog`
- Filters: module, entity_type, entity_id, action, username, q, dates
- Export placeholder only

## System (`src/features/system/`)

- Status: health, version, info, diagnostics, metrics
- Backups / restore / maintenance via `/system/*`
- Production readiness = diagnostics overall status (no fake endpoint)

## Permissions

- `audit.view`
- `system.view|backup|restore|maintenance`

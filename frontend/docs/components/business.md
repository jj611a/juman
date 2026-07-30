# Shared business components (Phase 2.7)

Presentation-only widgets shared across modules. Import from `@/components/ui`.

**Rules**

- No HTTP / IPC / MediaClient
- No module-specific business rules
- Money is integer **fils**; IQD via `CurrencyMeta`
- Permissions are UX-only (API remains the authority)
- Media consumes `StoredFileMeta`; parent supplies `src`

## Money

| Component | Role |
|---|---|
| `MoneyDisplay` | Format fils (`positive` / `negative` / `zero` styles; `compact`) |
| `CurrencyBadge` | Currency code chip (default IQD) |

Uses `formatMoney` / `filsToDisplay` from `@/lib/money/currency`.

## Status

| Component | Role |
|---|---|
| `StatusChip` | Domain status with optional icon; reuses `mapStatus` / `DataStatusTone` |
| `StatusBadge` | Dense table badge (Phase 2.5) — keep for DataTable cells |

## Permissions

| Component | Role |
|---|---|
| `PermissionGuard` | `permission` **or** `anyOf` **or** `allOf`; `mode: hide | disable` |
| `PermissionGate` | Thin app wrapper (`@/app/PermissionGate`) → Guard hide + single permission |

## Identity / chrome

`AvatarGroup`, `UserChip`, `EntityHeader`, `EntityMeta`, `RecordInfoPanel`, `CreatedUpdatedInfo`, `TagList`

## Media / barcode

`MediaThumbnail`, `MediaGallery` (viewer only), `DressThumbnail`, `BarcodeDisplay`, `BarcodeScannerField` (`onScanRequest` only — no hardware)

## Misc

`AuditTimeline`, `SearchHighlight` (safe, no HTML injection), `CopyButton` (toast on success), `RelativeTime`

## Showcase

`#/dev/business`

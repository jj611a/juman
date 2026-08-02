# Backend V2 Inventory Design (Phase 4.1 — Catalog Engine)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/inventory`  
**Role:** Generic Item Catalog. Frontend may still say “Dress”; backend does not hardcode dress workflows.

## Scope

In scope: Category, Brand, Color, Size, Item CRUD; soft delete/restore; search/filter; ItemMedia + ItemBarcode relations; reuse of Media + Barcode platforms.

**Out of scope:** reservations, rentals, availability calendar, penalties, laundry, inspection, sales.

## Architecture

```
Item ──► Category (optional parentId — tree-ready)
     ──► Brand
     ──► Color (optional #RRGGBB)
     ──► Size
     ──► ItemMedia ──► MediaFile   (no blobs in inventory)
     ──► ItemBarcode ──► Barcode   (no generation logic in inventory)
```

Entity type for platform binds: `item`. Module name: `inventory`.

## Catalog status (not rental availability)

`draft` · `active` · `inactive` · `archived` · `retired`

Optional condition: `new` · `good` · `fair` · `poor` · `unknown`

## Item fields

internalCode (auto `ITM-########`), displayName, taxonomy FKs, purchase/rental/sale prices (integer fils), condition, status, description, actors, soft-delete timestamps.

## HTTP

| Area | Paths | Permissions |
|------|-------|-------------|
| Categories | `/categories` | `categories.*` (+ restore) |
| Brands | `/brands` | `inventory.*` |
| Colors | `/colors` | `inventory.*` |
| Sizes | `/sizes` | `inventory.*` |
| Items | `/items` | `inventory.view/create/update/delete/restore` |

Item extras: `GET /items/search`, `GET /items/code/:internalCode`, `POST /items/:id/media`, create with `generateBarcode` or `barcode`.

## Platforms

- Barcodes: `BarcodeService.generate|reserve` → `activate(..., 'item', itemId)` → `ItemBarcode`
- Media: upload via `/media`; attach via `MediaService.attach` + `ItemMedia`

## Coverage

```bash
pnpm test:cov:inventory
```

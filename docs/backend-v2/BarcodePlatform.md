# Backend V2 Barcode Platform (Phase 3.5)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/barcode`  
**Role:** Centralized, reusable barcode registry for every future domain.

## Scope

Generic barcode platform only. **No** inventory, rentals, sales, label printing, or scanner hardware implementations.

Future consumers (inventory, customers, orders, rentals, sales, labels, QR, hardware) bind opaque `entityType` + `entityId` via `activate()`.

## Model

Prisma `Barcode`:

| Field | Notes |
|-------|--------|
| id | UUID |
| code | Globally unique value (API exposes as `value`) |
| type | `code128` (default), `code39`, `ean13`, `ean8`, `upc_a`, `qr` |
| prefix | Sequence / namespace hint |
| status | `reserved` → `activated` → `reserved` (release) or `retired` |
| entityType / entityId | Opaque binding |
| reservedAt / activatedAt / retiredAt | Lifecycle timestamps |
| createdBy / updatedBy | Actors |

Indexes: unique(`code`), (`entityType`,`entityId`), `status`, `type`, `prefix`.

Lifetime uniqueness: soft-deleted and retired values are never recycled.

## Lifecycle

```
generate / reserve  → reserved
activate            → activated (+ entity)
release             → reserved (unbind; value stays unique)
retire              → retired (terminal; historically valid)
```

`activate` is **service-only** (no HTTP) so domains own assignment.

## Service API

`normalize` · `validate` · `exists` · `generate` · `reserve` · `activate` · `release` · `retire` · `find` / `findByValue` / `findMany`

Symbology validation: length, charset, GTIN checksum where applicable.

## HTTP (generic only)

| Method | Path | Permission |
|--------|------|------------|
| GET | /barcodes | barcode.view |
| GET | /barcodes/:id | barcode.view |
| POST | /barcodes/generate | barcode.generate |
| POST | /barcodes/validate | barcode.view |
| POST | /barcodes/reserve | barcode.reserve |
| POST | /barcodes/release | barcode.release |
| POST | /barcodes/retire | barcode.retire |

Search: exact / prefix (`q`), `status`, `type`, `entityType`, `entityId`.

## Audit

`generate`, `reserve`, `allocate` (activate), `release`, `retire`, `validate_failure`.

## Hardware (design only)

Ports in `src/barcode/hardware/scanner.ports.ts`: USB scanner, keyboard wedge, camera scanner, thermal label printer. No adapters yet.

## Coverage

```bash
pnpm test:cov:barcode
```

Gate: lines/statements ≥95%, branches ≥80%.

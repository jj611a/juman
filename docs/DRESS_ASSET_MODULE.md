# Dress Asset Module — Phase 1–5 (Asset + Barcode + Photos + Status + Search)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients, future Inventory phases  
**Status:** Implemented through Phase 5 (Search & Filtering)  
**Scope:** Serialized Dress master rows, barcode identity, gallery photos, status engine, searchable list API — no calendar, reservation, rental, availability, printing, or scanners

Related: [`DRESS_DOMAIN.md`](DRESS_DOMAIN.md), [`DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md), [`DATABASE_GUIDELINES.md`](DATABASE_GUIDELINES.md), [`API_STANDARDS.md`](API_STANDARDS.md).

---

## 1. Asset vs SKU

A **Dress** is one physical garment with its own identity, barcode, condition, and history — **not** a quantity SKU.

| Wrong (quantity product) | Correct (serialized asset) |
|---|---|
| SKU “Red M evening” → qty 12 | Dress A and Dress B are two rows even if identical |
| Stock decrement on rent | Only *this* dress is rented; calendar hangs off `dress_id` later |

Calendars, reservations, rentals, inspections, laundry, and sales will reference `dress_id` in later modules — and must change status **only** via `DressStatusService`.

---

## 2. Package & API

```text
app/modules/inventory/
  constants.py
  status_transitions.py    # ALLOWED_TRANSITIONS map
  models/dress.py
  models/dress_photo.py
  models/barcode_counter.py
  repositories/dress.py
  repositories/dress_photo.py
  repositories/barcode_counter.py
  services/dress.py
  services/dress_photo.py
  services/dress_status.py # Status Engine
  services/barcode.py
  schemas/dress.py
  schemas/dress_photo.py
  schemas/dress_status.py
  api/router.py            # /api/v1/dresses (+ /status)
  api/photos.py
  dependencies.py
  validators.py
```

| Method | Path | Permission / role |
|---|---|---|
| `GET` | `/dresses` | `inventory.view` (search / filter / sort / page) |
| `GET` | `/dresses/barcode/{barcode}` | `inventory.view` |
| `GET` | `/dresses/{id}` | `inventory.view` |
| `POST` | `/dresses` | `inventory.create` (status always `AVAILABLE`) |
| `PATCH` | `/dresses/{id}` | `inventory.update` (**no** `status` field) |
| `POST` | `/dresses/{id}/status` | `inventory.update` (Status Engine only) |
| `PATCH` | `/dresses/{id}/barcode` | **Admin role only** |
| `POST` | `/dresses/{id}/activate` | `inventory.update` |
| `POST` | `/dresses/{id}/deactivate` | `inventory.update` |
| `DELETE` | `/dresses/{id}` | `inventory.delete` |
| `GET` | `/dresses/{id}/photos` | `inventory.view` |
| `POST` | `/dresses/{id}/photos` | `inventory.update` |
| `PATCH` | `/dresses/{id}/photos/reorder` | `inventory.update` |
| `PATCH` | `/dresses/{id}/photos/cover` | `inventory.update` |
| `PATCH` | `/dress-photos/{photo_id}` | `inventory.update` |
| `DELETE` | `/dress-photos/{photo_id}` | `inventory.update` |

Fail-closed Bearer auth. Actor + IP → AuditService / audit columns.

---

## 3. Schema (`dresses`)

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `barcode` | **NOT NULL** `String(64)`; partial unique among live rows; lifetime uniqueness enforced in service |
| `category_id` | FK → `categories.id` **ON DELETE RESTRICT** |
| `name_ar` | Required |
| `name_en`, `brand`, `description` | Optional |
| `size`, `colour` | Uppercase allowlists |
| prices | `BigInteger` whole **IQD** ≥ 0 |
| `status` | Stored enum; create default `AVAILABLE`; **mutations only via Status Engine** |
| `is_active` | Soft business flag (orthogonal to status) |
| audit + soft delete | `AuditedSoftDeleteModel` |

Migrations: `20260726_0014_dresses`, `20260726_0015_dress_barcodes`, `20260726_0017_dress_photos`, `20260727_0018_dress_search`.

---

## 4. Barcode lifecycle

Unchanged from Phase 2: auto-generate / Admin override, lifetime uniqueness, no reuse after soft-delete. See earlier sections in git history / Phase 2 notes.

Settings: `inventory.barcode.prefix|separator|padding` → `DR-00000001`.

---

## 5. Category relationship

```text
Category ──1:N RESTRICT──► Dress
```

Soft-delete Category blocked when live dresses reference it.

---

## 6. Status Engine (Phase 4)

**Authority:** `DressStatusService` is the only writer of `Dress.status`.

Create always sets `AVAILABLE`. `POST`/`PATCH` dress bodies do **not** accept `status`.

### States (Phase 4 graph)

| Code | Kind |
|---|---|
| `AVAILABLE` | Operational |
| `RESERVED` | Operational |
| `RENTED` | Operational |
| `INSPECTION` | Operational |
| `PROCESSING` | Operational |
| `SOLD` | Terminal |
| `RUINED` | Terminal |

`RETURNED` remains in the `DressStatus` enum for schema continuity but is **not** in this transition graph (rejected). Fuller matrix with `RETURNED` lives in [`DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md) for a future Returns alignment.

### State diagram

```text
create ──► AVAILABLE ──► RESERVED ──► AVAILABLE
              │             │
              │             └──► RENTED
              ├──► RENTED ──► INSPECTION ──► PROCESSING ──► AVAILABLE
              │                    ├──► RUINED (terminal)
              │                    └──► SOLD (terminal)
              └──► SOLD (terminal)
```

### Transition table (allowed only)

| From | To |
|---|---|
| AVAILABLE | RESERVED, RENTED, SOLD |
| RESERVED | AVAILABLE, RENTED |
| RENTED | INSPECTION |
| INSPECTION | PROCESSING, RUINED, SOLD |
| PROCESSING | AVAILABLE |
| SOLD | _(none)_ |
| RUINED | _(none)_ |

Self-transitions and any other edge → Arabic `ValidationError` with `from` / `to` / `allowed` details.

### Service API

| Method | Role |
|---|---|
| `change_status(dress_id, new_status, reason=…)` | Validate + persist + audit |
| `validate_transition(from, to)` | Pure graph check |
| `get_allowed_transitions(dress_id)` | Next states for UI |
| `get_current_status(dress_id)` | Current code |

### HTTP

`POST /dresses/{id}/status`

```json
{ "new_status": "RENTED", "reason": "optional" }
```

Response data: `dress_id`, `previous_status`, `new_status`, `allowed_transitions`, `reason`.

### Future integration

Reservations / Rentals / Returns / Inspection / Laundry / Sales **must call** `DressStatusService.change_status`. They must never update the status column directly. The engine does not import those modules.

---

## 7. Size / Colour

Allowlists unchanged; unknown values → Arabic `ValidationError`.

---

## 8. Photo management (Phase 3)

Inventory never stores bytes. Photos are **references** from a dress to Media `StoredFile` rows.

Upload via Media → attach with `stored_file_id`. Soft-delete photo reference only. Cover uniqueness + gallery reorder. See Phase 3 rules in prior releases.

---

## 9. Search & filtering (Phase 5)

`GET /dresses` is the shared dress search API for Inventory and future modules. It does **not** compute availability or join reservations/rentals.

### Query parameters

| Param | Behavior |
|---|---|
| `q` | Case-insensitive partial match on barcode, name_ar, name_en, brand, description, category name_ar/name_en |
| `barcode` | Exact barcode match (when set, `q` does not also fuzzy-match barcode) |
| `category_id` | Exact UUID |
| `brand` | Partial case-insensitive |
| `size` / `colour` / `status` | Exact (validated allowlists / enum) |
| `is_active` | Optional bool |
| `purchase_price_min/max` | Inclusive IQD range |
| `rental_price_min/max` | Inclusive on `default_daily_rental_price` |
| `sale_price_min/max` | Inclusive on `default_sale_price` |
| `created_from/to`, `updated_from/to` | Inclusive UTC datetime bounds |
| `sort_by` | `barcode`, `name_ar`, `category`, `purchase_price`, `default_daily_rental_price`, `default_sale_price`, `created_at`, `updated_at` |
| `sort_dir` | `asc` \| `desc` (default `desc`) |
| `page` | 1-based (default 1) |
| `page_size` | 1–200 (default 50) |

Filters AND together with `q`. Invalid ranges / sort → Arabic `ValidationError`.

### Response meta

```json
{
  "success": true,
  "data": [ /* DressResponse */ ],
  "meta": { "page": 1, "page_size": 50, "total": 123, "pages": 3 }
}
```

`pages = ceil(total / page_size)` (0 when total is 0). No audit on reads.

### Indexes

Migration `20260727_0018_dress_search`: `updated_at`, price columns, `name_ar`, partial `(status, is_active)` where not deleted — plus existing filter indexes from Phase 1.

Composable builder: `DressRepository.build_search_stmt` → same WHERE for count and page; optional JOIN `categories` when `q` or sort by category. Stable order tie-break: `id`.

---

## 10. Audit

`module="inventory"`.

| Entity | Actions |
|---|---|
| `Dress` | CREATE / UPDATE / ACTIVATE / DEACTIVATE / SOFT_DELETE, `barcode_*`, `cover_changed`, `gallery_reordered`, **`status_changed`** |
| `DressPhoto` | `photo_added`, `photo_removed`, UPDATE |

`status_changed`: `old_values` / `new_values` hold previous/new status; optional `metadata.reason`.

---

## 11. Explicit non-goals

- Calendar / availability calculations  
- Reservations, rentals, returns, inspection, laundry, sales (callers of the status engine — not implemented here)  
- Status history table  
- Multipart upload inside Inventory; deleting Media blobs from dress photo APIs  
- Image editing, compression, AI  
- Barcode images, label printing, scanner hardware integration  
- Full-text search extensions (Postgres FTS / trigram) — ILIKE is the Phase 5 strategy  

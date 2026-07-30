# Processing Module — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients  
**Status:** Implemented (v1 laundry / readiness workflow)  
**Scope:** Manage dresses after inspection through mandatory/optional processing days — no payments, sales, or settlement

Related: [`INSPECTION.md`](INSPECTION.md), [`CALENDAR_ENGINE.md`](CALENDAR_ENGINE.md), [`DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md), [`RETURNS.md`](RETURNS.md).

---

## 1. Purpose

Processing (Laundry) consumes dresses already moved to `PROCESSING` by Inspection:

- Scaffold a batch from completed laundry-bound inspection items
- Start processing: create `PROCESSING` calendar blocks; truncate related open `RENTAL` blocks to abut
- Optional second day at start or later
- Complete after mandatory period → Status Engine `PROCESSING → AVAILABLE`

Inspection decides condition. Processing does not decide penalties, forced purchase, or settlement.

---

## 2. Domain boundaries

| Owns | Does not own |
|---|---|
| Work-order lifecycle | Damage penalties |
| Calendar `PROCESSING` blocks | Forced purchase / Sales |
| Exit to `AVAILABLE` | Rental payment settlement |
| Related RENTAL block truncate on start | Late fees |

Severe damage (`MAJOR_DAMAGE` / `RUINED_PENDING_SALE`) is rejected — Inspection already routes those away from laundry.

---

## 3. Data model

### `processing_batches`

`processing_number` (`PRC-########`), `status`, `started_at`, `mandatory_processing_end_at`, `optional_extra_day_enabled`, `final_processing_end_at`, `completed_at`, `started_by`, `completed_by`, `notes`, audit + soft delete.

### `processing_items`

`dress_id`, `inspection_item_id`, `return_item_id`, `rental_item_id`, `calendar_block_id`, `status`, `notes`.

Unique among active (`PENDING`/`IN_PROCESS`): one row per dress and per inspection item.

Migration: `20260728_0025_processing`.  
Settings: `processing.number.prefix/separator/padding` (`PRC`/`-`/`8`); durations via existing `mandatory_processing_days` / `optional_processing_days`.

---

## 4. Lifecycle

```text
[*] ──POST──► PENDING ──POST /start──► IN_PROCESS ──POST /complete──► COMPLETED
                    │                      │
                    │                      ├── POST /add-optional-day
                    └── PATCH notes        └── PATCH notes
```

`CANCELLED` is reserved; no cancel API in v1.

**Handoff:** Inspection may leave dresses in `PROCESSING` before a batch exists. Laundry creates then starts promptly.

---

## 5. Day calculation

On start (`started_at = utc_now()`):

```text
mandatory_end = started_at + timedelta(days=mandatory_processing_days)
final_end     = mandatory_end + optional_days  if optional enabled else mandatory_end
```

UTC via `ensure_utc`. Zero-length windows use a 1-second calendar sentinel so Calendar Engine intervals remain valid. Complete requires `now >= mandatory_processing_end_at` (no silent early override).

---

## 6. Calendar integration

On **start** (per item):

1. Truncate related open `RENTAL` block (`rental_item.calendar_block_id`) to `started_at` (or remove if block starts at/after start).
2. `create_block(PROCESSING, start=started_at, end=final_end, reference_module="processing")`.

On **add-optional-day:** `move_block` end → new final.  
On **complete:** `remove_block` PROCESSING blocks.

Availability is never computed outside `CalendarService`.

---

## 7. Status Engine

| Event | Action |
|---|---|
| Create / Start | Assert dress is already `PROCESSING` (Inspection entry) |
| Complete | `change_status(..., AVAILABLE)` |

---

## 8. API

Mount `/api/v1/processing`.

| Method | Path | Perm |
|---|---|---|
| POST | `/processing` | `processing.create` |
| GET | `/processing` | `processing.view` |
| GET | `/processing/{id}` | `processing.view` |
| PATCH | `/processing/{id}` | `processing.update` |
| POST | `/processing/{id}/start` | `processing.create` |
| POST | `/processing/{id}/add-optional-day` | `processing.update` |
| POST | `/processing/{id}/complete` | `processing.complete` |

Permissions already seeded for Laundry + Admin. Start maps to `processing.create` (no separate `processing.start` key).

---

## 9. Transaction / rollback

Create, start, add-optional-day, and complete each run in one request session. Failures after calendar/status writes roll back the whole unit of work.

---

## 10. Explicit non-goals

Payments, settlement, late fees, Sales/forced purchase, cancel workflow, reports, notifications, changing Inspection behavior.

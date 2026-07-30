# Calendar Engine — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients, future Reservations/Rentals/Laundry  
**Status:** Implemented  
**Scope:** Dress availability timelines and conflict detection only — no reservations, rentals, status, or pricing

Related: [`DRESS_DOMAIN.md`](DRESS_DOMAIN.md), [`DRESS_ASSET_MODULE.md`](DRESS_ASSET_MODULE.md), [`API_STANDARDS.md`](API_STANDARDS.md).

---

## 1. Purpose

The Calendar Engine is the **single source of truth for dress scheduling busy intervals**.

Future modules (Reservations, Rentals, Returns, Laundry, Sales) **consume** this engine. They do not invent their own overlap rules.

The engine:

- Does **not** change dress status  
- Does **not** calculate prices or penalties  
- Does **not** know reservation/rental documents beyond opaque `reference_module` / `reference_id`

---

## 2. Timeline model

Each dress has a timeline of **`DressCalendarBlock`** rows.

| Field | Meaning |
|---|---|
| `dress_id` | FK → live dress |
| `block_type` | `RESERVATION` \| `RENTAL` \| `PROCESSING` \| `MAINTENANCE` |
| `start_at` / `end_at` | UTC timezone-aware; require `end_at > start_at` |
| `reference_module` / `reference_id` | Optional opaque link to a future document |
| `notes` | Optional |

Soft-deleted blocks leave the timeline. Soft-deleted dresses cannot be scheduled (`NotFoundError`).

### Block types

All types participate equally in conflict detection. Processing blocks block reservations the same way rentals do.

---

## 3. Conflict algorithm

```text
overlap(A, B) := A.start_at < B.end_at AND A.end_at > B.start_at
```

- **Abutting allowed:** `A.end_at == B.start_at` is not a conflict (rental → processing chain).  
- Create / move reject with `ConflictError` and structured `details.conflicts[]`.

Conflict item fields: `block_id`, `block_type`, `start_at`, `end_at`, `reference_module`, `reference_id`, `conflict_kind` (`overlap`).

---

## 4. Availability algorithm

| API / method | Behavior |
|---|---|
| `is_available(dress, start, end)` | True iff no overlapping live blocks |
| `get_timeline(dress, from?, to?)` | Ordered live blocks; optional intersection window |
| `next_available_date(dress, after, duration)` | Earliest `t >= after` with free `[t, t+duration)`; walks gaps after busy blocks |

Availability uses **only** calendar blocks — never dress status.

---

## 5. HTTP API

Permission keys (already seeded): `calendar.view`, `calendar.manage`.

| Method | Path | Perm |
|---|---|---|
| `GET` | `/api/v1/calendar/dress/{dress_id}` | view — timeline (`from` / `to` optional) |
| `GET` | `/api/v1/calendar/dress/{dress_id}/availability` | view — `start_at`, `end_at` → `{ available }` |
| `GET` | `/api/v1/calendar/dress/{dress_id}/availability/next` | view — `after`, `duration_seconds` |
| `GET` | `/api/v1/calendar/dress/{dress_id}/conflicts` | view — conflict list |
| `POST` | `/api/v1/calendar/block` | manage |
| `PATCH` | `/api/v1/calendar/block/{id}` | manage — move / notes / type |
| `DELETE` | `/api/v1/calendar/block/{id}` | manage — soft-delete |

Audit: `module="calendar"`, `entity_type="DressCalendarBlock"`, actions CREATE / UPDATE / SOFT_DELETE.

Migration: `20260727_0019_calendar`.

---

## 6. Future integrations

| Module | Integration |
|---|---|
| Reservations | `create_block(RESERVATION)` on confirm; `remove_block` on cancel; `is_available` before confirm |
| Rentals | `RENTAL` out-window; may abut `PROCESSING` |
| Returns / Laundry | `PROCESSING` for mandatory/optional days — see [`PROCESSING.md`](PROCESSING.md) |
| Sales | Check near-term availability; status retirement remains Status Engine |
| Status Engine | Orthogonal — callers update status **and** calendar separately |

---

## 7. Explicit non-goals

Reservations/Rentals modules, dress status transitions, pricing, GiST exclusion constraints, multi-dress store calendar views (compose from per-dress timelines later).

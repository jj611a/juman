# Dress Domain — Juman (جمان)

**Document type:** Business domain design (source of truth)  
**Audience:** Backend and Electron implementers, product owners, future maintainers  
**Status:** Approved conceptual model for Inventory and all dress-touching modules  
**Scope:** What a Dress is, how it lives, who owns each concern, and why uniqueness is non-negotiable  

This document defines the **dress domain**. It does not prescribe table schemas, API paths, or code. Implementation must follow the Project Constitution (Clean Architecture, DDD, UUID/audit/soft-delete, Arabic UI, English codes) and align with Settings such as `barcode_prefix` and `barcode_length`.

---

## 1. Core Premise

### 1.1 A Dress is not a product

In retail e-commerce and many POS systems, a “product” is a **catalog SKU** with a quantity on hand:

```text
SKU “Evening Gown Red M” → quantity = 12
```

That model is **wrong for Juman**.

In Juman, a **Dress** is a **serialized physical asset**: one real garment in the store, with its own identity, barcode, condition, calendar, and history.

```text
Dress #A7F3… (barcode JM-000184) → this exact gown on this hanger
Dress #B91C… (barcode JM-000185) → another gown that may look identical
```

Two dresses that share color, size, designer, and photo are still **two assets**. They must never share stock quantity, availability, or damage history.

### 1.2 Why every dress is a unique asset

| Reason | Business consequence if treated as a quantity product |
|---|---|
| **Physical uniqueness** | Beads, alterations, stains, and wear differ per gown |
| **Rental calendar** | Only *this* dress can be reserved for a wedding date; “one of twelve” is meaningless |
| **Barcode operations** | Staff scan a label on a hanger, not a category |
| **Damage & liability** | Customer A damaged dress X; customer B must not inherit that history |
| **Inspection & laundry** | Processing applies to one returned garment at a time |
| **Sale vs rental** | Selling one unit must remove *that* asset from the rental pool forever |
| **Pricing nuance** | Two “same style” dresses may have different rental rates after wear or repair |
| **Audit & disputes** | Courts, owners, and customers argue about a specific dress, not an SKU count |
| **Partial availability** | One red M may be in laundry while another red M is rentable — quantity math lies |
| **Loss / write-off** | Theft or destruction retires one asset; siblings remain |

**Domain law:** If two garments cannot be swapped without changing calendar, condition, or liability, they are separate Dresses.

---

## 2. Domain Language

| Term | Meaning |
|---|---|
| **Dress** | One serialized physical garment asset managed by Juman |
| **Catalog attributes** | Shared descriptive fields (category, color, size, style) — *not* identity |
| **Barcode** | Unique scannable identifier physically attached to the dress |
| **Availability** | Whether *this* asset can be reserved/rented/sold *now* given its state and calendar |
| **Reservation** | Hold of a dress for a future period (calendar commitment) |
| **Rental** | Active or historical lease of a specific dress to a customer |
| **Sale** | Transfer of ownership of a specific dress out of inventory |
| **Inspection** | Structured assessment of a dress’s condition (typically after return) |
| **Laundry / Processing** | Cleaning and preparation workflow for a specific dress |
| **Damage** | Recorded harm to a specific dress, often tied to a rental/return/inspection |
| **Product (forbidden sense)** | Quantity-based SKU stock — **not used as the dress model** |

Categories and styles may exist as **classification**, never as fungible stock for dresses.

---

## 3. Ownership of Concerns

Juman separates **who owns the truth** for each concern. The Dress asset is the hub; other modules hang timelines and documents off that hub.

```text
                         ┌─────────────────┐
                         │  Dress (Asset)  │
                         │  identity hub   │
                         └────────┬────────┘
          ┌──────────────┬────────┼────────┬──────────────┬────────────┐
          ▼              ▼        ▼        ▼              ▼            ▼
     Inventory      Calendar   Rental    Sale      Inspection     Laundry
     (master)      (time)     (lease)  (exit)     (condition)   (process)
                          │
                          ▼
                       Damage
                     (liability)
```

### 3.1 Inventory ownership (Dress master)

**Owner module:** Inventory (Dresses)

Owns:

- Creating and retiring the dress asset  
- Master descriptive data (name, category, size, color, notes, photos metadata)  
- Barcode assignment and label reprint policy  
- Commercial flags (for rent, for sale, list prices — subject to Settings overrides elsewhere)  
- Soft delete / archive of the asset record  
- Current **canonical status** of the dress (see §5)

Does **not** own: reservation date math, payment totals, laundry work queues (those reference the dress).

### 3.2 Calendar ownership

**Owner module:** Calendar (with Reservations as the booking document)

Owns:

- Time-bounded **busy intervals** for a dress (reserved, rented-out windows, blocked maintenance if modeled on calendar)  
- Conflict detection: “Can dress X be promised for date range Y?”  
- Store-wide calendar views that project per-dress commitments  

**Rule:** Availability for a future date is answered by **Calendar + Dress status**, not by counting SKUs.

The calendar never creates a new dress; it only schedules an existing asset.

### 3.3 Rental ownership

**Owner module:** Rentals (with Returns as the closing workflow)

Owns:

- Rental contract / order for **specific dress id(s)**  
- Customer party, rental period, pricing, deposit linkage  
- Handover and return events  
- Which dress is currently out on which rental  

**Rule:** A rental line item points to a **Dress asset id**, never to “any dress of style Z.”

While rented, the dress’s operational status reflects “out,” and the calendar shows the occupied interval.

### 3.4 Sale ownership

**Owner module:** Sales

Owns:

- Sale invoice that transfers **this dress** out of rentable/sellable stock  
- Sale price, payment linkage, customer (if any)  
- Terminal commercial exit of the asset from the rental fleet  

**Rule:** Selling a dress **retires it from the rental calendar permanently** (status becomes sold / disposed commercially). It must not remain bookable.

### 3.5 Damage ownership

**Owner module:** Damage records (typically created from Inspection / Returns; may live under Inspection or a dedicated concern)

Owns:

- Description, severity, photos metadata, charge decision  
- Link to the **dress** and usually to the **rental/return/inspection** that discovered it  
- Financial consequence pointers (extra charge on payment) without owning the payment ledger itself  

**Rule:** Damage is always about one asset. “Style-level damage” does not exist.

### 3.6 Inspection ownership

**Owner module:** Inspection

Owns:

- Checklists and outcomes for a dress at a point in time (especially post-return)  
- Pass / fail / needs repair / needs laundry recommendations  
- Gate that allows or blocks the dress from returning to rentable status  

**Rule:** Inspection concludes condition for **this** dress; it may trigger laundry, damage, or hold states, but Inventory remains the home of the dress’s current status field.

### 3.7 Laundry ownership

**Owner module:** Laundry / Processing

Owns:

- Work orders for cleaning/pressing/repair prep of a specific dress  
- Queue, assignee (staff), started/finished times  
- Mandatory vs optional processing windows (informed by Settings such as processing-day policies)  

**Rule:** Laundry occupies the asset operationally (often blocking rental) until processing completes and status returns to an available state via Inventory/status engine rules.

---

## 4. Lifecycle

A dress moves through a **long-lived asset lifecycle**. Documents (reservations, rentals, sales) are **episodes**; the dress remains.

### 4.1 High-level stages

```text
[Intake]
   → Registered in Inventory (barcode assigned)
   → Optional initial inspection / prep
   → Available for rent and/or sale

[Active fleet]
   → Reserved (future hold)
   → Rented out
   → Returned
   → Inspected
   → Laundry / processing (as needed)
   → Available again
   → (repeat)

[Exit]
   → Sold
   OR Written off / lost / retired
   OR Soft-deleted from operational lists (history retained)
```

### 4.2 Lifecycle narrative

1. **Intake** — Staff create a Dress asset with attributes and a unique barcode; label is printed and attached.  
2. **Ready** — After any intake prep, the dress is available according to its commercial flags and status.  
3. **Reservation** — Calendar holds the dress for a customer/date; asset is not yet physically out (unless policy says otherwise).  
4. **Rental handover** — Dress leaves the store with the customer; status reflects out-on-rent; calendar interval is active.  
5. **Return** — Dress re-enters the store under a return workflow.  
6. **Inspection** — Condition assessed; damage may be recorded; laundry may be required.  
7. **Laundry / processing** — Asset is in process; generally not rentable.  
8. **Return to fleet** — Status becomes available again; future calendar bookings remain enforceable.  
9. **Sale (alternate path)** — At any allowed status, a sale may remove the dress from the fleet.  
10. **Retirement** — Loss, destruction, or permanent retirement ends commercial use; history remains for audit.

### 4.3 Episodes vs asset

| Concept | Lifetime | Example |
|---|---|---|
| Dress asset | Years | Barcode JM-000184 |
| Reservation | Days–weeks before event | Hold for 2026-09-12 |
| Rental | Days | Out 2026-09-11 → due 2026-09-13 |
| Inspection | Minutes–hours | Post-return checklist |
| Laundry job | Hours–days | Clean + press |
| Sale | Instant commercial exit | Sold 2026-10-01 |
| Damage record | Permanent history | Tear on hem, charged |

Deleting a rental must not delete the dress. Soft-deleting a dress must not erase historical rentals/sales (they keep the dress UUID).

---

## 5. States

Status is a **single operational truth** on the dress (Inventory / Dress Status Engine), changed only by allowed transitions from owning workflows.

Exact enum names are an implementation detail; the **meanings** below are normative.

### 5.1 Recommended state meanings

| State (conceptual) | Meaning | Typically rentable? | Typically sellable? |
|---|---|---|---|
| **Draft / Intake** | Being registered; not released to floor | No | No |
| **Available** | In store, ready for reservation/rent/sale per flags | Yes | If flagged for sale |
| **Reserved** | Committed on calendar for a future period (optional distinct state vs Available+calendar) | No for overlapping dates | Policy-dependent |
| **Rented** | Physically out with customer | No | No |
| **Returned** | Back in store; awaiting inspection | No | No |
| **Inspection** | Under inspection | No | No |
| **Laundry / Processing** | Being cleaned or prepared | No | No |
| **On hold / Blocked** | Manual or system block (repair, dispute, missing accessory) | No | No |
| **Sold** | Ownership transferred; left inventory commercially | No | No (already sold) |
| **Retired / Written off** | Lost, destroyed, or permanently removed from service | No | No |
| **Inactive** | Soft operational disable without full retirement | No | No |

Stores may collapse “Returned / Inspection / Laundry” into fewer UI statuses if the status engine still records sub-phase via related documents — but **availability must remain correct**.

### 5.2 Transition ownership

| From → To (examples) | Triggered by |
|---|---|
| Intake → Available | Inventory completes registration (+ optional intake inspection) |
| Available → Reserved | Reservation confirmed (Calendar) |
| Reserved → Rented | Rental handover |
| Available → Rented | Walk-in rental without prior reservation (if allowed) |
| Rented → Returned | Return workflow |
| Returned → Inspection | Inspection started |
| Inspection → Laundry | Inspection requires processing |
| Inspection → Available | Passed clean; no laundry needed |
| Laundry → Available | Processing completed |
| Any allowed → Sold | Sale completed |
| Any allowed → Retired | Write-off / loss |
| * → On hold | Admin/Inventory block |
| Available ⇄ Inactive | Admin deactivate / reactivate |

**Illegal examples:** Sold → Available; Rented → Available without return; Soft-deleted dress accepting new rentals.

### 5.3 Status vs calendar

- **Status** answers: what is the dress doing *as an asset right now*?  
- **Calendar** answers: is the dress promised for *interval T*?  

Both are required. A dress can be **Available** today and **fully booked** next Friday.

---

## 6. Barcode Rules

Barcodes identify **one physical dress**. They are operational handles for scanners and labels.

### 6.1 Uniqueness

| Rule | Default |
|---|---|
| One barcode per dress | Required |
| One dress per barcode | Required |
| Uniqueness scope | Store-wide among active (non-deleted) dresses |
| Soft-delete interaction | Prefer **partial unique** on barcode where not deleted, so a retired label code can be reused only under explicit policy — default recommendation: **do not reuse** barcodes of sold/retired dresses to avoid historical confusion |

### 6.2 Generation and format

Aligned with existing Settings:

| Setting | Role |
|---|---|
| `barcode_prefix` | Leading namespace for generated codes (store/brand) |
| `barcode_length` | Total or body length policy for generated values |

| Rule | Default |
|---|---|
| Generation | System-generated on create (primary path) |
| Manual entry | Optional Admin/Inventory override only if uniqueness validated |
| Print | Label printable at create and on reprint |
| Scan | All dress-touching POS flows should resolve dress by barcode scan |

### 6.3 Operational rules

1. Changing a barcode is a **controlled Inventory action** (damaged label) — log who/when; old code should not resolve to another live dress.  
2. Barcodes are never recycled onto a **different** live dress while history still matters for the old asset.  
3. Reports and receipts may show barcode as the human-facing asset id alongside internal UUID.  
4. Categories do not have barcodes; **dresses do**.

---

## 7. Commercial Dual Use (Rent and Sale)

A single dress asset may be:

- Rentable only  
- Sellable only  
- Both (until one path consumes it)

| Event | Effect on asset |
|---|---|
| Active rental / reservation | Sale of that dress is blocked for conflicting periods (or entirely while out) |
| Completed sale | Dress leaves rental fleet; calendar future bookings must be prevented beforehand |
| Rental history | Remains after sale for audit; asset status is Sold |

**Never** represent “3 for rent, 2 for sale” as quantities of one SKU. Represent five dress assets with individual flags and states.

---

## 8. Cross-Module Invariants

These invariants protect the domain regardless of module order of implementation:

1. **Every rental, reservation, inspection, laundry job, damage record, and sale line references a Dress UUID.**  
2. **No module may invent stock quantity for dresses.**  
3. **Calendar conflicts are per dress id + time range.**  
4. **Only Inventory (status engine) publishes the dress’s current status;** other modules request transitions through domain services/rules.  
5. **Payments reference commercial documents (rental/sale/damage charge), not the dress directly** — but charges always trace to an asset.  
6. **Soft delete of a dress blocks new activity;** historical documents remain.  
7. **Identity users act on dresses;** customers are parties on reservations/rentals/sales, not owners of the dress record (store owns the asset until sold).

---

## 9. Customer vs Store Ownership

| Party | Relationship to dress |
|---|---|
| **Store** | Legal/commercial owner of the asset until sold |
| **Customer (renter)** | Temporary custodian during rental; liable for damage per policy |
| **Customer (buyer)** | Becomes owner after completed sale |
| **Staff user** | Operator who scans, inspects, and transitions state — not the asset owner |

Custody (who physically holds it) ≠ commercial ownership (whose asset it is).

---

## 10. Why This Model Scales to Future Modules

| Future module | Relies on unique dress assets because… |
|---|---|
| Reservations | Books a specific gown for a date |
| Rentals / Returns | Hands out and receives a specific barcode |
| Inspection | Scores condition of one garment |
| Laundry | Queues one garment |
| Sales | Sells one garment |
| Payments | Charges deposits/fees tied to that garment’s documents |
| Reports | Utilization, damage rate, revenue per asset |
| Notifications | “Dress JM-000184 due back today” |

If dresses were quantities, calendar conflict detection, damage liability, and laundry queues would all require a redesign. Treating dresses as assets from day one **avoids that redesign**.

---

## 11. Non-Goals

- Fashion e-commerce variant/SKU inventory as the primary dress model  
- Fungible “grab any size M” fulfillment  
- Warehouse bin quantity for dresses (accessories/supplies may use quantity models later — **not dresses**)  
- Customer-owned dress tracking as inventory (alterations-for-hire may be a future separate concept)

---

## 12. Acceptance Criteria (for future Inventory & related modules)

Domain implementation is correct only when:

1. Creating inventory creates **one asset row per physical dress**, not a quantity field for dresses.  
2. Each dress has a **unique barcode** usable by scanner flows.  
3. Two visually identical dresses can have different states, calendars, and damage histories.  
4. Reservations/rentals/sales/inspections/laundry reference dress ids.  
5. Selling a dress prevents further rental booking of that asset.  
6. Soft-deleted dresses retain historical document links.  
7. Availability answers combine **status + calendar**, never SKU count.

---

## 13. Document Control

| Item | Value |
|---|---|
| Path | `docs/DRESS_DOMAIN.md` |
| Owner | Juman architecture |
| Related | `docs/IDENTITY_RULES.md`, Settings (`barcode_*`), RBAC inventory/rental/inspection/sale/calendar permissions, Project Constitution |
| Next engineering steps | Inventory / Dress Status Engine modules when explicitly requested — implement against this document |

Changes to the asset premise (e.g. introducing quantity-based dresses) require an explicit architecture decision and are presumed **rejected** unless this document is revised first.

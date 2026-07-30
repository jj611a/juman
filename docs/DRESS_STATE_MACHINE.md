# Dress State Machine — Juman (جمان)

**Document type:** Domain state-machine design (source of truth)  
**Audience:** Backend and Electron implementers, QA, future maintainers  
**Status:** Approved canonical states for the Dress Status Engine  
**Depends on:** [`docs/DRESS_DOMAIN.md`](DRESS_DOMAIN.md)  
**Scope:** Exact states, allowed/forbidden transitions, rules, events, and side effects  

This document defines **how a Dress moves between states**. It does not implement code, schemas, or APIs. The Dress Status Engine (future module) must enforce these rules server-side. UI may hide illegal actions; the backend remains the authority.

---

## 1. Design Laws

1. **One canonical status** per dress at any time.  
2. **Transitions are explicit** — no silent status changes.  
3. **Documents trigger transitions** — reservations, rentals, returns, inspections, laundry jobs, sales, and write-offs request transitions; the status engine accepts or rejects.  
4. **Terminal states do not return to the fleet** without a formal, rare reopen policy (default: forbidden).  
5. **Calendar and status both matter** — status is “what the asset is doing now”; calendar is “what intervals are promised.”  
6. **Fail closed** — unknown or illegal transition → reject; leave status unchanged.  
7. **English state codes; Arabic UI labels** (constitution).  

---

## 2. Canonical States

| Code | Arabic label (UI) | Kind | Rentable now? | Sellable now? |
|---|---|---|---|---|
| `AVAILABLE` | متاح | Operational | Yes (if flagged for rent + calendar free) | Yes (if flagged for sale) |
| `RESERVED` | محجوز | Operational | No (held for reservation) | Only if reservation cancelled / policy allows |
| `RENTED` | مؤجّر | Operational | No | No |
| `RETURNED` | مُرجَع | Operational | No | No |
| `INSPECTION` | قيد الفحص | Operational | No | No |
| `PROCESSING` | قيد المعالجة | Operational | No | No |
| `SOLD` | مباع | **Terminal** | No | No |
| `RUINED` | تالف / خارج الخدمة | **Terminal** | No | No |

`AVAILABLE` appears twice in the business journey (entry to fleet and return after processing). It is **one state**, re-entered via allowed transitions — not two different statuses.

### 2.1 State meanings

| State | Meaning |
|---|---|
| **AVAILABLE** | In store, cleared for commercial use. May accept new reservations, walk-in rentals, or sale per flags and calendar. |
| **RESERVED** | Committed to a confirmed reservation. Physically still in store (unless a future “pre-pull” policy says otherwise). Not available for overlapping bookings or conflicting rentals. |
| **RENTED** | Physically out with the customer under an active rental. |
| **RETURNED** | Physically back in store after rental; not yet cleared by inspection. |
| **INSPECTION** | Under formal condition assessment. |
| **PROCESSING** | In laundry / cleaning / preparation (and light repair prep as defined by Laundry). |
| **SOLD** | Commercial ownership transferred; permanently left the rental fleet. |
| **RUINED** | Permanently unfit for rent or sale (destroyed, irreparable, written off). History retained. |

### 2.2 Out of scope as canonical status (v1)

| Concern | Handling |
|---|---|
| Soft-deleted | Orthogonal flag (`is_deleted`); deleted dresses accept **no** transitions |
| Inactive / manually blocked | Future extension `ON_HOLD` (see §11) — until then use Admin block via forbidden new bookings + notes, or map to temporary policy |
| Draft intake | Dress is created already `AVAILABLE`, or created then immediately transitioned to `AVAILABLE` after intake checklist — implementers must pick one path and keep it consistent (recommended: create → `AVAILABLE`) |

---

## 3. State Diagram

```text
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
               AVAILABLE ──────────────────────────────► SOLD      │
                  │  ▲                                   ▲         │
                  │  │                                   │         │
                  │  │         (sale from AVAILABLE)     │         │
                  │  │                                   │         │
     reserve      │  │ release / cancel reservation      │         │
                  ▼  │                                   │         │
               RESERVED ─────────────────────────────────┘         │
                  │                                                │
     handover     │                                                │
                  ▼                                                │
                RENTED                                             │
                  │                                                │
     return       │                                                │
                  ▼                                                │
              RETURNED                                             │
                  │                                                │
     start        │                                                │
     inspection   ▼                                                │
             INSPECTION ───────────────────────────────► RUINED    │
                  │         ▲                              ▲       │
                  │         │                              │       │
     needs        │         │ re-inspect (optional)        │       │
     processing   ▼         │                              │       │
             PROCESSING ────┘──────────────────────────────┘       │
                  │                                                │
     complete     │                                                │
     processing   └────────────────────────────────────────────────┘
                         (back to AVAILABLE)

Walk-in rental:     AVAILABLE ──handover──► RENTED
Skip processing:    INSPECTION ──pass──► AVAILABLE
Major damage:       INSPECTION ──► RUINED_PENDING_SALE ──(Sales)──► SOLD | RUINED
Terminal write-off: AVAILABLE | RESERVED* | RETURNED | PROCESSING | RUINED_PENDING_SALE ──► RUINED
                    (*only after reservation handled — see rules)
```

---

## 4. Global Transition Matrix

Legend: **Y** = allowed · **N** = forbidden · **C** = conditional (see state sections)

| From \ To | AVAILABLE | RESERVED | RENTED | RETURNED | INSPECTION | PROCESSING | SOLD | RUINED | RUINED_PENDING_SALE |
|---|---|---|---|---|---|---|---|---|---|
| AVAILABLE | N | Y | Y | N | C¹ | C¹ | Y | Y | N |
| RESERVED | Y | N | Y | N | N | N | C² | C³ | N |
| RENTED | N | N | N | Y | N | N | N | C⁴ | N |
| RETURNED | N | N | N | N | Y | N | N | Y | N |
| INSPECTION | Y | N | N | N | N | Y | N | N | Y |
| PROCESSING | Y | N | N | N | C⁵ | N | N | Y | N |
| SOLD | N | N | N | N | N | N | N | N | N |
| RUINED | N | N | N | N | N | N | N | N | N |
| RUINED_PENDING_SALE | N | N | N | N | N | N | Y | Y | N |

¹ Intake or exceptional re-open of inspection/processing from AVAILABLE — **not** the normal post-rental path; default **forbidden** unless Admin “send to inspection/processing” policy is enabled.  
² Sale from RESERVED only after reservation is cancelled or explicitly superseded by sale policy.  
³ Ruin from RESERVED only after reservation is cancelled/failed and asset is written off.  
⁴ Ruin while RENTED only for confirmed total loss (theft/destruction while out) with rental closed or specially settled — exceptional.  
⁵ Re-inspection from PROCESSING if quality check fails mid-process — optional extension; default may allow PROCESSING → INSPECTION.

**Self-transitions** (same state → same state) are forbidden as status changes. Idempotent “no-op” API calls may return success without emitting a transition event.

---

## 5. Per-State Specification

---

### 5.1 AVAILABLE

**Definition:** Dress is in the fleet and clear for commercial decisions subject to calendar and flags.

#### Allowed transitions

| To | Triggering business event | Typical actor module |
|---|---|---|
| `RESERVED` | Reservation confirmed for this dress | Reservations / Calendar |
| `RENTED` | Walk-in (or same-day) rental handover without prior reservation | Rentals |
| `SOLD` | Sale completed for this dress | Sales |
| `RUINED` | Write-off / irreparable damage while in store | Inventory / Inspection |
| `INSPECTION` | Admin/Inventory “send to inspection” (optional policy) | Inspection |
| `PROCESSING` | Admin/Inventory “send to processing” (optional policy) | Laundry |

#### Forbidden transitions

| To | Why forbidden |
|---|---|
| `RETURNED` | Return implies a prior `RENTED` episode |
| `AVAILABLE` | Already available; not a transition |
| Direct skip to terminal without sale/ruin event | Must go through `SOLD` or `RUINED` explicitly |

#### Business rules

1. `for_rent` / `for_sale` flags gate which commercial transitions are offered.  
2. Confirming a reservation that overlaps an existing calendar busy interval is rejected **before** status change.  
3. Walk-in `AVAILABLE → RENTED` must create/activate a rental document and calendar busy interval.  
4. Soft-deleted or inactive dresses cannot be `AVAILABLE` for new transitions.  
5. Future bookings may already exist on the calendar while status is `AVAILABLE` (status ≠ “free on every future day”).  

#### Events (recommended codes)

| Event | When |
|---|---|
| `dress.created` | Asset created and enters `AVAILABLE` |
| `dress.status.changed` | Any accepted transition (include `from`, `to`) |
| `dress.reserved` | Transition to `RESERVED` |
| `dress.rental.started` | Transition to `RENTED` |
| `dress.sold` | Transition to `SOLD` |
| `dress.ruined` | Transition to `RUINED` |

#### Side effects

| Transition | Side effects |
|---|---|
| → `RESERVED` | Create/confirm calendar hold; bind reservation ↔ dress |
| → `RENTED` | Open rental custody; mark calendar interval active/out |
| → `SOLD` | Complete sale document; cancel future reservations for this dress (must be cleared first or rejected); revoke rentability |
| → `RUINED` | Cancel future reservations; close open commercial offers; keep history |

#### Future extensibility

- Sub-status “on rack” vs “in storage” without new canonical codes.  
- `ON_HOLD` fork from `AVAILABLE` for disputes.  
- Multi-branch transfer states later.

---

### 5.2 RESERVED

**Definition:** Dress is promised to a reservation; still typically physically in store.

#### Allowed transitions

| To | Triggering business event | Typical actor module |
|---|---|---|
| `AVAILABLE` | Reservation cancelled, expired, or released | Reservations |
| `RENTED` | Handover for the reservation’s rental | Rentals |
| `SOLD` | Conditional — reservation cancelled/superseded, then sale | Sales |
| `RUINED` | Conditional — after releasing reservation, write-off | Inventory |

#### Forbidden transitions

| To | Why forbidden |
|---|---|
| `RETURNED` | Never rented out |
| `INSPECTION` / `PROCESSING` | Not on the reservation happy path; cancel to `AVAILABLE` first, then optional send-to-process |
| `RESERVED` | No re-entry; modify reservation document instead |
| Overlapping second reservation while still `RESERVED` for conflicting dates | Calendar + status reject |

#### Business rules

1. Exactly one **primary active reservation** drives `RESERVED` status (additional waitlist is a future feature — must not create a second status).  
2. Cancelling the reservation returns status to `AVAILABLE` only if no other reason keeps it unavailable.  
3. Handover `RESERVED → RENTED` must reference the reservation (or its converted rental).  
4. Selling a reserved dress requires resolving the customer commitment first (cancel with policy / forfeit / transfer — product policy). Default: **block sale until reservation cancelled**.  
5. No-show policy may auto-release `RESERVED → AVAILABLE` after a configured grace window (Settings — future).  

#### Events

| Event | When |
|---|---|
| `dress.reservation.cancelled` | → `AVAILABLE` via cancel |
| `dress.reservation.released` | → `AVAILABLE` via expiry/no-show |
| `dress.rental.started` | → `RENTED` |
| `dress.sold` / `dress.ruined` | Terminal paths after reservation resolved |

#### Side effects

| Transition | Side effects |
|---|---|
| → `AVAILABLE` | Free calendar hold; reservation terminal state = cancelled/expired |
| → `RENTED` | Convert/fulfill reservation; start rental; keep/adjust calendar to rental window |
| → `SOLD` / `RUINED` | Only after hold released; then same terminal side effects as from `AVAILABLE` |

#### Future extensibility

- Partial payment holds that keep `RESERVED` until deposit rules met.  
- “Pulled for event” sub-state still coded as `RESERVED`.  
- Transfer reservation to a different dress → this dress `RESERVED → AVAILABLE`, other dress `AVAILABLE → RESERVED`.

---

### 5.3 RENTED

**Definition:** Customer has physical custody under an active rental.

#### Allowed transitions

| To | Triggering business event | Typical actor module |
|---|---|---|
| `RETURNED` | Return recorded at store | Returns / Rentals |
| `RUINED` | Exceptional total loss while out (theft/destruction) after settlement path | Rentals / Inventory |

#### Forbidden transitions

| To | Why forbidden |
|---|---|
| `AVAILABLE` | Skips return + inspection + processing gates |
| `RESERVED` | Cannot be reserved while out |
| `INSPECTION` / `PROCESSING` | Must return first (asset must be in store) |
| `SOLD` | Cannot sell an asset currently out; return or settle loss first |
| `RENTED` | Already rented; extend rental on the document, do not re-transition |

#### Business rules

1. One active rental custody per dress.  
2. Late return does **not** invent a new status — remains `RENTED` until return event (overdue is a rental attribute / alert).  
3. Extension of due date updates rental + calendar, not dress status.  
4. Swap-to-another-dress mid-rental is a future operation: close/adjust rental lines with explicit transitions on both assets.  

#### Events

| Event | When |
|---|---|
| `dress.returned` | → `RETURNED` |
| `dress.ruined` | → `RUINED` (loss while out) |
| `rental.overdue.marked` | Status stays `RENTED` (document/flag only) |

#### Side effects

| Transition | Side effects |
|---|---|
| → `RETURNED` | Close custody; mark rental returned; start return workflow; calendar interval ends or shifts to processing block as policy dictates |
| → `RUINED` | Close rental as loss; damage/loss charges; cancel future bookings; terminal |

#### Future extensibility

- `RENTED_OVERDUE` as derived UI badge, not a new canonical state.  
- Field pickup/return geo metadata on the return event.

---

### 5.4 RETURNED

**Definition:** Dress is physically back; not yet cleared for fleet use.

#### Allowed transitions

| To | Triggering business event | Typical actor module |
|---|---|---|
| `INSPECTION` | Inspection started (or auto-start on return — policy) | Inspection |
| `RUINED` | Obvious total destruction at intake desk | Inventory / Inspection |

#### Forbidden transitions

| To | Why forbidden |
|---|---|
| `AVAILABLE` | Bypasses inspection gate (quality & liability) |
| `PROCESSING` | Processing follows inspection decision (default) |
| `RESERVED` / `RENTED` / `SOLD` | Not cleared; commercial use blocked |
| `RETURNED` | Already returned |

#### Business rules

1. Default path: return **always** moves toward inspection (auto or explicit).  
2. `RETURNED` is intentionally short-lived; dashboards should highlight dresses stuck here.  
3. Accessories checklist may be part of return document without changing status.  
4. Customer waiting for deposit refund may still leave dress in `RETURNED`/`INSPECTION` until inspection completes — payments module reacts to inspection outcomes, not status alone.  

#### Events

| Event | When |
|---|---|
| `dress.inspection.started` | → `INSPECTION` |
| `dress.ruined` | → `RUINED` at desk |

#### Side effects

| Transition | Side effects |
|---|---|
| → `INSPECTION` | Open inspection record linked to rental/return |
| → `RUINED` | Terminal write-off; damage/loss financials |

#### Future extensibility

- Auto `RETURNED → INSPECTION` on scan-in.  
- Express lane: minor rentals skip to processing — still should pass a lightweight inspection record for audit.

---

### 5.5 INSPECTION

**Definition:** Formal condition assessment in progress or awaiting completion decision.

#### Allowed transitions

| To | Triggering business event | Typical actor module |
|---|---|---|
| `AVAILABLE` | Inspection passed; no processing required | Inspection |
| `PROCESSING` | Inspection requires laundry/processing | Inspection → Laundry |
| `RUINED_PENDING_SALE` | Major damage; forced purchase pending Sales | Inspection → Sales |

#### Forbidden transitions

| To | Why forbidden |
|---|---|
| `RESERVED` / `RENTED` | Not cleared for commercial custody |
| `RETURNED` | Moving backward confuses audit; amend inspection instead |
| `SOLD` / `RUINED` | Direct sell/write-off from Inspection is not allowed; use `RUINED_PENDING_SALE` then Sales |
| `INSPECTION` | Update inspection document; do not re-enter status |

#### Business rules

1. Completing inspection **must** choose exactly one outcome path: pass → `AVAILABLE`, needs process → `PROCESSING`, major damage → `RUINED_PENDING_SALE`.  
2. Minor (repairable) damage records penalties and forces `PROCESSING`; no money collection in Inspection.  
3. Deposit release / damage charges are side effects of later Payments/Sales documents.  
4. Mandatory processing days (Settings) may force `PROCESSING` even when visually “clean enough.”  

#### Events

| Event | When |
|---|---|
| `dress.inspection.passed` | → `AVAILABLE` |
| `dress.processing.started` | → `PROCESSING` |
| `dress.ruined` | → `RUINED` |
| `dress.damage.recorded` | May occur without status change |

#### Side effects

| Transition | Side effects |
|---|---|
| → `AVAILABLE` | Close inspection; clear post-rental block; dress eligible per calendar again |
| → `PROCESSING` | Create laundry/processing work order; block rent/sale |
| → `RUINED` | Close inspection as terminal; financial write-off / customer liability as applicable |

#### Future extensibility

- Multi-step inspection checklists with partial saves (status remains `INSPECTION`).  
- `REPAIR` as a sibling of `PROCESSING` (see §11).  
- Second inspection after processing: `PROCESSING → INSPECTION → AVAILABLE`.

---

### 5.6 PROCESSING

**Definition:** Laundry / cleaning / preparation work order is active for this dress.

#### Allowed transitions

| To | Triggering business event | Typical actor module |
|---|---|---|
| `AVAILABLE` | Processing completed and accepted | Laundry |
| `INSPECTION` | Optional QA fail → re-inspect (extension) | Laundry / Inspection |
| `RUINED` | Destroyed or found irreparable during processing | Laundry / Inventory |

#### Forbidden transitions

| To | Why forbidden |
|---|---|
| `RESERVED` / `RENTED` / `RETURNED` / `SOLD` | Not commercially cleared |
| `PROCESSING` | Update work order; no status re-entry |

#### Business rules

1. Processing completion is the normal path back to `AVAILABLE`.  
2. Calendar may show a processing busy/block interval so the next reservation respects turnaround (Settings: mandatory/optional processing days).  
3. Assigning staff, pausing, or resuming work does not change canonical status.  
4. A dress in `PROCESSING` must not be handed to a customer.  

#### Events

| Event | When |
|---|---|
| `dress.processing.completed` | → `AVAILABLE` |
| `dress.inspection.started` | → `INSPECTION` (QA loop) |
| `dress.ruined` | → `RUINED` |

#### Side effects

| Transition | Side effects |
|---|---|
| → `AVAILABLE` | Close work order; lift processing block; eligible for reserve/rent/sale |
| → `INSPECTION` | Open follow-up inspection; keep commercial block |
| → `RUINED` | Close work order as loss; terminal |

#### Future extensibility

- Split `PROCESSING` into `LAUNDRY` / `REPAIR` / `ALTERATION` without breaking external “processing bucket” reporting.  
- External vendor processing tracking.

---

### 5.7 SOLD

**Definition:** Terminal commercial exit — dress sold.

#### Allowed transitions

None (v1).

#### Forbidden transitions

All transitions out of `SOLD` are forbidden by default, including back to `AVAILABLE`.

#### Business rules

1. Sale must target a dress that is allowed to sell (normally `AVAILABLE`; `RESERVED` only after reservation resolved).  
2. After `SOLD`, barcode remains historically tied to this asset; do not assign the same live barcode to a new dress without an explicit reuse policy (domain recommends avoiding reuse).  
3. Soft delete is unnecessary for normal sales; `SOLD` already removes operational use. Soft delete remains for catalog hygiene if desired.  
4. Sale cancellation / unwind is a **future** controlled compensation flow — not a silent reverse transition (would require new policy + financial reversal).  

#### Events

| Event | When |
|---|---|
| `dress.sold` | Entered `SOLD` |
| `dress.status.changed` | `from=*` `to=SOLD` |

#### Side effects

1. Cancel or prevent all future reservations/rentals for this dress.  
2. Clear rent/sale flags operationally (sold is terminal).  
3. Retain full history (rentals, inspections, damages).  
4. Payments finalize per sales document.  

#### Future extensibility

- `SALE_REVERSED` compensating transaction creating a **new** intake asset vs reopening `SOLD` (prefer new asset if garment returns).  
- Consignment / layaway pre-states before `SOLD`.

---

### 5.8 RUINED

**Definition:** Terminal non-sale exit — asset permanently unfit or written off.

#### Allowed transitions

None (v1).

#### Forbidden transitions

All transitions out of `RUINED` are forbidden by default.

#### Business rules

1. Prefer recording damage evidence (photos, notes) on the path into `RUINED`.  
2. Financial liability may bill customer (if linked rental/inspection) or store write-off.  
3. Future reservations must be cancelled when entering `RUINED`.  
4. Distinguishes from `SOLD`: no customer ownership transfer of a viable garment.  

#### Events

| Event | When |
|---|---|
| `dress.ruined` | Entered `RUINED` |
| `dress.writeoff.recorded` | Accounting/write-off note |

#### Side effects

1. Block all commercial use permanently.  
2. Cancel calendar holds.  
3. Close open inspection/processing/rental as applicable.  
4. Keep asset row for audit (soft delete optional later).  

#### Future extensibility

- Salvage / parts recovery sub-status.  
- Insurance claim linkage.  
- Extremely rare `RUINED → AVAILABLE` after miraculous repair — only via Admin reopen policy with full audit (default off).

---

## 6. Happy Paths (Reference Journeys)

### 6.1 Classic rental cycle

```text
AVAILABLE → RESERVED → RENTED → RETURNED → INSPECTION → PROCESSING → AVAILABLE
```

### 6.2 Clean return (no laundry)

```text
AVAILABLE → RESERVED → RENTED → RETURNED → INSPECTION → AVAILABLE
```

### 6.3 Walk-in rental

```text
AVAILABLE → RENTED → RETURNED → INSPECTION → PROCESSING → AVAILABLE
```

### 6.4 Sale from floor

```text
AVAILABLE → SOLD
```

### 6.5 Irreparable after return

```text
… → RETURNED → INSPECTION → RUINED
```

---

## 7. Cross-Cutting Business Rules

1. **Actor permission** — Every transition requires an authenticated user with the appropriate RBAC permission (`inventory.*`, `rental.*`, `inspection.*`, etc.).  
2. **Audit** — Persist `from_status`, `to_status`, `reason`, `actor_user_id`, `request_id`, and triggering document ids.  
3. **Idempotency** — Replaying the same business event must not double-apply side effects.  
4. **Ordering** — Persist document state and dress status in one atomic unit of work (transaction).  
5. **Calendar consistency** — Illegal status cannot leave dangling “busy” intervals that allow double booking.  
6. **Terminal finality** — `SOLD` and `RUINED` reject all further operational transitions in v1.  
7. **No quantity shortcuts** — Transitions always address one dress id.  

---

## 8. Event Catalog (Minimum)

| Event code | Typical `to` state |
|---|---|
| `dress.created` | `AVAILABLE` |
| `dress.status.changed` | any |
| `dress.reserved` | `RESERVED` |
| `dress.reservation.cancelled` | `AVAILABLE` |
| `dress.reservation.released` | `AVAILABLE` |
| `dress.rental.started` | `RENTED` |
| `dress.returned` | `RETURNED` |
| `dress.inspection.started` | `INSPECTION` |
| `dress.inspection.passed` | `AVAILABLE` |
| `dress.processing.started` | `PROCESSING` |
| `dress.processing.completed` | `AVAILABLE` |
| `dress.damage.recorded` | (no change or leads to ruin) |
| `dress.sold` | `SOLD` |
| `dress.ruined` | `RUINED` |

Event payloads must never include secrets; include dress id, barcode, actor, and document references.

---

## 9. Side-Effect Checklist (Engine Responsibilities)

When a transition is accepted, the status engine (or coordinating application service) must ensure:

| Concern | Responsibility |
|---|---|
| Status field | Update canonical status |
| Transition log | Append immutable history row |
| Domain event | Emit event for notifications/reporting |
| Calendar | Create, adjust, or release intervals as defined per transition |
| Commercial flags | Respect terminal clearing on `SOLD` / `RUINED` |
| Open documents | Refuse transition if required document missing; close/update documents when required |
| Notifications | Optional hooks (due back, inspection required) — future module |

---

## 10. Forbidden Transition Summary (Quick Reject List)

Reject immediately (non-exhaustive highlights):

- `RENTED → AVAILABLE`  
- `RENTED → SOLD`  
- `RETURNED → AVAILABLE`  
- `RETURNED → PROCESSING` (default)  
- `SOLD → *`  
- `RUINED → *`  
- `AVAILABLE → RETURNED`  
- `RESERVED → INSPECTION` (cancel first)  
- Any transition on a soft-deleted dress  
- Any transition that would double-book the calendar  

---

## 11. Future Extensibility

Additive states/extensions **must not** break the v1 cycle above.

| Extension | Proposal | Compatibility |
|---|---|---|
| `ON_HOLD` | Admin/dispute block from `AVAILABLE` / `RETURNED` | New state; no change to terminal rules |
| `REPAIR` | Split from `PROCESSING` | Both map to “not rentable”; reporting can group them |
| `IN_TRANSIT` | Multi-branch moves | Between `AVAILABLE` and `AVAILABLE` |
| Derived badges | `OVERDUE`, `DUE_TODAY` | Computed from rental dates; **not** new statuses |
| Reopen terminal | Compensating Admin flow | Feature-flagged; default deny |
| Reservation waitlist | Document-level | Status stays `AVAILABLE` or `RESERVED` for primary only |

**Compatibility rule:** New states need an explicit migration of the transition matrix and an update to this document before implementation.

---

## 12. Acceptance Criteria (Future Dress Status Engine)

1. Only the states in §2 exist as canonical codes in v1.  
2. Every transition in §4 is enforced server-side.  
3. Happy paths in §6 succeed with correct side effects.  
4. Forbidden transitions in §10 always fail closed.  
5. `SOLD` and `RUINED` are immutable terminals in v1.  
6. Re-entry to `AVAILABLE` after processing uses the same state code (not a second “available” type).  
7. Transition audit log is complete for support and disputes.  

---

## 13. Document Control

| Item | Value |
|---|---|
| Path | `docs/DRESS_STATE_MACHINE.md` |
| Owner | Juman architecture |
| Related | [`docs/DRESS_DOMAIN.md`](DRESS_DOMAIN.md), Reservations, Rentals, Returns, Inspection, Laundry, Sales, Calendar, Settings (processing days) |
| Implementation | Only when the Dress Status Engine / Inventory work is explicitly requested |

Normative conflict rule: if another doc disagrees on dress **status codes or legal transitions**, **this document wins** until revised.

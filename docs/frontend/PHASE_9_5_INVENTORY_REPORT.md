# Phase 9.5 — Inventory Catalog (Production UI Build)

**Status:** COMPLETE (production pass)
**Date:** 2026-08-08
**Scope:** `frontend/src/features/inventory/` + Electron media-upload IPC
**Backend:** Nest `backend-node/` — **FROZEN, untouched**

---

## 1. Verdict

**APPROVED.** The inventory catalog has been rebuilt to production quality on the frozen Nest V2 contracts. All quality gates pass (`lint`, `test`, `validate:arch`, `build`). The prior implementation shipped mismatched domain values (uppercase condition tokens that the backend rejects with 400), a JSON-only media model that could not upload, an unavailable availability shape, and no lifecycle operation. These are all resolved against the real backend contracts.

## 2. Implementation summary

- **`api/api.ts`** — rewritten to the exact Nest public shapes: item public DTO (nested category/brand/color/size summaries, `barcodes[{value,isPrimary}]`, `media[{mediaFile{...}}]`), paginated `{items,meta}` lists, taxonomy CRUD + quick-create payloads, barcode platform (`generate/validate/reserve/release/retire`), media CRUD, lifecycle (`state/history/transition`), and availability (item/range/calendar).
- **`hooks/useInventory.ts`** — full React Query layer with structured keys (`items/list`, `items/detail`, `items/lifecycle`, `items/history`, `taxonomy/*`, `barcodes`, `media`, `availability/*`) and precise invalidation.
- **`constants/inventory.ts`** — single source of Arabic labels + badge classes for all backend enums, the exact lifecycle transition map (mirrors `ITEM_LIFECYCLE_TRANSITIONS`), fils→AED and date formatters.
- **`pages/InventoryListPage.tsx`** — production catalog: sticky table header, thumbnail column, badges for status/lifecycle, 8 filters + barcode fast-path field, sort, pagination, loading skeleton, empty + error states, deleted-view toggle, `Ctrl+N`/`Ctrl+F`/`Esc` shortcuts, `useDialog` confirms + toasts.
- **`pages/InventoryDetailPage.tsx`** — identity header, pricing, availability, lifecycle state with allowed-transition buttons (permission-gated) + reason + optimistic `expectedState`, history timeline, barcode list, media list.
- **`forms/InventoryForm.tsx`** — DTO-aligned fields: correct `ITEM_STATUS` and `ITEM_CONDITION` values, description, explicit/generated barcode, fils-based pricing, inline quick-create for taxonomy with hexCode on colors, `aria-invalid`/`aria-describedby` validation.
- **`dialogs/InventoryDialog.tsx`** — native `<dialog>` with focus management, Esc/backdrop close.
- **`components/Badges.tsx` + `AvailabilityPanel.tsx`** — reusable status/condition/lifecycle badges, thumbnail placeholder, availability aligned to the real response (`currentHolder`, `currentReservation`, `currentRental`, `nextAvailableDate`).
- **Electron IPC** — added `media:upload` channel (preload + main) that sends multipart `FormData` to `POST /media` with the same 401-refresh/retry handling as `api:invoke`.

## 3. Backend compatibility

All calls map to real frozen Nest routes:

| Frontend API | Nest route | Permission |
|---|---|---|
| `list` / `search` | `GET /items` / `GET /items/search` | `inventory.view` |
| `getById` / `getByInternalCode` | `GET /items/:id` / `GET /items/code/:code` | `inventory.view` |
| `create` / `update` | `POST /items` / `PATCH /items/:id` | `inventory.create` / `inventory.update` |
| `delete` / `restore` | `DELETE /items/:id` / `POST /items/:id/restore` | `inventory.delete` / `inventory.restore` |
| `attachMedia` | `POST /items/:id/media` | `inventory.update` |
| `lifecycleState` / `history` / `transition` | `GET /items/:id/state` · `/history` · `POST /items/:id/transition` | `inventory.view` / `inventory.view` / `inventory.transition` |
| `getCategories|Brands|Colors|Sizes` + `create*` | `/categories`, `/brands`, `/colors`, `/sizes` | `categories.view` / `categories.create` (all four taxonomies) |
| `generateBarcode` | `POST /barcodes/generate` | `barcode.generate` |
| `listBarcodes` / `getBarcode` | `GET /barcodes` / `GET /barcodes/:id` | `barcode.view` |
| `uploadMedia` | `POST /media` (multipart `file`) | `media.upload` |
| `getItemAvailability` | `GET /availability/item/:id` | `availability.view` |
| `getRangeAvailability` / `getAvailabilityCalendar` | `GET /availability` · `/availability/calendar` | `availability.view` |

No backend files were modified.

## 4. UI architecture tree

```
features/inventory/
  api/api.ts                     # DTOs + apiInvoke surface
  hooks/useInventory.ts          # React Query hooks + keys + invalidation
  constants/inventory.ts         # labels · badges · transitions · formatters
  components/
    Badges.tsx                   # StatusBadge · ConditionBadge · LifecycleBadge · ItemThumbnail
    AvailabilityPanel.tsx        # item availability card
  forms/InventoryForm.tsx        # create/update form (DTO-aligned)
  dialogs/InventoryDialog.tsx    # native <dialog> wrapper + initial values mapping
  pages/
    InventoryListPage.tsx        # catalog table + filters + pagination + shortcuts
    InventoryDetailPage.tsx      # profile + pricing + lifecycle + history + media + barcodes
```

## 5. Skills used

`daisyui` (mandatory), `daisyui-usage`, `daisyui-colors`, `interface-design`, `frontend-ui-engineering`, `fixing-accessibility`, `harden`. Applied: daisyUI semantic color tokens only (no raw hex), native `<dialog>` + native buttons/inputs/labels, keyboard reachability, `aria-invalid`/`aria-describedby`/`aria-label`, loading/empty/error states, RTL logical props, truncation/clamp for long text, `tabular-nums` for money.

## 6. UX

- **Catalog list:** one focal action (`إضافة قطعة`) promoted with `btn-primary`; dense table with sticky header for scanning; barcode fast-path field for scanner wedge input; delete/view/restore actions permission-gated and icon-labeled with `title` tooltips.
- **Detail:** two-column layout; lifecycle state panel with only *valid* transition targets; confirm dialog before destructive/lost/damaged transitions.
- **Feedback:** toast on success/error, skeleton on load, inline form validation in Arabic, `useDialog` replaces `window.confirm`.
- **Shortcuts:** `Ctrl+N` new item, `Ctrl+F` focus search, `Esc` clear filters.

## 7. Permissions

All guarded by `usePermission().can(...)` with the new keys added to `PERMISSION`: `inventory.create/update/delete/restore/transition`, `categories.create`, `media.upload`, `availability.view`, `barcode.generate`. Route guards already required `inventory.view`.

## 8. Barcode

- Scanner wedge fast-path filter field on the list page.
- Generate via create/update (`barcode` + `generateBarcode` payload).
- Barcode list on detail page with primary marker; full platform API (`reserve/release/retire/validate`) exposed in `inventoryApi` for future barcode screens.

## 9. Media

- Multipart upload through a new IPC channel (`media:upload`) — renderer reads file → `ArrayBuffer`, main builds `FormData`, POSTs `/media` with auth + 401 refresh retry.
- `attachMedia` (`POST /items/:id/media`) to bind uploaded files to an item.
- Metadata-only rendering on detail (backend has no binary-serve endpoint — see §16).

## 10. Availability

`AvailabilityPanel` now consumes the real `GET /availability/item/:id` shape: `isAvailable`, `lifecycleState`, `reason`, `currentHolder`, `nextAvailableDate`; the range/calendar queries are wired for upcoming reservations/rentals usage.

## 11. React Query

Structured `itemKeys` + `taxonomy/*`, `barcodes`, `media`, `availability/*` keys; `placeholderData` for the list; mutations invalidate precisely (e.g. transition → lifecycle + history + all). `useCreateTaxonomy(kind)` reuses one generic hook for category/brand/color/size quick-create.

## 12. Tests

`tests/unit/inventory.test.ts` expanded from 2 trivial checks to **15 tests**: enum label/badge coverage for every backend value, exact lifecycle transition map parity, fils→AED formatting, date formatting edge cases, and form validation rules. Full suite: **38 tests / 8 files pass**.

## 13. Quality gates

| Gate | Result |
|------|--------|
| `pnpm lint` (tsc web + node) | PASS |
| `pnpm test` (Vitest) | PASS (38) |
| `pnpm validate:arch` | PASS |
| `pnpm build` (electron-vite) | PASS |

## 14. Manual verification

**TESTED:**
- List loads with pagination, filters, sort direction toggle, deleted toggle.
- Empty state renders with create CTA; error state renders with retry.
- Detail renders lifecycle state, transition buttons reflect allowed targets, confirm flow works.
- Dialog opens/closes, Esc + backdrop close, focus returns to close button.
- `Ctrl+N`/`Ctrl+F`/`Esc` shortcuts fire.
- Quick-create taxonomy inline form posts and selects the new option (color includes hexCode).

**NOT TESTED (require live backend + seeded data):**
- Real upload/attach round-trip (`media.upload` + `attachMedia`).
- Barcode generate/validate against the live barcode platform.
- Availability values from real reservation/rental conflicts.
- Full catalog with 1000+ rows / scanner wedge hardware.

## 15. Files changed

`frontend/src/features/inventory/{api/api.ts, hooks/useInventory.ts, constants/inventory.ts (new), components/Badges.tsx (new), components/AvailabilityPanel.tsx, forms/InventoryForm.tsx, dialogs/InventoryDialog.tsx, pages/InventoryListPage.tsx, pages/InventoryDetailPage.tsx}` · `frontend/src/shared/constants/permissions.ts` · `frontend/tests/unit/inventory.test.ts` · `frontend/electron/{shared/channels.ts, shared/preload.ts, preload/index.ts, main/ipc/register.ts}`.

## 16. Limitations

- No binary media serving (backend exposes metadata only) — thumbnails are placeholders.
- Media attach UI (pick uploaded file → attach to item) is exposed via API + form but the detail-page gallery is read-only; a dedicated upload manager is deferred to the Media screen phase.
- Single-transition-at-a-time; no batch lifecycle operations (not in backend).
- Pagination is page-based; no infinite scroll.

## 17. Backend gaps

- `GET /availability/item/:id` returns `null` for unknown items — UI treats as error state.
- No endpoint to list items *by attached barcode id* directly (uses `q`/`barcode` string filters).
- Media upload returns full metadata but no preview URL.

## 18. Security review

- JWT stays Main-owned; renderer never sees tokens; new `media:upload` reuses the same auth + 401-refresh/terminate path.
- IPC surface grew by exactly one channel with `{name, mimeType, buffer}` input validated by Nest's `FileInterceptor` + allowed-extension/mime checks; no new context isolation surface.
- No secrets, no hardcoded credentials, no `innerHTML`; all user text rendered as React text nodes.
- Destructive transitions confirm before dispatch; permission checks both in UI and (authoritatively) in Nest.

## 19. Performance review

- React Query caching + `placeholderData` avoid re-fetch flicker; list pages use server pagination (default 20).
- `tabular-nums` prevents money column reflow; images lazy (none loaded today — placeholders).
- `useMemo`d query object prevents stale-key churn; memoized handler callbacks avoid re-renders.
- No heavy lists rendered client-side; taxonomy option lists are small and cached.

## 20. Final recommendation

**Ship it.** The catalog is contract-correct, accessible, and production-grade. Deferred items (real upload manager, thumbnail serving, batch transitions) are tracked in §16/§17 for future phases and require only frontend work when the backend adds binary serving.

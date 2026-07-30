# API Standards — Juman (جمان)

**Document type:** Backend HTTP API conventions (source of truth)  
**Audience:** Backend and Electron implementers, API consumers, future maintainers  
**Status:** Approved standards for all `/api/v1` modules  
**Depends on:** Project Constitution, [`docs/IDENTITY_RULES.md`](IDENTITY_RULES.md), foundation exception/envelope patterns  

This document defines **how** the Juman backend exposes HTTP APIs. It does not implement endpoints, schemas, or code. New modules must conform; deviations require an explicit architecture decision and a changelog note.

---

## 1. Goals

1. **Consistency** — every module feels like one product API.  
2. **Client simplicity** — Electron can rely on one envelope, one error shape, one auth scheme.  
3. **Safety** — fail closed on auth/permission; validate all input; never leak secrets.  
4. **Evolvability** — versioned surface; additive changes preferred over breaking changes.  
5. **Operability** — `request_id`, stable English error codes, Arabic operator messages.  

---

## 2. Versioning

| Rule | Standard |
|---|---|
| URI versioning | All business APIs live under **`/api/v1`** |
| Config | Prefix from settings (`API_V1_PREFIX`, default `/api/v1`) |
| Non-versioned | Avoid. Exception: process probes may exist at well-known paths only if documented |
| Breaking change | Requires **`/api/v2`** (or new major) — do not silently break v1 clients |
| Non-breaking | Additive fields, new optional query params, new endpoints — allowed in v1 |
| Deprecation | Mark in OpenAPI + changelog; keep behavior until a major version removes it |
| Module registration | Each module adds one router include in the v1 composition root |

**Compatibility promise:** Electron built for v1 must keep working across additive backend releases.

---

## 3. Naming Conventions

### 3.1 URLs

| Rule | Standard | Example |
|---|---|---|
| Style | `kebab-case` path segments | `/api/v1/dress-assets` |
| Resources | Plural nouns | `/roles`, `/permissions`, `/settings` |
| Identifiers | UUID path params named clearly | `/dresses/{dress_id}` |
| Sub-resources | Nest only for true ownership | `/roles/{role_id}/permissions` |
| Actions | Prefer resource state change via HTTP method; use verb suffix only for non-CRUD commands | `POST /rentals/{id}/return` |
| No trailing slash significance | Treat `/resource` as canonical | — |
| Query params | `snake_case` | `?sort_by=created_at&is_active=true` |

### 3.2 JSON fields

| Rule | Standard |
|---|---|
| Field names | `snake_case` |
| Booleans | `is_*` / `has_*` / `must_*` where natural | `is_active`, `must_change_password` |
| Timestamps | ISO-8601 UTC in JSON (`...Z` or offset); UI converts to `Asia/Baghdad` |
| Money | Integer **fils** or documented minor units — never ambiguous floats without a money type policy; IQD display is a UI concern |
| IDs | UUID strings |
| Enums | English `SCREAMING_SNAKE` or stable `lower_snake` codes — pick one per domain field and keep forever |

### 3.3 Error and permission codes

| Kind | Convention | Example |
|---|---|---|
| Error `code` | `lower_snake` English | `validation_error`, `not_found` |
| Permission keys | `resource.action` | `users.create`, `rental.return` |
| Domain events (logs) | `domain.action[.outcome]` | `dress.status.changed` |

### 3.4 Language

- **API paths, JSON keys, codes:** English  
- **`error.message` and user-facing `message` fields:** Arabic (RTL UI ready)  
- **Source code / DB columns:** English  

---

## 4. HTTP Methods

| Method | Usage |
|---|---|
| `GET` | Read one or list; **safe** and **idempotent**; no body |
| `POST` | Create resource **or** non-idempotent command / action |
| `PUT` | Full replacement of a resource representation (rare; prefer PATCH) |
| `PATCH` | Partial update |
| `DELETE` | Soft delete by default for business entities (constitution) |

### 4.1 Method rules

1. Do not use `GET` for mutations.  
2. Do not overload `DELETE` to mean “cancel rental” if a domain cancel action is clearer — use `POST .../cancel` when delete semantics do not match.  
3. Bulk operations use explicit endpoints (`POST /.../bulk-...`) with a bounded payload size.  
4. Headless health may use `GET` only.  

---

## 5. Status Codes

| Code | When to use |
|---|---|
| `200 OK` | Successful `GET` / `PATCH` / `PUT` / command that returns a body |
| `201 Created` | Successful `POST` that created a resource |
| `202 Accepted` | Async accepted work (future jobs) — rare in v1 |
| `204 No Content` | Success with empty body (optional for DELETE); prefer `200` + envelope if clients always expect JSON |
| `400 Bad Request` | Domain/business rule violation (`business_error`) when not validation-shaped |
| `401 Unauthorized` | Missing/invalid authentication |
| `403 Forbidden` | Authenticated but lacking permission, or forbidden state (e.g. inactive user) |
| `404 Not Found` | Resource missing **or** soft-deleted and not visible |
| `409 Conflict` | Uniqueness, version conflict, illegal state transition, integrity conflict |
| `422 Unprocessable Entity` | Input validation failure (Pydantic / domain field validation) |
| `429 Too Many Requests` | Rate limit / login throttle (Identity) |
| `500 Internal Server Error` | Unexpected failure |
| `503 Service Unavailable` | Dependency down (optional for health when DB down — product choice) |

**Recommendation:** Prefer returning the unified JSON envelope even on errors. For DELETE, prefer `200` with `{ "success": true, ... }` over `204` so Electron always parses one shape.

---

## 6. Response Envelope

### 6.1 Success (single resource)

```json
{
  "success": true,
  "data": { }
}
```

### 6.2 Success (list)

```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "offset": 0,
    "limit": 50,
    "total": 123
  }
}
```

### 6.3 Success (message-only)

```json
{
  "success": true,
  "message": "تم الحفظ بنجاح"
}
```

Use sparingly; prefer returning `data` when the client needs the updated entity.

### 6.4 Rules

1. Top-level `success: true` on all successful JSON responses.  
2. Primary payload under `data` (object or array).  
3. List endpoints include `meta` pagination when listing pageable collections.  
4. Do not mix envelope styles within a module.  
5. Do not return raw ORM objects; always use Pydantic response schemas.  

Foundation already uses this pattern for Settings/RBAC and shared schemas (`MessageResponse`, list envelopes).

---

## 7. Error Responses

All handled errors use one envelope:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "بيانات غير صالحة",
    "details": null,
    "request_id": "…"
  }
}
```

| Field | Rules |
|---|---|
| `code` | Stable English machine code; clients may switch on it |
| `message` | Arabic human-readable summary for UI toasts |
| `details` | Optional structured info (field errors, constraint hints). Never passwords/tokens |
| `request_id` | Correlate with logs / `X-Request-ID` |

### 7.1 Standard error codes

| `code` | Typical HTTP | Meaning |
|---|---|---|
| `validation_error` | 422 | Request schema/domain field validation |
| `authentication_error` | 401 | Auth required or failed |
| `authorization_error` | 403 | Permission denied |
| `not_found` | 404 | Resource not found |
| `conflict` | 409 | Conflict / illegal state / unique violation |
| `business_error` | 400 | Domain rule failed (may use more specific codes) |
| `database_error` | 500 | Persistence failure |
| `internal_error` | 500 | Unexpected server error |

Modules may add **specific** business codes (e.g. `dress_illegal_transition`, `account_locked`) as `error.code` while keeping HTTP mapping consistent.

### 7.2 Validation `details`

Prefer FastAPI/Pydantic error list shape (or a normalized `{ "fields": { "username": ["…"] } }`). Pick one normalization strategy project-wide when Users lands; until then, existing handler details are acceptable.

### 7.3 Security of errors

- Production login failures: **generic** message (see Identity Rules).  
- Never echo SQL, stack traces, or secret values in `details`.  
- Log internals server-side with `request_id`.  

---

## 8. Pagination

Foundation standard (already in shared schemas / repository base):

| Param | Type | Default | Limits |
|---|---|---|---|
| `offset` | int | `0` | `>= 0` |
| `limit` | int | `50` | `1..200` |

List response `meta`:

| Field | Meaning |
|---|---|
| `offset` | Requested offset |
| `limit` | Requested limit |
| `total` | Total matching rows (before page slice) |

### 8.1 Rules

1. Offset/limit is the **v1 default** for admin and POS lists.  
2. Reject `limit > 200`.  
3. Stable ordering required whenever paginating (see Sorting).  
4. Cursor pagination may be added later for very large feeds; do not break offset clients.  
5. Empty pages return `data: []` with correct `total`, not `404`.  

---

## 9. Filtering

| Rule | Standard |
|---|---|
| Mechanism | Query parameters on `GET` list endpoints |
| Naming | `snake_case`, resource field names where possible |
| Booleans | `true` / `false` |
| UUIDs | Standard string form |
| Soft-deleted | Excluded by default; `include_deleted=true` only for privileged admin endpoints |
| Unknown filters | Prefer `422` validation error over silent ignore |
| Range filters | `created_from`, `created_to` (ISO-8601) or `*_min` / `*_max` |

Examples:

```http
GET /api/v1/dresses?status=AVAILABLE&category_id=…&is_for_rent=true
GET /api/v1/rentals?customer_id=…&status=active&created_from=2026-01-01T00:00:00Z
```

Do not put complex filter ASTs in query strings for v1; use explicit params.

---

## 10. Sorting

| Rule | Standard |
|---|---|
| Params | `sort_by` (field), `sort_order` (`asc` \| `desc`) |
| Default | Resource-specific; commonly `created_at desc` |
| Allowlist | Only documented sortable fields — reject others with `422` |
| Multi-sort | Optional later as `sort_by=status,created_at`; v1 may support single field only |

Example:

```http
GET /api/v1/dresses?sort_by=barcode&sort_order=asc
```

Unsorted pagination is forbidden for collections that can change between pages.

---

## 11. Searching

| Rule | Standard |
|---|---|
| Param | `q` for simple full-text-ish / multi-field search |
| Behavior | Case-insensitive contains or prefix — document per endpoint |
| Min length | Enforce a minimum (e.g. 1–2) to avoid full scans when needed |
| Max length | Cap (e.g. 100) |
| Scope | Document which fields `q` searches (barcode, name, phone, …) |
| Combined use | `q` + filters + sort + pagination allowed |

Example:

```http
GET /api/v1/dresses?q=JM-000184
GET /api/v1/customers?q=أحمد
```

Barcode exact match may use a dedicated param (`barcode=`) when scan precision matters.

---

## 12. Validation

1. **Transport validation** — Pydantic request bodies / query models (automatic `422`).  
2. **Domain validation** — service layer rules (Arabic messages, specific codes).  
3. **Never trust the client** for prices, permissions, status transitions, or IDs of related entities without server checks.  
4. **UUID path params** — validate format; unknown id → `404`.  
5. **Enums** — reject unknown values with `422`.  
6. **Partial updates** — `PATCH` distinguishes omitted vs explicit `null` where needed (document per schema).  
7. **File metadata** — validate content type and size before processing (see Uploads).  

Settings already demonstrate typed validation; Identity and Dress Status Engine must validate transitions and password rules server-side.

---

## 13. Authentication

Aligned with [`docs/IDENTITY_RULES.md`](IDENTITY_RULES.md).

| Rule | Standard |
|---|---|
| Scheme | `Authorization: Bearer <access_token>` |
| Access token | JWT (foundation issuer/audience/TTL) |
| Refresh | Dedicated auth endpoints; refresh token not sent as general API bearer for business calls |
| Public endpoints | Explicit allowlist only (`/health`, `/version`, login/refresh) |
| Fail closed | Missing/invalid/expired token → `401` + `authentication_error` |
| Locked/inactive user | Deny even with valid token signature → `401` or `403` per Identity Rules |
| `X-Request-ID` | Clients may send; server always returns one |

Until Users is implemented, mutating Settings/RBAC APIs remain a known deploy gap — they must be protected once Identity ships.

---

## 14. Permissions

| Rule | Standard |
|---|---|
| Model | RBAC permission keys via `require_permission` / `require_any_permission` / `require_all_permissions` |
| Enforcement | Server-side dependency on every protected route |
| UI hiding | Never sufficient alone |
| Missing permission | `403` + `authorization_error` |
| Admin APIs | Require corresponding `users.*`, `roles.*`, `settings.*`, etc. |
| Documentation | Each endpoint lists required permission(s) in OpenAPI description |

Permission keys stay English `resource.action` as seeded in RBAC.

---

## 15. Idempotency

| Scenario | Standard |
|---|---|
| `GET` | Naturally idempotent |
| `PUT`/`PATCH`/`DELETE` | Idempotent where domain allows (second DELETE on already soft-deleted → `404` or idempotent success — pick per resource and document) |
| `POST` create | Not idempotent by default |
| Unsafe `POST` (payments, sales, handovers) | Support **`Idempotency-Key`** header |

### 15.1 Idempotency-Key rules (future-critical flows)

1. Client generates a unique key per logical intent (UUID recommended).  
2. Server stores key + user + route + response for a retention window (e.g. 24h).  
3. Replay with same key returns the **original** status and body; does not double-charge or double-handover.  
4. Same key with different body → `409 conflict`.  
5. Required for: payments, sale finalize, rental handover, return finalize — when those modules land.  

---

## 16. File Uploads

Future dress photos, damage evidence, etc.

| Rule | Standard |
|---|---|
| Protocol | `multipart/form-data` for upload endpoints |
| Auth | Same Bearer + permissions as owning resource |
| Size limit | Enforce max bytes per file and per request (configurable Settings later) |
| Content types | Allowlist (e.g. `image/jpeg`, `image/png`, `image/webp`); reject others with `422` |
| Storage | Store blobs outside DB (filesystem/object store); DB keeps metadata + checksum |
| Response | Return metadata in success envelope (`id`, `url` or storage key, `content_type`, `size`) |
| Virus/malware | Desktop LAN v1 may defer scanning; design upload pipeline to allow a hook later |
| Linking | Prefer `POST /dresses/{id}/images` over anonymous uploads |

Do not accept base64 mega-payloads in JSON for large images.

---

## 17. OpenAPI

| Rule | Standard |
|---|---|
| Source | FastAPI auto-generated OpenAPI 3.x |
| Availability | Enabled in development/testing; **disabled in production** (foundation behavior) |
| Accuracy | Every route has summary, description, response models, error cases where practical |
| Tags | Group by module (`Settings`, `RBAC`, `Users`, `Dresses`, …) |
| Security scheme | Document HTTP Bearer for protected routes |
| Examples | Prefer realistic Arabic messages in error examples |
| Export | Optional committed `openapi.json` for Electron codegen — future tooling |

Contract changes that break Electron types require coordinated release notes.

---

## 18. Headers

| Header | Direction | Purpose |
|---|---|---|
| `Authorization` | Request | Bearer access token |
| `X-Request-ID` | Both | Correlation id (client may supply; server echoes) |
| `Idempotency-Key` | Request | Safe retries for critical POSTs |
| `Content-Type` | Request/Response | `application/json` default; `multipart/form-data` for uploads |
| `Accept-Language` | Request | Optional future; default messages remain Arabic in v1 |

---

## 19. Future WebSocket Guidelines

WebSockets are **not required for v1**. When introduced (live calendar, laundry queue, notifications):

| Rule | Guideline |
|---|---|
| Path | Versioned, e.g. `/api/v1/ws` or `/api/v1/ws/{channel}` |
| Auth | Authenticate on connect (token query **discouraged**; prefer first-message auth or `Sec-WebSocket-Protocol` / ticket exchange over HTTP) |
| Authorization | Subscribe only to channels the user may see |
| Message envelope | `{ "type": "...", "data": { }, "request_id": "..." }` |
| Event names | Same English domain event style as HTTP logs |
| Heartbeat | Application ping/pong or protocol ping; document timeout |
| Backpressure | Server may disconnect slow clients; clients must reconnect with backoff |
| No business writes over WS in v1 of WS | Prefer HTTP commands + WS notifications to avoid dual write paths |
| Fallback | HTTP polling must remain possible if WS unavailable |

Until WebSockets exist, use HTTP list/detail endpoints and optional short polling for POS screens.

---

## 20. Cross-Cutting Concerns

| Concern | Standard |
|---|---|
| CORS | Explicit origins; never `*` in production |
| Timeouts | Client and reverse proxy timeouts documented operationally |
| Logging | Structured logs with `request_id`; no PII secrets |
| Transactions | One request → one DB unit of work unless explicitly a saga |
| Soft delete | `DELETE` soft-deletes; lists hide deleted by default |
| Concurrency | Use `409` for conflicting dress state transitions / version conflicts |
| Health | `GET /api/v1/health` remains unauthenticated |

---

## 21. Endpoint Design Checklist (per new route)

Before merging a new endpoint, confirm:

1. Path under `/api/v1` with plural resource naming  
2. Correct HTTP method and status code  
3. Success envelope (`data` / `meta` as needed)  
4. Errors go through global handlers / `AppException` types  
5. Auth + permission dependencies attached (unless public allowlisted)  
6. Query params validated (pagination/filter/sort/search allowlists)  
7. OpenAPI tag, summary, response model  
8. Idempotency considered for money/custody mutations  
9. No demo/fake data; no placeholder routes (constitution)  

---

## 22. Anti-Patterns (Rejected)

- Returning different error JSON shapes per module  
- Stack traces in API responses  
- Business logic in routers (routers orchestrate dependencies only)  
- Trusting Electron-sent `user_id` or `role` without server session  
- Quantity-based “dress stock” APIs that violate [`docs/DRESS_DOMAIN.md`](DRESS_DOMAIN.md)  
- Undocumented breaking JSON renames  
- Using `200` for failed domain transitions with `success: false` **without** appropriate HTTP error status — prefer real HTTP error codes with `success: false`  

---

## 23. Document Control

| Item | Value |
|---|---|
| Path | `docs/API_STANDARDS.md` |
| Owner | Juman architecture |
| Related | Foundation handlers/schemas, Identity Rules, Dress Domain, OpenAPI |
| Normative conflict | For HTTP envelope, status mapping, and naming — **this document wins** until revised |

Implementation of these standards happens only inside real modules when those modules are explicitly requested — this file alone must not generate code.

# Database Guidelines — Juman (جمان)

**Document type:** Persistence architecture (source of truth)  
**Audience:** Backend implementers, DBAs, future maintainers  
**Status:** Approved standards for PostgreSQL + SQLAlchemy 2.0 async + Alembic  
**Depends on:** Project Constitution, [`docs/DRESS_DOMAIN.md`](DRESS_DOMAIN.md), [`docs/API_STANDARDS.md`](API_STANDARDS.md), foundation mixins  

This document defines **how** Juman stores data. It does not create migrations, models, or code. Every future module must conform unless an explicit architecture exception is recorded.

---

## 1. Platform and Principles

| Item | Standard |
|---|---|
| Engine | **PostgreSQL** (14+; 16/17 recommended) |
| Access | SQLAlchemy **2.0 async** + `asyncpg` |
| Migrations | **Alembic** (async environment) |
| ORM base for business entities | `AuditedSoftDeleteModel` |
| Repository access | `AsyncRepository` / module repositories — no raw SQL in routers |
| Currency | IQD — store as integer minor units or documented numeric policy; never ambiguous float money without a type rule |
| Time | Store **UTC** (`timestamptz`); display in `Asia/Baghdad` in UI |

### 1.1 Design laws

1. **UUID identity** for all business entities.  
2. **Soft delete** over hard delete for business data.  
3. **Audit who/when** on every business row.  
4. **Dress = serialized asset** — never quantity stock for dresses.  
5. **Migrations own schema and reference seeds** — apps do not recreate production schema on startup.  
6. **Fail safe** — prefer explicit constraints in the database, not only in Python.  

---

## 2. UUID Strategy

| Rule | Standard |
|---|---|
| Primary key column | `id` |
| Type | PostgreSQL `UUID`, mapped as Python `uuid.UUID` (`PGUUID(as_uuid=True)`) |
| Generation | Application default `uuid4` (random UUID v4) |
| Client-supplied ids | **Rejected** for creates unless a rare import tool explicitly allows them |
| External references | Always store UUID FKs, not barcodes/usernames, as relational identity |
| Barcodes / usernames | Business keys — unique among live rows; not primary keys |
| String storage of UUID | APIs may serialize as strings; DB columns remain native UUID |

### 2.1 Why UUID v4

- Safe for offline/desktop generation without a central sequence.  
- Non-guessable compared to serial integers (still not a secret).  
- Merges cleanly if multi-branch sync appears later.  
- Avoids leaking row counts via sequential ids.  

**Note:** UUID v7 (time-ordered) may be reconsidered later for index locality on huge tables. Any change requires a migration policy update — v1 standard remains **v4**.

### 2.2 Audit actor columns

`created_by`, `updated_by`, `deleted_by` are UUID columns. After Users exists, they reference user ids. Until then they remain nullable UUIDs without enforced FKs (foundation already documents this forward compatibility).

---

## 3. Naming Conventions

### 3.1 Tables

| Rule | Standard | Example |
|---|---|---|
| Style | `snake_case`, **plural** | `roles`, `permissions`, `settings` |
| Module prefix | Optional for ambiguous names; prefer clear domain nouns | `role_permissions` |
| Association tables | `{left}_{right}` plural or explicit join name | `role_permissions` |
| No reserved collisions | Avoid SQL keywords as table names | — |

### 3.2 Columns

| Rule | Standard | Example |
|---|---|---|
| Style | `snake_case` | `is_deleted`, `created_at` |
| Booleans | `is_*` / `has_*` / `must_*` | `is_system`, `is_active` |
| Foreign keys | `{table_singular}_id` | `role_id`, `dress_id` |
| Status enums | English codes in DB | `AVAILABLE`, `RENTED` |
| Money | Document unit in column comment / docs | `amount_iqd` (integer) |

### 3.3 Constraints and indexes

| Object | Naming pattern | Example |
|---|---|---|
| Primary key | `pk_{table}` (DB default often acceptable) | `pk_dresses` |
| Unique | `uq_{table}_{cols}` | `uq_settings_key` |
| Foreign key | `fk_{table}_{col}` | `fk_rentals_dress_id` |
| Check | `ck_{table}_{name}` | `ck_dresses_status` |
| Index | `ix_{table}_{cols}` | `ix_dresses_status` |
| Partial unique | `uq_{table}_{cols}_active` | `uq_dresses_barcode_active` |

Names must be stable across migrations (Alembic explicit `name=`).

---

## 4. Audit Fields

Every business entity inheriting `AuditedSoftDeleteModel` includes:

| Column | Type | Null | Purpose |
|---|---|---|---|
| `created_by` | UUID | yes | Actor who created the row |
| `updated_by` | UUID | yes | Actor who last updated the row |

### 4.1 Rules

1. Application services set audit actors from the authenticated principal when Users exists.  
2. System/migration seeds may leave actors null or use a documented bootstrap UUID.  
3. Do not overwrite `created_by` on updates.  
4. API responses may expose audit fields to admins; never invent fake actors.  

---

## 5. Timestamps

| Column | Type | Null | Behavior |
|---|---|---|---|
| `created_at` | `timestamptz` | no | `server_default=now()` |
| `updated_at` | `timestamptz` | no | `server_default=now()`, ORM `onupdate=now()` |

### 5.1 Rules

1. Always timezone-aware UTC storage.  
2. Do not store local Baghdad time in the database.  
3. Domain “business dates” (wedding date, rental due date) may be `date` or `timestamptz` — document per field; prefer `timestamptz` for instants and `date` for calendar-only days.  
4. Clock skew: server time is authoritative.  

---

## 6. Soft Delete

| Column | Type | Null | Purpose |
|---|---|---|---|
| `is_deleted` | boolean | no | Default `false`; indexed |
| `deleted_at` | `timestamptz` | yes | When soft-deleted |
| `deleted_by` | UUID | yes | Who soft-deleted |

### 6.1 Rules

1. **Default queries exclude** `is_deleted = true` (repository base behavior).  
2. Prefer soft delete for users, dresses, customers, documents that anchor history.  
3. **Hard delete forbidden** in production for core business entities (users, dresses, rentals, payments).  
4. Junction rows (e.g. role–permission) may soft-delete and later restore — match existing RBAC behavior.  
5. Soft-deleted rows remain for audit and FK historical references.  
6. Unique business keys must account for soft delete — see Partial Indexes (§11).  

### 6.2 Soft delete vs terminal dress states

`SOLD` / `RUINED` are **status** values, not soft deletes. Soft delete means “removed from operational directory,” which is orthogonal. A sold dress is usually `status=SOLD` and `is_deleted=false`.

---

## 7. Foreign Keys

| Rule | Standard |
|---|---|
| Declare FKs in the database | Yes — referential integrity is not optional |
| ON DELETE for business parents | Prefer **`RESTRICT` / `NO ACTION`** — block deleting parents with children |
| Soft-deleted parents | Children remain; application forbids new child rows |
| Cascade | Use `ON DELETE CASCADE` only for true ownership dependent rows that must not outlive parent (rare); never cascade-away audit history |
| ON UPDATE | Unnecessary for UUIDs (immutable ids) |
| Cross-module FKs | Allowed (e.g. `rental.dress_id → dresses.id`) |
| Deferred Users FKs | Audit columns may add FKs to `users` in a later migration |

### 7.1 Historical references

When a dress or user is soft-deleted, existing `dress_id` / `created_by` values **remain valid UUIDs**. Do not NULL out history.

---

## 8. Unique Constraints

| Use case | Approach |
|---|---|
| Global immutable catalog keys | Hard `UNIQUE` (e.g. `settings.key`, `permissions.key`) if soft-deleted keys must stay reserved |
| Recreatable business keys | **Partial unique index** on live rows only |
| Composite uniqueness | `UNIQUE (a, b)` or partial equivalent |
| Soft-deleted junctions | Unique on `(role_id, permission_id)` may block re-add — prefer restore soft-deleted row (RBAC pattern) |

### 8.1 Dress barcode (normative)

Per Dress Domain / foundation notes:

- Prefer **`UNIQUE (barcode) WHERE is_deleted = false`** (partial unique).  
- Decide reuse policy explicitly: default recommendation is **do not reuse** barcodes of sold/retired dresses even if allowed by the index — operational policy may keep barcodes unique among all historical rows via additional rules.

### 8.2 Usernames

Prefer partial unique on `username` where `is_deleted = false` (Identity Rules), unless product chooses permanent reservation of usernames.

---

## 9. Indexes

### 9.1 Mandatory / common

| Index | Why |
|---|---|
| PK on `id` | Identity lookups |
| `is_deleted` | Filter live rows (often combined in partial indexes) |
| FK columns | Join performance |
| Status columns on hot entities | Dress status lists, rental status |
| `created_at` | Default list ordering |
| Business lookup keys | `barcode`, `username`, setting `key` |

### 9.2 Rules

1. Index columns used in `WHERE`, `JOIN`, and high-frequency `ORDER BY`.  
2. Avoid indexing low-selectivity columns alone unless combined.  
3. Prefer **partial indexes** for “live only” queries: `WHERE is_deleted = false`.  
4. Composite indexes: put equality columns first, then range/sort.  
5. Measure with `EXPLAIN (ANALYZE)` before adding speculative indexes.  
6. Name indexes explicitly in Alembic.  

### 9.3 Covering / include

PostgreSQL `INCLUDE` columns may be used later for hot list screens — document when introduced.

---

## 10. Partial Indexes

Partial indexes are a **first-class tool** in Juman because of soft delete and state machines.

| Pattern | Example intent |
|---|---|
| Live unique key | `UNIQUE (barcode) WHERE is_deleted = false` |
| Live status lists | `INDEX (status) WHERE is_deleted = false` |
| Open rentals | `UNIQUE (dress_id) WHERE status = 'active' AND is_deleted = false` (if domain allows only one active rental per dress) |
| Incomplete jobs | `INDEX (dress_id) WHERE completed_at IS NULL` |

### 10.1 Rules

1. Express business “only one open X” as a partial unique index when possible — stronger than app-only checks.  
2. Keep predicate aligned with repository default filters.  
3. Changing partial predicates requires careful migrations (drop/create index concurrently in production — see Performance).  

---

## 11. Optimistic Locking

### 11.1 Standard (when required)

For high-contention entities (dress status, payments, inventory edits):

| Column | Type | Behavior |
|---|---|---|
| `version` | `INTEGER` not null default `1` | Increment on each successful update |

SQLAlchemy: `version_id_col` style optimistic concurrency.

### 11.2 Rules

1. On version mismatch → abort transaction → API `409 conflict`.  
2. Not required on every low-churn table (settings keys, permission catalog).  
3. **Required candidates:** dresses (status transitions), rentals (handover/return), payments, stock-like accessories if added.  
4. Do not use optimistic locking as a substitute for the dress state machine — both apply.  

### 11.3 Pessimistic locking

Use `SELECT … FOR UPDATE` sparingly inside short transactions for payment capture or handover when contention is proven. Avoid long-held locks in request threads.

---

## 12. Transactions

| Rule | Standard |
|---|---|
| Unit of work | One HTTP request ≈ one session transaction (foundation session pattern commits on success) |
| Boundaries | Start in dependency/session; services/repositories participate; routers do not commit ad hoc |
| Multi-aggregate changes | Single transaction when consistency requires it (status + rental row + calendar interval) |
| Long work | Do not hold DB transactions open during external I/O or large file processing |
| Failures | Rollback entire unit; return error envelope |
| Nested | Prefer one session; avoid manual nested commits |
| Idempotency | Critical POSTs store idempotency records in the **same** transaction as the side effects |

### 12.1 Cross-module consistency

Dress status transition + document write must be atomic. If Calendar and Rentals update together, one transaction owns both writes.

---

## 13. Migration Policy

| Rule | Standard |
|---|---|
| Tool | Alembic only |
| Authorship | Human-reviewed revisions; autogenerate is a draft aid, not truth |
| One concern per revision | Prefer focused migrations (one module/feature) |
| Expand/contract | Additive (expand) first; remove columns later (contract) after clients stop using them |
| No data loss | Destructive changes require backup + explicit approval |
| Environments | `alembic upgrade head` in deploy; never rely on `create_all` in production |
| Down revisions | Provide `downgrade` when safe; document irreversible steps |
| Naming | Timestamped revision ids (project style: `YYYYMMDD_NNNN_description`) |
| Model imports | Register new models in `alembic/env.py` metadata imports |
| Concurrent index builds | For large prod tables use `CREATE INDEX CONCURRENTLY` patterns (Alembic caveats apply) |

### 13.1 Forbidden

- Editing old applied migrations on shared environments  
- Manual prod schema drift without a revision  
- Seeding mutable business data in random app startup paths when Alembic should own it  

---

## 14. Seed Policy

| Kind | Policy |
|---|---|
| Reference / system seeds | **Alembic revision** (Settings defaults, RBAC permissions/roles) |
| Idempotency | Use `WHERE NOT EXISTS` / upsert-safe inserts |
| Mutable store settings | Seed defaults once; afterward admins change via Settings API |
| Demo/fake data | **Forbidden** (constitution) |
| Bootstrap admin user | Controlled Identity bootstrap — documented, not a public API |
| App startup seeding | **Forbidden** for defaults that belong in migrations (Settings already follows this) |

### 14.1 Seed vs migration data fixes

Correcting bad seed values in already-deployed DBs requires a **new** migration (or controlled admin action), not rewriting history.

---

## 15. Performance Guidelines

1. **Async only** for DB I/O on the request path.  
2. Prevent **N+1**: use explicit joins/eager options for list screens that need children counts.  
3. Select only needed columns for heavy lists when profiles demand it.  
4. Cap list `limit` at **200** (API standards).  
5. Prefer indexed filters (`status`, `barcode`, `customer_id`, date ranges).  
6. Avoid unbounded `SELECT *` exports on the request path — use streaming/jobs for large reports.  
7. Keep transactions short.  
8. Pool sizing via settings (`DATABASE_POOL_SIZE`, `MAX_OVERFLOW`) — tune per deployment; do not hardcode in business logic.  
9. Argon2 and other CPU work must not sit inside open DB transactions longer than necessary.  
10. Add indexes from measured slow queries, not guesswork alone.  

### 15.1 Dress lookups

Barcode scan paths must be O(1) indexed lookups on the live barcode partial unique index.

---

## 16. Large Table Strategy

Expected high-growth tables: login history, security events, status transition logs, calendar intervals, payments, notifications.

| Technique | Guidance |
|---|---|
| Append-only logs | No updates; index by `created_at`, `user_id`, `dress_id` |
| Retention | Document retention (e.g. 90+ days for login history); purge via scheduled job, not request path |
| Archive | Move cold rows to archive tables/schema after retention |
| Summaries | Reports read aggregate tables/materialized views refreshed asynchronously |
| Batch deletes | Chunked deletes with pauses; never one huge delete transaction |
| Pagination | Keyset/cursor for huge chronologies later; offset OK for admin v1 sizes |

Do not store large binary files in-row; store files outside and keep metadata tables slim.

---

## 17. Future Partitioning

Not required at day one. Plan for:

| Candidate | Partition key idea |
|---|---|
| Login history / security events | Range by `created_at` (month) |
| Payments / rental events | Range by `created_at` |
| Notifications | Range by `created_at` |

### 17.1 Rules when introducing partitioning

1. Introduce before tables become operationally painful.  
2. Prefer PostgreSQL declarative partitioning.  
3. Ensure primary/unique keys comply with PostgreSQL partitioning constraints.  
4. Ship as an explicit migration project — not a silent autogenerate.  
5. Application queries should already filter by time where possible to prune partitions.  

---

## 18. Backup Strategy

| Item | Standard |
|---|---|
| Primary method | PostgreSQL logical backups (`pg_dump`) and/or managed snapshots |
| Frequency | **Daily** minimum for production; before every risky migration |
| Retention | Keep at least 7–30 daily copies + monthly where capacity allows |
| Restore tests | Restore to a staging instance periodically — untested backups are assumptions |
| Secrets | Backups contain PII and password hashes — encrypt at rest and restrict access |
| Point-in-time | Prefer WAL archiving / PITR for production stores when available |
| Pre-deploy | Take a backup (or snapshot) before `alembic upgrade` in production |
| Electron local | If a local PG instance is used, document where dump files live on the Windows host |

### 18.1 RPO / RTO targets (recommended defaults)

| Metric | Recommended target |
|---|---|
| RPO (data loss tolerance) | ≤ 24 hours (better with PITR) |
| RTO (restore time) | ≤ 4 hours for a single-store deployment |

Adjust per customer SLA when Juman is deployed commercially.

---

## 19. Data Types Cheat Sheet

| Concept | Prefer |
|---|---|
| Ids | `UUID` |
| Flags | `BOOLEAN` |
| Status | `VARCHAR` + check/enum discipline **or** PostgreSQL `ENUM` (prefer string + check for easier evolution unless enum is truly closed) |
| Short labels | `VARCHAR(n)` with explicit n |
| Long text | `TEXT` |
| Money (IQD) | `BIGINT` integer amount (document unit) |
| Quantities (non-dress accessories) | `INTEGER` / `BIGINT` |
| Timestamps | `TIMESTAMPTZ` |
| Dates only | `DATE` |
| JSON documents | `JSONB` for flexible metadata — not a substitute for relational core |
| Soft delete | `BOOLEAN` + `TIMESTAMPTZ` |

---

## 20. Dress Asset Persistence Rules (Cross-Check)

From Dress Domain — database must uphold:

1. One row per physical dress asset.  
2. No `quantity` column meaning fungible dress stock.  
3. Barcode uniqueness via partial unique index among live rows.  
4. Status column aligns with [`docs/DRESS_STATE_MACHINE.md`](DRESS_STATE_MACHINE.md).  
5. All rentals/reservations/inspections/laundry/sales reference `dress_id` UUID.  
6. Optimistic locking recommended on dress rows for status transitions.  

---

## 21. Security and Privacy at Rest

1. Store only Argon2 password **hashes**, never plaintext.  
2. Refresh token tables store **hashes** of secrets when possible.  
3. Limit who can run raw SQL against production.  
4. Mask secrets in logs and exception `details`.  
5. Backups inherit the same confidentiality as the live database.  

---

## 22. Anti-Patterns (Rejected)

- Integer PKs for business entities  
- Hard-deleting rentals/payments/users/dresses to “clean up”  
- Hard `UNIQUE (barcode)` without a soft-delete strategy  
- Quantity-based dress inventory tables  
- Schema changes without Alembic  
- Startup `create_all` in production  
- Trusting the ORM alone without FK constraints  
- Long transactions spanning printer I/O or HTTP calls  
- Unbounded analytical queries on the OLTP primary during shop hours  

---

## 23. Implementation Checklist (Future Modules)

When a module is approved for implementation:

1. Model inherits `AuditedSoftDeleteModel` (unless a pure append-only log justifies a slimmer base — document exception).  
2. Table/column/constraint names follow §3.  
3. FKs + indexes + partial uniques declared in Alembic.  
4. Seeds (if any) are idempotent migration data.  
5. Repository respects soft-delete defaults.  
6. Contention-sensitive entities include `version` when required.  
7. No demo rows.  

---

## 24. Document Control

| Item | Value |
|---|---|
| Path | `docs/DATABASE_GUIDELINES.md` |
| Owner | Juman architecture |
| Related | Foundation mixins/repositories/Alembic, Dress Domain, Identity Rules, API Standards |
| Normative conflict | For UUID, soft delete, audit columns, migration/seed ownership, and partial-unique policy — **this document wins** until revised |

No schema or code is created by this document alone.

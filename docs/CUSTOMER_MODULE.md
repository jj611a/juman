# Customer Module — Juman (جمان)

**Document type:** Domain module design  
**Audience:** Backend implementers, Electron clients, future transaction modules  
**Status:** Implemented (v2 — numbered customers)  
**Scope:** Customer master data only — no reservations, rentals, sales, payments, loyalty, or statistics

---

## 1. Purpose

The Customer entity stores party contact and identity details used later by Reservations, Rentals, Sales, and Payments.

Those modules will hold a `customer_id` FK. **Customer never imports or knows about them.**

---

## 2. Package & permissions

```text
app/modules/customers/
  constants.py
  models/customer.py
  repositories/customer.py
  services/customer.py
  services/customer_number.py
  schemas/customer.py
  api/router.py          # /api/v1/customers
  dependencies.py
  validators.py
```

**RBAC keys (seeded, singular):** `customer.view` | `customer.create` | `customer.update` | `customer.delete`

(Plural `customers.*` is not used — matches project singular domain style.)

---

## 3. Schema

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `customer_number` | NOT NULL; format `CUS-00000001`; **immutable**; partial unique among live rows; lifetime uniqueness in service |
| `full_name` | Required |
| `phone` | Required; duplicates allowed |
| `alternative_phone` | Optional |
| `address`, `notes` | Optional text |
| `national_id` | Optional; digits-only length 8–20 |
| `gender` | Optional: `MALE` \| `FEMALE` \| `OTHER` |
| `birth_date` | Optional; not in the future |
| `is_active` | Soft business flag |
| audit + soft delete | `AuditedSoftDeleteModel` |

Migrations: `20260726_0013_customers`, `20260726_0016_customers_v2`.

---

## 4. Customer number

Settings:

| Key | Default |
|---|---|
| `customers.number.prefix` | `CUS` |
| `customers.number.separator` | `-` |
| `customers.number.padding` | `8` |

Algorithm (same pattern as dress barcodes): lock `barcode_counters` row for prefix → increment → skip collisions including soft-deleted → format `{prefix}{separator}{padded}`.

- Always auto-generated on create.  
- Never accepted on PATCH.  
- No regeneration / override API.  
- Soft-delete does not free the number for reuse.

---

## 5. API

| Method | Path | Auth |
|---|---|---|
| `GET` | `/customers` | `customer.view` |
| `GET` | `/customers/number/{customer_number}` | `customer.view` |
| `GET` | `/customers/{id}` | `customer.view` |
| `POST` | `/customers` | `customer.create` |
| `PATCH` | `/customers/{id}` | `customer.update` |
| `POST` | `/customers/{id}/activate` | `customer.update` |
| `POST` | `/customers/{id}/deactivate` | `customer.update` |
| `DELETE` | `/customers/{id}` | `customer.delete` |

**List:** `q` (number / name / phone / alt phone / national ID), `active_only`, `sort_by` (`customer_number` \| `full_name` \| `phone` \| `created_at`), `sort_dir`, pagination.

Audit: CREATE / UPDATE / ACTIVATE / DEACTIVATE / SOFT_DELETE (`module="customers"`, `entity_type="Customer"`).

---

## 6. Business rules

1. Full name and phone required.  
2. Duplicate phones allowed.  
3. Customer number immutable and unique for lifetime.  
4. Soft delete only; deactivate supported.  
5. No rental/reservation/sale/payment logic inside this module.

---

## 7. Future integrations (outbound only)

```text
Customer ◄── Reservation.customer_id
Customer ◄── Rental.customer_id
Customer ◄── Sale.customer_id
Customer ◄── Payment.customer_id
```

Those FKs live in the other modules when built.

---

## 8. Explicit non-goals

Loyalty points, customer statistics, number regeneration, printers/scanners, and any transaction workflows.

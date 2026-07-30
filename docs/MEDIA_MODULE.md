# Media Module — Juman (جمان)

**Document type:** Infrastructure module design (source of truth)  
**Audience:** Backend implementers, future module authors  
**Status:** Approved / implemented  
**Scope:** Generic file storage and opaque file references — no business domain knowledge  

---

## 1. Purpose

The Media module manages binary uploads used anywhere in the product:

- Dress photos, company logos, user avatars (callers own meaning)
- Barcode images, PDF reports, attachments, backups
- Any future blob

Media **never** knows what a Dress, User, Company, or Inventory item is.

---

## 2. Architecture

```text
app/modules/media/
  api/           Generic HTTP surface under /api/v1/media
  models/        StoredFile, FileReference
  repositories/
  services/      MediaService
  providers/     StorageProvider protocol + Local + cloud stubs
  schemas/
  dependencies.py
  constants.py
```

```text
Client → Media API → MediaService → Settings + Repositories + StorageProvider
                                  → PostgreSQL (metadata)
                                  → Local disk / future cloud (bytes)
```

### Independence rules

1. No imports of Inventory, Identity business services, Settings business keys beyond media config.  
2. No FK to `users`, `dresses`, or other domain tables.  
3. `module_name`, `entity_type`, `purpose` are opaque strings — not validated against catalogs.  
4. Future modules call Media; Media never calls them.

---

## 3. Provider abstraction

| Provider | Status |
|---|---|
| `local` | Implemented |
| `s3` | Stub (`NotImplementedError`) |
| `minio` | Stub |
| `azure` | Stub |
| `gcs` | Stub |

Protocol methods: `save`, `open`, `delete`, `exists`.

Local layout:

```text
{media_storage_root}/{yyyy}/{mm}/{uuid}.{ext}
```

Disk filename is UUID-based only. Original filename lives only in the database.

---

## 4. Data model

### StoredFile

Blob metadata: original/stored names, extension, MIME, size, SHA-256, provider, relative path, `is_public`, `uploaded_by`, audit + soft delete.

### FileReference

Polymorphic link: `stored_file_id` + opaque (`module_name`, `entity_type`, `entity_id`, `purpose`) + `display_order` + `is_primary`.

Ownership stays on the reference side — never on `StoredFile`.

---

## 5. Lifecycle

1. **Upload** — validate size/extension/MIME (from Settings) → SHA-256 → provider.save → insert `StoredFile`  
2. **Reference** — create `FileReference` with opaque strings  
3. **Download** — load metadata → provider.open stream  
4. **Replace** — upload new file, soft-delete previous file row + delete blob when replacing by id  
5. **Delete file** — soft-delete file + cascade soft-delete references + delete blob  
6. **Delete reference** — soft-delete link only  

Duplicate detection: hash is stored and indexed; **no auto-reuse** in v1.

---

## 6. Settings

| Key | Default |
|---|---|
| `media_storage_provider` | `local` |
| `media_storage_root` | `./storage/media` |
| `media_max_upload_bytes` | `10485760` |
| `media_allowed_extensions` | `jpg,jpeg,png,webp,pdf,gif` |
| `media_allowed_mime_types` | image/jpeg, image/png, image/webp, image/gif, application/pdf |

---

## 7. API & security

All endpoints under `/api/v1/media` require authentication and RBAC:

- `media.upload` / `media.view` / `media.delete` / `media.manage`

`is_public` is reserved for future CDN/public URLs; v1 still requires auth to download.

---

## 8. Future cloud storage

Swap provider via Settings without changing callers. Stub classes document the interface for S3, MinIO, Azure Blob, and GCS.

---

## 9. Related

- [`docs/API_STANDARDS.md`](API_STANDARDS.md) — multipart uploads  
- [`docs/DATABASE_GUIDELINES.md`](DATABASE_GUIDELINES.md) — UUID, soft delete, audit  
- Identity RBAC for permission enforcement  

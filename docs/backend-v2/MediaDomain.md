# Backend V2 Media Domain (Phase 3.3)

**Branch:** `backend-v2`  
**Module:** `backend-node/src/media`  
**Role:** Single source of truth for every file stored by Juman.

## Scope

Generic media management ? images, PDFs, Office docs, text/CSV.  
No inventory/customer/rental business logic. Future modules store **Media IDs** only and attach via `MediaReference`.

## Storage layout

Configured root: `{JUMAN_DATA_DIR}/storage` (never hard-coded).

```
storage/
  images/
  documents/
  temp/
  thumbnails/   # reserved (no generation yet)
  imports/
  exports/
```

Blob relative keys: `{category}/{yyyy}/{mm}/{uuid}.{ext}`.

## Model

`MediaFile` ? UUID, original/stored filename, extension, MIME, sizeBytes, sha256Hash (checksum), width/height/orientation, relativePath, kind, soft-delete + actors.

`MediaReference` ? polymorphic link (`moduleName`, `entityType`, `entityId`, `purpose`) ? no per-domain attachment tables.

## Service API

`save` ? `delete` ? `restore` ? `find` ? `findMany` ? `verifyIntegrity` ? `exists` ? `calculateChecksum` ? `attach` / `listAttachments`

Soft delete **keeps** blobs so restore works. Integrity failures are audited.

## HTTP

| Method | Path | Permission |
|--------|------|------------|
| POST | /media | media.upload |
| GET | /media | media.view |
| GET | /media/:id | media.view |
| GET | /media/:id/integrity | media.view |
| DELETE | /media/:id | media.delete |
| POST | /media/:id/restore | media.restore |

Responses never include absolute filesystem paths (checksum exposed as `checksum`).

## Security

Rejects path traversal, hidden names, double dangerous extensions, executables, MIME/extension mismatch, magic-byte spoofing, oversized uploads.

## Coverage

```bash
pnpm test:cov:media
```

## Restore contract

Soft-delete cascades soft-delete of `MediaReference` rows. **Restore of a `MediaFile` does not automatically revive those references** ? callers must re-attach.

## Known limitations

- Thumbnails / camera / cloud providers not implemented (architecture reserved).
- Download streaming endpoint deferred (metadata + integrity only on HTTP for now; `LocalStorageProvider.openReadStream` ready).
- Orientation only extracted for JPEG EXIF when present.

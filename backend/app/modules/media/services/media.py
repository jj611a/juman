"""MediaService — orchestration for uploads, downloads, and references."""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import BinaryIO
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AppException, NotFoundError, ValidationError
from app.modules.media.constants import (
    DEFAULT_ALLOWED_EXTENSIONS,
    DEFAULT_ALLOWED_MIME_TYPES,
    DEFAULT_MAX_UPLOAD_BYTES,
    DEFAULT_STORAGE_ROOT,
    StorageProviderName,
)
from app.modules.media.models.file_reference import FileReference
from app.modules.media.models.stored_file import StoredFile
from app.modules.media.providers import get_storage_provider
from app.modules.media.providers.base import StorageProvider
from app.modules.media.repositories.file_reference import FileReferenceRepository
from app.modules.media.repositories.stored_file import StoredFileRepository
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.utils.datetime import utc_now

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class UploadPayload:
    """Validated in-memory upload before persistence."""

    original_filename: str
    content_type: str | None
    data: bytes


@dataclass(frozen=True, slots=True)
class DownloadResult:
    """Metadata plus open stream for a download."""

    file: StoredFile
    stream: BinaryIO


class MediaService:
    """Business-agnostic media orchestration."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        settings: SettingService | None = None,
        provider: StorageProvider | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or SettingService(session)
        self.files = StoredFileRepository(session)
        self.references = FileReferenceRepository(session)
        self._provider = provider

    async def _resolve_provider(self) -> StorageProvider:
        if self._provider is not None:
            return self._provider
        name = await self._setting_string(
            SettingKey.MEDIA_STORAGE_PROVIDER.value,
            StorageProviderName.LOCAL.value,
        )
        root = await self._setting_string(
            SettingKey.MEDIA_STORAGE_ROOT.value,
            DEFAULT_STORAGE_ROOT,
        )
        return get_storage_provider(name, storage_root=root)

    async def _setting_string(self, key: str, default: str) -> str:
        try:
            return await self.settings.get_string(key)
        except AppException:
            return default

    async def _setting_int(self, key: str, default: int) -> int:
        try:
            return await self.settings.get_int(key)
        except AppException:
            return default

    async def _allowed_extensions(self) -> set[str]:
        raw = await self._setting_string(
            SettingKey.MEDIA_ALLOWED_EXTENSIONS.value,
            DEFAULT_ALLOWED_EXTENSIONS,
        )
        return {part.strip().lower().lstrip(".") for part in raw.split(",") if part.strip()}

    async def _allowed_mime_types(self) -> set[str]:
        raw = await self._setting_string(
            SettingKey.MEDIA_ALLOWED_MIME_TYPES.value,
            DEFAULT_ALLOWED_MIME_TYPES,
        )
        return {part.strip().lower() for part in raw.split(",") if part.strip()}

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        """Return hex SHA-256 digest for ``data``."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def build_relative_path(ext: str, *, file_id: UUID | None = None) -> str:
        """Build `{yyyy}/{mm}/{uuid}.{ext}` relative path."""
        now = datetime.now(UTC)
        clean_ext = ext.lower().lstrip(".")
        name = f"{file_id or uuid4()}.{clean_ext}" if clean_ext else str(file_id or uuid4())
        return f"{now.year:04d}/{now.month:02d}/{name}"

    @staticmethod
    def _extension_from_filename(filename: str) -> str:
        suffix = PurePosixPath(filename.replace("\\", "/")).suffix
        return suffix.lstrip(".").lower()

    async def _validate_upload(self, upload: UploadPayload) -> tuple[str, str]:
        max_bytes = await self._setting_int(
            SettingKey.MEDIA_MAX_UPLOAD_BYTES.value,
            DEFAULT_MAX_UPLOAD_BYTES,
        )
        if len(upload.data) == 0:
            raise ValidationError("الملف فارغ", details={"field": "file"})
        if len(upload.data) > max_bytes:
            raise ValidationError(
                "حجم الملف يتجاوز الحد المسموح",
                details={"max_bytes": max_bytes, "size_bytes": len(upload.data)},
            )

        extension = self._extension_from_filename(upload.original_filename)
        allowed_ext = await self._allowed_extensions()
        if not extension or extension not in allowed_ext:
            raise ValidationError(
                "امتداد الملف غير مسموح",
                details={"extension": extension, "allowed": sorted(allowed_ext)},
            )

        mime = (upload.content_type or "").split(";")[0].strip().lower()
        allowed_mime = await self._allowed_mime_types()
        if not mime or mime not in allowed_mime:
            raise ValidationError(
                "نوع الملف غير مسموح",
                details={"mime_type": mime, "allowed": sorted(allowed_mime)},
            )
        return extension, mime

    async def upload_file(
        self,
        upload: UploadPayload,
        *,
        uploaded_by: UUID | None = None,
        is_public: bool = False,
    ) -> StoredFile:
        """Validate, hash, store, and persist a new StoredFile."""
        extension, mime = await self._validate_upload(upload)
        digest = self.compute_sha256(upload.data)
        duplicates = await self.files.find_by_sha256(digest)
        if duplicates:
            logger.info(
                "media_duplicate_hash_detected",
                extra={"sha256_hash": digest, "existing_count": len(duplicates)},
            )

        file_id = uuid4()
        relative_path = self.build_relative_path(extension, file_id=file_id)
        stored_filename = PurePosixPath(relative_path).name
        provider = await self._resolve_provider()
        provider_name = await self._setting_string(
            SettingKey.MEDIA_STORAGE_PROVIDER.value,
            StorageProviderName.LOCAL.value,
        )
        provider.save(relative_path, upload.data)

        entity = StoredFile(
            id=file_id,
            original_filename=upload.original_filename[:500],
            stored_filename=stored_filename,
            extension=extension,
            mime_type=mime,
            size_bytes=len(upload.data),
            sha256_hash=digest,
            storage_provider=provider_name.strip().lower(),
            relative_path=relative_path,
            is_public=is_public,
            uploaded_by=uploaded_by,
            created_by=uploaded_by,
            updated_by=uploaded_by,
        )
        return await self.files.add(entity)

    async def get_metadata(self, file_id: UUID) -> StoredFile:
        """Return StoredFile metadata or raise NotFoundError."""
        entity = await self.files.get_active(file_id)
        if entity is None:
            raise NotFoundError("الملف غير موجود", details={"file_id": str(file_id)})
        return entity

    async def download_file(self, file_id: UUID) -> DownloadResult:
        """Open a stream for the given stored file."""
        entity = await self.get_metadata(file_id)
        provider = await self._resolve_provider()
        if not provider.exists(entity.relative_path):
            raise NotFoundError(
                "محتوى الملف غير موجود في التخزين",
                details={"file_id": str(file_id)},
            )
        return DownloadResult(file=entity, stream=provider.open(entity.relative_path))

    async def delete_file(
        self,
        file_id: UUID,
        *,
        deleted_by: UUID | None = None,
    ) -> None:
        """Soft-delete a file, cascade soft-delete references, delete blob."""
        entity = await self.get_metadata(file_id)
        refs = await self.references.list_by_stored_file(file_id)
        for ref in refs:
            await self.references.delete(ref, deleted_by=deleted_by)

        provider = await self._resolve_provider()
        try:
            provider.delete(entity.relative_path)
        except Exception:
            logger.exception(
                "media_blob_delete_failed",
                extra={"relative_path": entity.relative_path},
            )
        await self.files.delete(entity, deleted_by=deleted_by)

    async def replace_file(
        self,
        file_id: UUID,
        upload: UploadPayload,
        *,
        updated_by: UUID | None = None,
    ) -> StoredFile:
        """
        Replace bytes for an existing StoredFile id (in-place metadata update).

        Old blob is deleted from the provider after the new blob is saved.
        """
        entity = await self.get_metadata(file_id)
        extension, mime = await self._validate_upload(upload)
        digest = self.compute_sha256(upload.data)
        old_path = entity.relative_path
        relative_path = self.build_relative_path(extension, file_id=file_id)
        stored_filename = PurePosixPath(relative_path).name
        provider = await self._resolve_provider()
        provider_name = await self._setting_string(
            SettingKey.MEDIA_STORAGE_PROVIDER.value,
            StorageProviderName.LOCAL.value,
        )
        provider.save(relative_path, upload.data)
        if old_path != relative_path:
            try:
                provider.delete(old_path)
            except Exception:
                logger.exception(
                    "media_old_blob_delete_failed",
                    extra={"relative_path": old_path},
                )

        return await self.files.update_fields(
            entity,
            original_filename=upload.original_filename[:500],
            stored_filename=stored_filename,
            extension=extension,
            mime_type=mime,
            size_bytes=len(upload.data),
            sha256_hash=digest,
            storage_provider=provider_name.strip().lower(),
            relative_path=relative_path,
            updated_by=updated_by,
            updated_at=utc_now(),
        )

    async def create_reference(
        self,
        *,
        stored_file_id: UUID,
        module_name: str,
        entity_type: str,
        entity_id: UUID,
        purpose: str,
        display_order: int = 0,
        is_primary: bool = False,
        created_by: UUID | None = None,
    ) -> FileReference:
        """Create an opaque FileReference to an existing StoredFile."""
        await self.get_metadata(stored_file_id)
        if not module_name.strip() or not entity_type.strip() or not purpose.strip():
            raise ValidationError(
                "بيانات المرجع غير مكتملة",
                details={
                    "module_name": module_name,
                    "entity_type": entity_type,
                    "purpose": purpose,
                },
            )
        ref = FileReference(
            stored_file_id=stored_file_id,
            module_name=module_name.strip(),
            entity_type=entity_type.strip(),
            entity_id=entity_id,
            purpose=purpose.strip(),
            display_order=display_order,
            is_primary=is_primary,
            created_by=created_by,
            updated_by=created_by,
        )
        return await self.references.add(ref)

    async def get_reference(self, reference_id: UUID) -> FileReference:
        """Return a FileReference or raise NotFoundError."""
        entity = await self.references.get_by_id(reference_id)
        if entity is None:
            raise NotFoundError(
                "مرجع الملف غير موجود",
                details={"reference_id": str(reference_id)},
            )
        return entity

    async def list_references(
        self,
        *,
        module_name: str | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        purpose: str | None = None,
        stored_file_id: UUID | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[FileReference], int]:
        """List references with optional opaque filters."""
        return await self.references.list_filtered(
            module_name=module_name,
            entity_type=entity_type,
            entity_id=entity_id,
            purpose=purpose,
            stored_file_id=stored_file_id,
            offset=offset,
            limit=limit,
        )

    async def update_reference(
        self,
        reference_id: UUID,
        *,
        purpose: str | None = None,
        display_order: int | None = None,
        is_primary: bool | None = None,
        updated_by: UUID | None = None,
    ) -> FileReference:
        """Patch mutable reference fields."""
        entity = await self.get_reference(reference_id)
        fields: dict[str, object] = {"updated_by": updated_by, "updated_at": utc_now()}
        if purpose is not None:
            if not purpose.strip():
                raise ValidationError("الغرض غير صالح", details={"purpose": purpose})
            fields["purpose"] = purpose.strip()
        if display_order is not None:
            fields["display_order"] = display_order
        if is_primary is not None:
            fields["is_primary"] = is_primary
        return await self.references.update_fields(entity, **fields)

    async def delete_reference(
        self,
        reference_id: UUID,
        *,
        deleted_by: UUID | None = None,
    ) -> None:
        """Soft-delete a reference only (StoredFile remains)."""
        entity = await self.get_reference(reference_id)
        await self.references.delete(entity, deleted_by=deleted_by)

    async def replace_reference_file(
        self,
        reference_id: UUID,
        upload: UploadPayload,
        *,
        updated_by: UUID | None = None,
    ) -> tuple[FileReference, StoredFile]:
        """
        Upload a new StoredFile, repoint the reference, soft-delete the previous file
        when it becomes unreferenced.
        """
        ref = await self.get_reference(reference_id)
        previous_file_id = ref.stored_file_id
        new_file = await self.upload_file(upload, uploaded_by=updated_by)
        await self.references.update_fields(
            ref,
            stored_file_id=new_file.id,
            updated_by=updated_by,
            updated_at=utc_now(),
        )
        remaining = await self.references.list_by_stored_file(previous_file_id)
        if not remaining:
            await self.delete_file(previous_file_id, deleted_by=updated_by)
        refreshed = await self.get_reference(reference_id)
        return refreshed, new_file

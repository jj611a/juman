"""DressPhotoService — gallery attach, cover, reorder (Media references only)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.models.dress_photo import DressPhoto
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.inventory.repositories.dress_photo import DressPhotoRepository
from app.modules.media.models.stored_file import StoredFile
from app.modules.media.repositories.stored_file import StoredFileRepository
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import utc_now


def _snapshot(photo: DressPhoto) -> dict[str, Any]:
    return {
        "dress_id": str(photo.dress_id),
        "stored_file_id": str(photo.stored_file_id),
        "display_order": photo.display_order,
        "is_cover": photo.is_cover,
        "caption": photo.caption,
    }


class DressPhotoService(BaseService):
    """Manage dress photo references without owning file storage."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        photos: DressPhotoRepository | None = None,
        dresses: DressRepository | None = None,
        files: StoredFileRepository | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.photos = photos or DressPhotoRepository(session)
        self.dresses = dresses or DressRepository(session)
        self.files = files or StoredFileRepository(session)
        self.settings = settings or SettingService(session)
        self.audit = audit or AuditService(session)

    async def _require_dress(self, dress_id: UUID) -> None:
        dress = await self.dresses.get_by_id(dress_id)
        if dress is None:
            raise NotFoundError("الفستان غير موجود")

    async def _require_image_file(self, stored_file_id: UUID) -> StoredFile:
        stored = await self.files.get_active(stored_file_id)
        if stored is None:
            raise NotFoundError("الملف غير موجود")
        allowed_raw = await self.settings.get_string(SettingKey.MEDIA_ALLOWED_MIME_TYPES.value)
        allowed = {
            part.strip().lower()
            for part in allowed_raw.split(",")
            if part.strip() and part.strip().lower().startswith("image/")
        }
        mime = stored.mime_type.strip().lower()
        if not mime.startswith("image/") or mime not in allowed:
            raise ValidationError(
                "نوع الملف ليس صورة مسموحة",
                details={"field": "stored_file_id", "mime_type": stored.mime_type},
            )
        return stored

    async def get_photo(self, photo_id: UUID) -> DressPhoto:
        """Return a live dress photo or raise NotFoundError."""
        photo = await self.photos.get_by_id(photo_id)
        if photo is None:
            raise NotFoundError("صورة الفستان غير موجودة")
        return photo

    async def list_photos(self, dress_id: UUID) -> list[DressPhoto]:
        """List live photos for a dress."""
        await self._require_dress(dress_id)
        return await self.photos.list_for_dress(dress_id)

    async def add_photo(
        self,
        dress_id: UUID,
        *,
        stored_file_id: UUID,
        caption: str | None = None,
        is_cover: bool = False,
        display_order: int | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> DressPhoto:
        """Attach an existing Media file as a dress photo."""
        await self._require_dress(dress_id)
        await self._require_image_file(stored_file_id)

        existing = await self.photos.get_by_dress_and_file(dress_id, stored_file_id)
        if existing is not None:
            raise ConflictError("هذه الصورة مرتبطة بالفستان مسبقاً")

        if display_order is None:
            max_order = await self.photos.max_display_order(dress_id)
            order = 0 if max_order is None else max_order + 1
        else:
            if display_order < 0:
                raise ValidationError(
                    "ترتيب العرض يجب أن يكون صفر أو أكثر",
                    details={"field": "display_order"},
                )
            order = display_order

        caption_value = None
        if caption is not None:
            stripped = caption.strip()
            caption_value = stripped or None
            if caption_value is not None and len(caption_value) > 500:
                raise ValidationError("التعليق أطول من الحد المسموح", details={"field": "caption"})

        if is_cover:
            await self.photos.clear_cover_for_dress(dress_id, actor_id=actor_id)

        photo = DressPhoto(
            dress_id=dress_id,
            stored_file_id=stored_file_id,
            display_order=order,
            is_cover=is_cover,
            caption=caption_value,
            created_by=actor_id,
            updated_by=actor_id,
        )
        photo = await self.photos.add(photo)
        await self.audit.record(
            module="inventory",
            entity_type="DressPhoto",
            entity_id=photo.id,
            action=AuditAction.PHOTO_ADDED,
            new_values=_snapshot(photo),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return photo

    async def update_photo(
        self,
        photo_id: UUID,
        *,
        caption: str | None = None,
        display_order: int | None = None,
        is_cover: bool | None = None,
        clear_caption: bool = False,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> DressPhoto:
        """Update caption, order, or cover flag."""
        photo = await self.get_photo(photo_id)
        old_values = _snapshot(photo)
        fields: dict[str, object] = {
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if clear_caption:
            fields["caption"] = None
        elif caption is not None:
            stripped = caption.strip()
            value = stripped or None
            if value is not None and len(value) > 500:
                raise ValidationError("التعليق أطول من الحد المسموح", details={"field": "caption"})
            fields["caption"] = value
        if display_order is not None:
            if display_order < 0:
                raise ValidationError(
                    "ترتيب العرض يجب أن يكون صفر أو أكثر",
                    details={"field": "display_order"},
                )
            fields["display_order"] = display_order
        if is_cover is True:
            await self.photos.clear_cover_for_dress(
                photo.dress_id,
                exclude_id=photo.id,
                actor_id=actor_id,
            )
            fields["is_cover"] = True
        elif is_cover is False:
            fields["is_cover"] = False

        photo = await self.photos.update_fields(photo, **fields)
        await self.audit.record_update(
            module="inventory",
            entity_type="DressPhoto",
            entity_id=photo.id,
            old_values=old_values,
            new_values=_snapshot(photo),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        if is_cover is True:
            await self.audit.record(
                module="inventory",
                entity_type="Dress",
                entity_id=photo.dress_id,
                action=AuditAction.COVER_CHANGED,
                new_values={"cover_photo_id": str(photo.id)},
                user_id=actor_id,
                username=actor_username,
                ip_address=ip_address,
            )
        return photo

    async def remove_photo(
        self,
        photo_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Soft-delete a dress photo reference (StoredFile untouched)."""
        photo = await self.get_photo(photo_id)
        old_values = _snapshot(photo)
        await self.photos.delete(photo, deleted_by=actor_id)
        await self.audit.record(
            module="inventory",
            entity_type="DressPhoto",
            entity_id=photo_id,
            action=AuditAction.PHOTO_REMOVED,
            old_values=old_values,
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )

    async def reorder_photos(
        self,
        dress_id: UUID,
        *,
        photo_ids: list[UUID],
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> list[DressPhoto]:
        """Assign display_order 0..n-1 from an exact list of live photo ids."""
        await self._require_dress(dress_id)
        current = await self.photos.list_for_dress(dress_id)
        current_ids = {item.id for item in current}
        if len(photo_ids) != len(set(photo_ids)):
            raise ValidationError("قائمة الصور تحتوي على تكرار")
        if set(photo_ids) != current_ids:
            raise ValidationError(
                "قائمة إعادة الترتيب يجب أن تطابق صور الفستان الحالية",
                details={"expected_count": len(current_ids), "received_count": len(photo_ids)},
            )
        by_id = {item.id: item for item in current}
        for index, photo_id in enumerate(photo_ids):
            await self.photos.update_fields(
                by_id[photo_id],
                display_order=index,
                updated_by=actor_id,
                updated_at=utc_now(),
            )
        await self.audit.record(
            module="inventory",
            entity_type="Dress",
            entity_id=dress_id,
            action=AuditAction.GALLERY_REORDERED,
            new_values={"photo_ids": [str(pid) for pid in photo_ids]},
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return await self.photos.list_for_dress(dress_id)

    async def set_cover(
        self,
        dress_id: UUID,
        *,
        photo_id: UUID,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> DressPhoto:
        """Mark one photo as the dress cover."""
        await self._require_dress(dress_id)
        photo = await self.get_photo(photo_id)
        if photo.dress_id != dress_id:
            raise ValidationError("الصورة لا تنتمي إلى هذا الفستان")
        previous = next((p for p in await self.photos.list_for_dress(dress_id) if p.is_cover), None)
        await self.photos.clear_cover_for_dress(dress_id, actor_id=actor_id)
        photo = await self.photos.update_fields(
            photo,
            is_cover=True,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="inventory",
            entity_type="Dress",
            entity_id=dress_id,
            action=AuditAction.COVER_CHANGED,
            old_values={"cover_photo_id": str(previous.id) if previous else None},
            new_values={"cover_photo_id": str(photo.id)},
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return photo

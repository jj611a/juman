"""Concrete Phase 4 maintenance tasks (verify + cleanup)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.models.dress_calendar_block import DressCalendarBlock
from app.modules.identity.models import LoginSession, RefreshToken
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.models import Dress
from app.modules.media.models import FileReference, StoredFile
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import MaintenanceTaskCategory, MaintenanceTaskId
from app.modules.system_admin.maintenance.base import BaseMaintenanceTask, MaintenanceResult
from app.modules.system_admin.services.backup_package import confined_path
from app.utils.datetime import utc_now


class CleanupSessionsTask(BaseMaintenanceTask):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            task_id=MaintenanceTaskId.CLEANUP_SESSIONS.value,
            title="تنظيف الجلسات",
            description="إزالة جلسات وتوكنات منتهية الصلاحية",
            category=MaintenanceTaskCategory.CLEANUP.value,
            requires_confirmation=True,
        )
        self.session = session

    async def _candidates(self) -> tuple[list[LoginSession], list[RefreshToken]]:
        now = utc_now()
        sessions = list(
            (
                await self.session.execute(
                    select(LoginSession).where(
                        LoginSession.is_deleted.is_(False),
                        LoginSession.expires_at <= now,
                    )
                )
            ).scalars().all()
        )
        tokens = list(
            (
                await self.session.execute(
                    select(RefreshToken).where(
                        RefreshToken.is_deleted.is_(False),
                        RefreshToken.expires_at <= now,
                    )
                )
            ).scalars().all()
        )
        return sessions, tokens

    async def dry_run(self) -> MaintenanceResult:
        sessions, tokens = await self._candidates()
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message=f"سيتم تنظيف {len(sessions)} جلسة و {len(tokens)} توكن",
            details={"sessions": len(sessions), "tokens": len(tokens)},
            objects_checked=len(sessions) + len(tokens),
            objects_modified=0,
        )

    async def execute(self) -> MaintenanceResult:
        sessions, tokens = await self._candidates()
        now = utc_now()
        for row in sessions:
            row.is_deleted = True
            row.deleted_at = now
            if row.revoked_at is None:
                row.revoked_at = now
        for row in tokens:
            row.is_deleted = True
            row.deleted_at = now
            if row.revoked_at is None:
                row.revoked_at = now
        await self.session.flush()
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message=f"تم تنظيف {len(sessions)} جلسة و {len(tokens)} توكن",
            details={"sessions": len(sessions), "tokens": len(tokens)},
            objects_checked=len(sessions) + len(tokens),
            objects_modified=len(sessions) + len(tokens),
        )


class CleanupOrphanMediaReferencesTask(BaseMaintenanceTask):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            task_id=MaintenanceTaskId.CLEANUP_ORPHAN_MEDIA_REFERENCES.value,
            title="تنظيف مراجع الوسائط اليتيمة",
            description="حذف مراجع وملفات وسائط غير المرتبطة بسجلات نشطة",
            category=MaintenanceTaskCategory.CLEANUP.value,
            requires_confirmation=True,
        )
        self.session = session

    async def _find(self) -> tuple[list[StoredFile], list[FileReference]]:
        files = list(
            (
                await self.session.execute(
                    select(StoredFile).where(StoredFile.is_deleted.is_(False))
                )
            ).scalars().all()
        )
        orphan_files: list[StoredFile] = []
        for sf in files:
            count = int(
                (
                    await self.session.execute(
                        select(func.count())
                        .select_from(FileReference)
                        .where(
                            FileReference.is_deleted.is_(False),
                            FileReference.stored_file_id == sf.id,
                        )
                    )
                ).scalar_one()
            )
            if count == 0:
                orphan_files.append(sf)

        refs = list(
            (
                await self.session.execute(
                    select(FileReference).where(FileReference.is_deleted.is_(False))
                )
            ).scalars().all()
        )
        broken_refs: list[FileReference] = []
        for ref in refs:
            sf = await self.session.get(StoredFile, ref.stored_file_id)
            if sf is None or sf.is_deleted:
                broken_refs.append(ref)
        return orphan_files, broken_refs

    async def dry_run(self) -> MaintenanceResult:
        orphans, broken = await self._find()
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message=f"سيتم تنظيف {len(orphans)} ملف و {len(broken)} مرجع",
            details={"orphan_files": len(orphans), "broken_references": len(broken)},
            objects_checked=len(orphans) + len(broken),
        )

    async def execute(self) -> MaintenanceResult:
        orphans, broken = await self._find()
        now = utc_now()
        for ref in broken:
            ref.is_deleted = True
            ref.deleted_at = now
        for sf in orphans:
            sf.is_deleted = True
            sf.deleted_at = now
        await self.session.flush()
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message=f"تم تنظيف {len(orphans)} ملف و {len(broken)} مرجع",
            details={"orphan_files": len(orphans), "broken_references": len(broken)},
            objects_checked=len(orphans) + len(broken),
            objects_modified=len(orphans) + len(broken),
        )


class CleanupOrphanMediaFilesTask(BaseMaintenanceTask):
    def __init__(self, session: AsyncSession, *, settings_service: SettingService) -> None:
        super().__init__(
            task_id=MaintenanceTaskId.CLEANUP_ORPHAN_MEDIA_FILES.value,
            title="تنظيف ملفات الوسائط غير المرتبطة",
            description="حذف ملفات القرص غير المسجلة في قاعدة البيانات",
            category=MaintenanceTaskCategory.CLEANUP.value,
            requires_confirmation=True,
        )
        self.session = session
        self.settings_service = settings_service

    async def _scan(self) -> tuple[Path, list[Path]]:
        raw = await self.settings_service.get_string(SettingKey.MEDIA_STORAGE_ROOT.value)
        root = Path(raw).expanduser().resolve()
        known = {
            str(r[0]).replace("\\", "/")
            for r in (
                await self.session.execute(
                    select(StoredFile.relative_path).where(StoredFile.is_deleted.is_(False))
                )
            ).all()
        }
        orphans: list[Path] = []
        if not root.is_dir():
            return root, orphans
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.name.startswith(".juman_"):
                continue
            try:
                rel = path.relative_to(root).as_posix()
            except ValueError:
                continue
            if rel not in known:
                orphans.append(path)
        return root, orphans

    async def dry_run(self) -> MaintenanceResult:
        root, orphans = await self._scan()
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message=f"سيتم حذف {len(orphans)} ملف من القرص",
            details={"root": str(root), "orphan_disk_files": len(orphans)},
            objects_checked=len(orphans),
        )

    async def execute(self) -> MaintenanceResult:
        root, orphans = await self._scan()
        deleted = 0
        for path in orphans:
            try:
                confined = confined_path(root, path.relative_to(root).as_posix())
                confined.unlink(missing_ok=True)
                deleted += 1
            except Exception:  # noqa: BLE001
                continue
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message=f"تم حذف {deleted} ملف من القرص",
            details={"root": str(root), "deleted": deleted},
            objects_checked=len(orphans),
            objects_modified=deleted,
        )


class VerifyMediaIntegrityTask(BaseMaintenanceTask):
    def __init__(self, session: AsyncSession, *, settings_service: SettingService) -> None:
        super().__init__(
            task_id=MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value,
            title="التحقق من سلامة الوسائط",
            description="مقارنة سجلات الوسائط مع ملفات القرص",
            category=MaintenanceTaskCategory.VERIFICATION.value,
            requires_confirmation=False,
        )
        self.session = session
        self.settings_service = settings_service

    async def dry_run(self) -> MaintenanceResult:
        return await self.execute()

    async def execute(self) -> MaintenanceResult:
        raw = await self.settings_service.get_string(SettingKey.MEDIA_STORAGE_ROOT.value)
        root = Path(raw).expanduser().resolve()
        files = list(
            (
                await self.session.execute(
                    select(StoredFile).where(StoredFile.is_deleted.is_(False))
                )
            ).scalars().all()
        )
        missing_on_disk = 0
        zero_refs = 0
        for sf in files:
            path = root / sf.relative_path
            if not path.is_file():
                missing_on_disk += 1
            count = int(
                (
                    await self.session.execute(
                        select(func.count())
                        .select_from(FileReference)
                        .where(
                            FileReference.is_deleted.is_(False),
                            FileReference.stored_file_id == sf.id,
                        )
                    )
                ).scalar_one()
            )
            if count == 0:
                zero_refs += 1
        findings = {
            "stored_files": len(files),
            "missing_on_disk": missing_on_disk,
            "zero_reference_files": zero_refs,
        }
        ok = missing_on_disk == 0
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message="الوسائط سليمة" if ok else "تم اكتشاف مشكلات في الوسائط",
            details=findings,
            objects_checked=len(files),
            warnings=[] if ok else ["توجد ملفات مسجلة غير موجودة على القرص"],
        )


class VerifyCalendarConsistencyTask(BaseMaintenanceTask):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            task_id=MaintenanceTaskId.VERIFY_CALENDAR_CONSISTENCY.value,
            title="التحقق من اتساق التقويم",
            description="مقارنة حالات الفساتين مع كتل التقويم النشطة",
            category=MaintenanceTaskCategory.VERIFICATION.value,
            requires_confirmation=False,
        )
        self.session = session

    async def dry_run(self) -> MaintenanceResult:
        return await self.execute()

    async def execute(self) -> MaintenanceResult:
        dresses = list(
            (
                await self.session.execute(select(Dress).where(Dress.is_deleted.is_(False)))
            ).scalars().all()
        )
        mismatches: list[dict[str, Any]] = []
        now = utc_now()
        for dress in dresses:
            blocks = list(
                (
                    await self.session.execute(
                        select(DressCalendarBlock).where(
                            DressCalendarBlock.is_deleted.is_(False),
                            DressCalendarBlock.dress_id == dress.id,
                            DressCalendarBlock.end_at > now,
                        )
                    )
                ).scalars().all()
            )
            types = {b.block_type for b in blocks}
            status = dress.status
            if status == DressStatus.RENTED.value and CalendarBlockType.RENTAL.value not in types:
                mismatches.append({"dress_id": str(dress.id), "issue": "rented_without_rental_block"})
            if status == DressStatus.RESERVED.value and CalendarBlockType.RESERVATION.value not in types:
                mismatches.append({"dress_id": str(dress.id), "issue": "reserved_without_reservation_block"})
            if status == DressStatus.PROCESSING.value and CalendarBlockType.PROCESSING.value not in types:
                mismatches.append({"dress_id": str(dress.id), "issue": "processing_without_processing_block"})
            if status == DressStatus.AVAILABLE.value and types & {
                CalendarBlockType.RENTAL.value,
                CalendarBlockType.RESERVATION.value,
                CalendarBlockType.PROCESSING.value,
            }:
                mismatches.append({"dress_id": str(dress.id), "issue": "available_with_busy_blocks"})
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message="التقويم متسق" if not mismatches else f"تم العثور على {len(mismatches)} تعارض",
            details={"mismatches": mismatches[:100], "mismatch_count": len(mismatches)},
            objects_checked=len(dresses),
            warnings=[m["issue"] for m in mismatches[:20]],
        )


class VerifyDressStatusConsistencyTask(BaseMaintenanceTask):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            task_id=MaintenanceTaskId.VERIFY_DRESS_STATUS_CONSISTENCY.value,
            title="التحقق من حالات الفساتين",
            description="اكتشاف حالات غير صالحة أو مهملة",
            category=MaintenanceTaskCategory.VERIFICATION.value,
            requires_confirmation=False,
        )
        self.session = session

    async def dry_run(self) -> MaintenanceResult:
        return await self.execute()

    async def execute(self) -> MaintenanceResult:
        allowed = {s.value for s in DressStatus}
        dresses = list(
            (
                await self.session.execute(select(Dress).where(Dress.is_deleted.is_(False)))
            ).scalars().all()
        )
        invalid = []
        returned = []
        for d in dresses:
            if d.status not in allowed:
                invalid.append({"dress_id": str(d.id), "status": d.status})
            elif d.status == DressStatus.RETURNED.value:
                returned.append(str(d.id))
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message="حالات الفساتين سليمة" if not invalid else f"حالات غير صالحة: {len(invalid)}",
            details={
                "invalid_status_count": len(invalid),
                "invalid": invalid[:50],
                "returned_legacy_count": len(returned),
            },
            objects_checked=len(dresses),
            warnings=["حالات غير صالحة"] if invalid else [],
        )


class VerifyForeignReferenceIntegrityTask(BaseMaintenanceTask):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            task_id=MaintenanceTaskId.VERIFY_FOREIGN_REFERENCE_INTEGRITY.value,
            title="التحقق من سلامة المراجع",
            description="البحث عن مراجع وسائط تشير إلى كيانات مفقودة",
            category=MaintenanceTaskCategory.VERIFICATION.value,
            requires_confirmation=False,
        )
        self.session = session

    async def dry_run(self) -> MaintenanceResult:
        return await self.execute()

    async def execute(self) -> MaintenanceResult:
        refs = list(
            (
                await self.session.execute(
                    select(FileReference).where(FileReference.is_deleted.is_(False))
                )
            ).scalars().all()
        )
        broken = 0
        samples: list[dict[str, Any]] = []
        for ref in refs:
            sf = await self.session.get(StoredFile, ref.stored_file_id)
            if sf is None or sf.is_deleted:
                broken += 1
                if len(samples) < 50:
                    samples.append(
                        {
                            "reference_id": str(ref.id),
                            "stored_file_id": str(ref.stored_file_id),
                            "module_name": ref.module_name,
                            "entity_type": ref.entity_type,
                            "entity_id": str(ref.entity_id),
                        }
                    )
                continue
            # entity existence check for inventory dress photos
            if ref.module_name == "inventory" and ref.entity_type in {"dress", "Dress"}:
                dress = await self.session.get(Dress, ref.entity_id)
                if dress is None or dress.is_deleted:
                    broken += 1
                    if len(samples) < 50:
                        samples.append(
                            {
                                "reference_id": str(ref.id),
                                "issue": "missing_dress",
                                "entity_id": str(ref.entity_id),
                            }
                        )
        return MaintenanceResult(
            task_id=self.id,
            success=True,
            message="المراجع سليمة" if broken == 0 else f"مراجع متعارضة: {broken}",
            details={"broken_count": broken, "samples": samples},
            objects_checked=len(refs),
            warnings=["مراجع متعارضة"] if broken else [],
        )

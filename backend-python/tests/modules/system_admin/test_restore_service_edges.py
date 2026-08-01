"""Edge-case unit tests for RestoreService helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError, NotFoundError, ValidationError
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import BackupStatus, RestoreSourceType, RestoreStatus
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.restore import RestoreService
from app.utils.datetime import utc_now
from tests.modules.system_admin.test_restore_api import _seed_settings


@pytest.mark.asyncio
async def test_confirm_checksum_required(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))
    with pytest.raises(ValidationError):
        await svc.restore(backup_id=uuid4(), confirm=True, confirm_checksum="   ")


@pytest.mark.asyncio
async def test_resolve_package_errors(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))
    with pytest.raises(ValidationError):
        await svc._resolve_package_path(backup_id=None, upload_path=None)
    with pytest.raises(NotFoundError):
        await svc._resolve_package_path(backup_id=None, upload_path=tmp_path / "missing.juman")
    with pytest.raises(NotFoundError):
        await svc._resolve_package_path(backup_id=uuid4(), upload_path=None)

    # COMPLETED row but missing file
    row = SystemBackup(
        id=uuid4(),
        filename="gone.juman",
        storage_path="gone.juman",
        status=BackupStatus.COMPLETED.value,
    )
    db_session.add(row)
    await db_session.commit()
    with pytest.raises(NotFoundError):
        await svc._resolve_package_path(backup_id=row.id, upload_path=None)
    assert root.exists()


@pytest.mark.asyncio
async def test_apply_dump_unsupported_dialect(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))

    class FakeBind:
        class dialect:
            name = "oracle"

    monkeypatch.setattr(db_session, "get_bind", lambda: FakeBind())
    dump = tmp_path / "database.dump"
    dump.write_text("SELECT 1;", encoding="utf-8")
    with pytest.raises(BusinessError):
        await svc._apply_dump(dump)


@pytest.mark.asyncio
async def test_apply_dump_postgres_path(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))

    class FakeBind:
        class dialect:
            name = "postgresql"

    called = {"n": 0}

    class FakeApplier:
        def __init__(self, url: str) -> None:
            self.url = url

        async def apply(self, dump_path: Path) -> None:
            called["n"] += 1

    monkeypatch.setattr(db_session, "get_bind", lambda: FakeBind())
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore.PostgresRestoreApplier",
        FakeApplier,
    )
    dump = tmp_path / "database.dump"
    dump.write_text("SELECT 1;", encoding="utf-8")
    await svc._apply_dump(dump)
    assert called["n"] == 1


@pytest.mark.asyncio
async def test_restore_media_copies(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    media = await _seed_settings(db_session, tmp_path)
    # media root already seeded under tmp_path/media
    svc = RestoreService(db_session, settings_service=SettingService(db_session))
    src = tmp_path / "src_media"
    nested = src / "a" / "b"
    nested.mkdir(parents=True)
    (nested / "f.txt").write_text("hi", encoding="utf-8")
    await svc._restore_media(src)
    dest_root = tmp_path / "media"
    assert (dest_root / "a" / "b" / "f.txt").read_text(encoding="utf-8") == "hi"
    assert media.exists()


@pytest.mark.asyncio
async def test_rewrite_failure_inserts_when_missing(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))
    restore_id = uuid4()
    safety_id = uuid4()
    sidecar = tmp_path / "sidecar.json"
    sidecar.write_text("{not-json", encoding="utf-8")
    await svc._rewrite_history_after_failure(
        sidecar_path=sidecar,
        restore_id=restore_id,
        error_message="boom",
        finished_at=utc_now(),
        started_at=utc_now(),
        actor_id=None,
        username=None,
        ip_address=None,
        source_type=RestoreSourceType.BACKUP_ID.value,
        source_backup_id=None,
        source_filename="x.juman",
        package_checksum="a" * 64,
        safety_snapshot={
            "id": str(safety_id),
            "filename": "safety.juman",
            "storage_path": "safety.juman",
            "checksum_sha256": "b" * 64,
            "compressed_size_bytes": 10,
        },
        notes=None,
        format_version=1,
        app_version="1.0.0",
        alembic_revision="rev",
    )
    row = await svc.get(restore_id)
    assert row.status == RestoreStatus.FAILED.value
    assert row.safety_backup_id == safety_id


@pytest.mark.asyncio
async def test_rewrite_success_updates_existing(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))
    restore_id = uuid4()
    safety_id = uuid4()
    from app.modules.system_admin.models.restore import SystemRestore

    db_session.add(
        SystemRestore(
            id=restore_id,
            status=RestoreStatus.RUNNING.value,
            source_type=RestoreSourceType.BACKUP_ID.value,
            source_filename="x.juman",
            started_at=utc_now(),
        )
    )
    await db_session.commit()
    await svc._rewrite_history_after_success(
        sidecar={
            "restore_id": str(restore_id),
            "safety_backup_id": str(safety_id),
            "safety_backup_filename": "s.juman",
            "safety_backup_storage_path": "s.juman",
            "safety_checksum_sha256": "c" * 64,
            "safety_compressed_size_bytes": 1,
            "source_type": RestoreSourceType.BACKUP_ID.value,
            "source_filename": "x.juman",
            "package_checksum_sha256": "d" * 64,
            "format_version": 1,
            "app_version": "1.0.0",
            "alembic_revision": "rev",
            "started_at": "not-a-date",
            "notes": None,
        },
        warning_message=None,
        finished_at=utc_now(),
        actor_id=None,
        username=None,
        ip_address=None,
    )
    row = await svc.get(restore_id)
    assert row.status == RestoreStatus.COMPLETED.value


@pytest.mark.asyncio
async def test_rollback_without_storage_root_key(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False)
    filename = backup.filename
    storage_path = backup.storage_path
    svc = RestoreService(
        db_session,
        settings_service=SettingService(db_session),
        backup_service=backup_svc,
    )
    snap = {
        "id": backup.id,
        "filename": filename,
        "storage_path": storage_path,
    }
    await svc._rollback_with_safety_snapshot(snap)
    assert (root / filename).is_file()


@pytest.mark.asyncio
async def test_safety_create_not_completed(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False)
    restore_svc = RestoreService(
        db_session,
        settings_service=SettingService(db_session),
        backup_service=backup_svc,
    )

    async def _bad_create(**kwargs):  # noqa: ANN003
        return SystemBackup(
            id=uuid4(),
            filename="x.juman",
            storage_path="x.juman",
            status=BackupStatus.FAILED.value,
        )

    monkeypatch.setattr(backup_svc, "create", _bad_create)
    with pytest.raises(BusinessError):
        await restore_svc.restore(
            backup_id=backup.id,
            confirm=True,
            confirm_checksum=backup.checksum_sha256 or "",
        )


@pytest.mark.asyncio
async def test_rollback_failure_appended(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False)
    restore_svc = RestoreService(
        db_session,
        settings_service=SettingService(db_session),
        backup_service=backup_svc,
    )
    calls = {"n": 0}
    original = restore_svc._apply_dump

    async def _flaky(dump_path):  # noqa: ANN001
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("apply failed")
        raise RuntimeError("rollback failed")

    monkeypatch.setattr(restore_svc, "_apply_dump", _flaky)
    with pytest.raises(BusinessError) as ei:
        await restore_svc.restore(
            backup_id=backup.id,
            confirm=True,
            confirm_checksum=backup.checksum_sha256 or "",
        )
    assert "التراجع" in str(ei.value) or "rollback" in str(ei.value).lower() or "فشل" in str(
        ei.value
    )


@pytest.mark.asyncio
async def test_alembic_current_exception(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))

    async def boom(*a, **k):  # noqa: ANN001
        raise RuntimeError("no table")

    monkeypatch.setattr(db_session, "execute", boom)
    assert await svc._alembic_current() == []


@pytest.mark.asyncio
async def test_upload_cleanup_oserror(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_settings(db_session, tmp_path)
    svc = RestoreService(db_session, settings_service=SettingService(db_session))
    upload = tmp_path / "u.juman"
    upload.write_bytes(b"x")

    async def _boom(**kwargs):  # noqa: ANN003
        raise ValidationError("stop")

    monkeypatch.setattr(svc, "_restore_locked", _boom)

    def _unlink_fail(*a, **k):  # noqa: ANN001
        raise OSError("busy")

    monkeypatch.setattr(Path, "unlink", _unlink_fail)
    with pytest.raises(ValidationError):
        await svc.restore(
            upload_path=upload,
            confirm=True,
            confirm_checksum="a" * 64,
        )

"""API and service tests for System Administration restore engine."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from uuid import uuid4

import pytest
from app.modules.audit.models import AuditLog
from app.modules.rbac.constants import SystemRoleName
from app.modules.settings.constants import SettingKey
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import BackupStatus, RestoreStatus
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.models.restore import SystemRestore
from app.modules.system_admin.services import backup as backup_mod
from app.modules.system_admin.services import restore as restore_mod
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.backup_package import sha256_file
from app.modules.system_admin.services.restore import RestoreService
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.settings.seed_helpers import apply_migration_settings_seed

ALEMBIC_REV = "20260731_0031_system_restores"


async def _seed_alembic(session: AsyncSession) -> None:
    await session.execute(
        text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
    )
    await session.execute(text("DELETE FROM alembic_version"))
    await session.execute(
        text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
        {"v": ALEMBIC_REV},
    )
    await session.commit()


async def _seed_settings(session: AsyncSession, tmp_path: Path) -> Path:
    await apply_migration_settings_seed(session)
    await _seed_alembic(session)
    root = tmp_path / "backups"
    root.mkdir(parents=True, exist_ok=True)
    media = tmp_path / "media"
    media.mkdir(parents=True, exist_ok=True)
    for key, value in {
        SettingKey.BACKUP_STORAGE_ROOT.value: str(root),
        SettingKey.BACKUP_INCLUDE_MEDIA_DEFAULT.value: "false",
        SettingKey.MEDIA_STORAGE_ROOT.value: str(media),
        SettingKey.MEDIA_STORAGE_PROVIDER.value: "local",
        SettingKey.DEFAULT_TIMEZONE.value: "Asia/Baghdad",
    }.items():
        result = await session.execute(
            select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
        )
        row = result.scalar_one_or_none()
        if row is None:
            session.add(
                Setting(
                    id=uuid4(),
                    key=key,
                    value=value,
                    value_type="boolean" if value in {"true", "false"} else "string",
                    category="system",
                    description=key,
                    is_editable=True,
                )
            )
        else:
            row.value = value
    await session.commit()
    return root


@pytest.fixture(autouse=True)
def _reset_busy() -> None:
    backup_mod._CREATE_BUSY = False
    restore_mod._RESTORE_BUSY = False


@pytest.mark.asyncio
async def test_restore_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/system/restore/history")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_restore_requires_permission(
    api_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    _, pair = await create_user_with_token(
        db_session, username="cashier_restore", role_name=SystemRoleName.CASHIER.value
    )
    api_client.headers.update(bearer_headers(pair.access_token))
    response = await api_client.post(
        "/api/v1/system/restore/validate", json={"backup_id": str(uuid4())}
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_validate_and_restore_by_backup_id(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False, notes="source")
    assert backup.status == BackupStatus.COMPLETED.value
    checksum = backup.checksum_sha256
    assert checksum

    validated = await admin_client.post(
        "/api/v1/system/restore/validate",
        json={"backup_id": str(backup.id)},
    )
    assert validated.status_code == 200, validated.text
    assert validated.json()["data"]["ok"] is True
    assert validated.json()["data"]["package_checksum_sha256"] == checksum

    restored = await admin_client.post(
        "/api/v1/system/restore",
        json={
            "backup_id": str(backup.id),
            "confirm": True,
            "confirm_checksum": checksum,
            "notes": "ops restore",
        },
    )
    assert restored.status_code == 201, restored.text
    body = restored.json()["data"]
    assert body["status"] == RestoreStatus.COMPLETED.value
    assert body["safety_backup_id"]
    assert body["package_checksum_sha256"] == checksum

    history = await admin_client.get("/api/v1/system/restore/history")
    assert history.status_code == 200
    assert history.json()["meta"]["total"] >= 1

    detail = await admin_client.get(f"/api/v1/system/restore/history/{body['id']}")
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == body["id"]

    audits = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.entity_type == "system_restore")
        )
    ).scalars().all()
    assert audits

    # safety backup file remains on disk
    safety_rows = (
        await db_session.execute(
            select(SystemBackup).where(SystemBackup.notes == "pre-restore-safety")
        )
    ).scalars().all()
    assert safety_rows
    assert (root / safety_rows[0].filename).is_file()


@pytest.mark.asyncio
async def test_restore_confirm_required(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False)
    response = await admin_client.post(
        "/api/v1/system/restore",
        json={
            "backup_id": str(backup.id),
            "confirm": False,
            "confirm_checksum": backup.checksum_sha256,
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_validate_checksum_mismatch(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False)
    response = await admin_client.post(
        "/api/v1/system/restore/validate",
        json={
            "backup_id": str(backup.id),
            "expected_checksum": "0" * 64,
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["ok"] is False


@pytest.mark.asyncio
async def test_validate_missing_manifest(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _seed_settings(db_session, tmp_path)
    bad = root / "uploads"
    bad.mkdir(parents=True, exist_ok=True)
    package = bad / "bad.juman"
    with zipfile.ZipFile(package, "w") as zf:
        zf.writestr("metadata.json", "{}")
        zf.writestr("database.dump", "SELECT 1;")
        zf.writestr("checksum.sha256", "")

    with package.open("rb") as handle:
        response = await admin_client.post(
            "/api/v1/system/restore/validate",
            files={"file": ("bad.juman", handle, "application/zip")},
        )
    assert response.status_code == 200
    assert response.json()["data"]["ok"] is False
    assert any("مفقودة" in e or "manifest" in e.lower() for e in response.json()["data"]["errors"]) or response.json()["data"]["errors"]


@pytest.mark.asyncio
async def test_restore_concurrent_409(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    restore_mod._RESTORE_BUSY = True
    response = await admin_client.post(
        "/api/v1/system/restore",
        json={
            "backup_id": str(uuid4()),
            "confirm": True,
            "confirm_checksum": "a" * 64,
        },
    )
    assert response.status_code == 409
    restore_mod._RESTORE_BUSY = False


@pytest.mark.asyncio
async def test_restore_failure_rolls_back_with_safety(
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

    async def _boom(self, dump_path):  # noqa: ANN001, ARG001
        raise RuntimeError("apply failed")

    # Fail only the first apply (target), allow safety rollback apply
    calls = {"n": 0}
    original = restore_svc._apply_dump

    async def _flaky(dump_path):  # noqa: ANN001
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("apply failed")
        return await original(dump_path)

    monkeypatch.setattr(restore_svc, "_apply_dump", _flaky)

    with pytest.raises(Exception):
        await restore_svc.restore(
            backup_id=backup.id,
            confirm=True,
            confirm_checksum=backup.checksum_sha256 or "",
        )

    rows = (await db_session.execute(select(SystemRestore))).scalars().all()
    assert rows
    assert rows[-1].status == RestoreStatus.FAILED.value
    assert rows[-1].safety_backup_id is not None


@pytest.mark.asyncio
async def test_restore_upload_success(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False)
    package = root / backup.filename
    checksum = sha256_file(package)

    with package.open("rb") as handle:
        response = await admin_client.post(
            "/api/v1/system/restore",
            data={
                "confirm": "true",
                "confirm_checksum": checksum,
                "notes": "from upload",
            },
            files={"file": (backup.filename, handle, "application/zip")},
        )
    assert response.status_code == 201, response.text
    assert response.json()["data"]["status"] == RestoreStatus.COMPLETED.value
    assert response.json()["data"]["source_type"] == "UPLOAD"


@pytest.mark.asyncio
async def test_restore_wrong_confirm_checksum(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    backup_svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup = await backup_svc.create(include_media=False)
    response = await admin_client.post(
        "/api/v1/system/restore",
        json={
            "backup_id": str(backup.id),
            "confirm": True,
            "confirm_checksum": "b" * 64,
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_backup_blocked_while_restore_running(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    restore_mod._RESTORE_BUSY = True
    try:
        db_session.add(
            SystemRestore(
                id=uuid4(),
                status=RestoreStatus.RUNNING.value,
                source_type="BACKUP_ID",
                source_filename="x.juman",
                started_at=__import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ),
            )
        )
        await db_session.commit()
        svc = BackupService(db_session, settings_service=SettingService(db_session))
        with pytest.raises(Exception):
            await svc.create(include_media=False)
    finally:
        restore_mod._RESTORE_BUSY = False


@pytest.mark.asyncio
async def test_restore_history_not_found(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_settings(db_session, tmp_path)
    response = await admin_client.get(f"/api/v1/system/restore/history/{uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_restore_media_warning(
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

    async def _warn_media(_media_path):  # noqa: ANN001
        raise RuntimeError("media boom")

    monkeypatch.setattr(restore_svc, "_restore_media", _warn_media)

    # Patch validation to claim include_media
    orig_validate = restore_svc.validator.validate_archive

    def _val(*a, **k):  # noqa: ANN001
        result = orig_validate(*a, **k)
        result.include_media = True
        return result

    monkeypatch.setattr(restore_svc.validator, "validate_archive", _val)

    # Ensure extract has media dir
    orig_extract = restore_svc.validator.extract_package

    def _extract(package_path, dest):  # noqa: ANN001
        path = orig_extract(package_path, dest)
        (dest / "media").mkdir(parents=True, exist_ok=True)
        (dest / "media" / "f.txt").write_text("x", encoding="utf-8")
        return path

    monkeypatch.setattr(restore_svc.validator, "extract_package", _extract)

    row = await restore_svc.restore(
        backup_id=backup.id,
        confirm=True,
        confirm_checksum=backup.checksum_sha256 or "",
    )
    assert row.status == RestoreStatus.COMPLETED.value
    assert row.warning_message


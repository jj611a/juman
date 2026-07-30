"""API tests for Phase 4 maintenance, metrics, and diagnostics extensions."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from app.modules.audit.models import AuditLog
from app.modules.identity.models import LoginSession, User
from app.modules.media.models import StoredFile
from app.modules.rbac.constants import SystemRoleName
from app.modules.settings.constants import SettingKey
from app.modules.system_admin.constants import BackupStatus, MaintenanceRunStatus, MaintenanceTaskId
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.services import maintenance as maintenance_mod
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.settings.seed_helpers import apply_migration_settings_seed


async def _seed_storage(session: AsyncSession, tmp_path: Path) -> tuple[Path, Path]:
    await apply_migration_settings_seed(session)
    media = tmp_path / "media"
    backup = tmp_path / "backup"
    media.mkdir(parents=True, exist_ok=True)
    backup.mkdir(parents=True, exist_ok=True)
    from app.modules.settings.models.setting import Setting

    for key, value in {
        SettingKey.MEDIA_STORAGE_ROOT.value: str(media),
        SettingKey.BACKUP_STORAGE_ROOT.value: str(backup),
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
                    value_type="string",
                    category="system",
                    description=key,
                    is_editable=True,
                )
            )
        else:
            row.value = value
    await session.commit()
    return media, backup


@pytest.fixture(autouse=True)
def _reset_maintenance_busy() -> None:
    maintenance_mod._MAINTENANCE_BUSY = False


@pytest.mark.asyncio
async def test_metrics_requires_auth(api_client: AsyncClient) -> None:
    assert (await api_client.get("/api/v1/system/metrics")).status_code == 401


@pytest.mark.asyncio
async def test_metrics_forbidden_cashier(api_client: AsyncClient, db_session: AsyncSession) -> None:
    _, pair = await create_user_with_token(
        db_session, username="metrics_cashier", role_name=SystemRoleName.CASHIER.value
    )
    response = await api_client.get(
        "/api/v1/system/metrics", headers=bearer_headers(pair.access_token)
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_metrics_ok_admin(admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path) -> None:
    await _seed_storage(db_session, tmp_path)
    response = await admin_client.get("/api/v1/system/metrics")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["users"] >= 1
    assert body["dresses"] >= 0
    assert body["customers"] >= 0
    assert body["active_rentals"] >= 0
    assert body["reservations"] >= 0
    assert body["sales"] >= 0
    assert body["audit_logs"] >= 0
    assert body["backups"] >= 0
    assert "environment" in body
    blob = str(body).lower()
    assert "password" not in blob
    assert "redis://" not in blob
    assert "postgresql+asyncpg://" not in blob


@pytest.mark.asyncio
async def test_diagnostics_extended_checks(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    response = await admin_client.get("/api/v1/system/diagnostics")
    assert response.status_code == 200
    ids = {c["id"] for c in response.json()["checks"]}
    for expected in (
        "backup_storage_root_exists",
        "backup_storage_writable",
        "restore_readiness",
        "disk_usage",
        "app_runtime",
    ):
        assert expected in ids


@pytest.mark.asyncio
async def test_execute_forbidden_cashier(
    api_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    _, pair = await create_user_with_token(
        db_session, username="maint_cashier", role_name=SystemRoleName.CASHIER.value
    )
    response = await api_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value}/execute",
        headers=bearer_headers(pair.access_token),
        json={},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_execute_unknown_task(admin_client: AsyncClient) -> None:
    response = await admin_client.post(
        "/api/v1/system/maintenance/tasks/vacuum_database/execute",
        json={"confirm": True},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_cleanup_without_confirm_422(admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path) -> None:
    await _seed_storage(db_session, tmp_path)
    response = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.CLEANUP_SESSIONS.value}/execute",
        json={},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_verify_execute_and_history(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    response = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_DRESS_STATUS_CONSISTENCY.value}/execute",
        json={},
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["status"] == MaintenanceRunStatus.COMPLETED.value
    assert data["dry_run"] is False
    execution_id = data["id"]

    listed = await admin_client.get("/api/v1/system/maintenance/history")
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    detail = await admin_client.get(f"/api/v1/system/maintenance/history/{execution_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == execution_id

    filtered = await admin_client.get(
        "/api/v1/system/maintenance/history",
        params={"task_key": MaintenanceTaskId.VERIFY_DRESS_STATUS_CONSISTENCY.value},
    )
    assert filtered.status_code == 200
    assert all(
        row["task_key"] == MaintenanceTaskId.VERIFY_DRESS_STATUS_CONSISTENCY.value
        for row in filtered.json()["data"]
    )

    audits = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.entity_type == "system_maintenance_run")
        )
    ).scalars().all()
    assert any(str(a.entity_id) == execution_id for a in audits)


@pytest.mark.asyncio
async def test_cleanup_sessions_dry_run_and_execute(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    user = (
        await db_session.execute(select(User).where(User.is_deleted.is_(False)).limit(1))
    ).scalar_one()
    expired = LoginSession(
        id=uuid4(),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db_session.add(expired)
    await db_session.commit()

    preview = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.CLEANUP_SESSIONS.value}/execute",
        json={"dry_run": True},
    )
    assert preview.status_code == 201, preview.text
    assert preview.json()["data"]["dry_run"] is True
    assert preview.json()["data"]["status"] == MaintenanceRunStatus.COMPLETED.value
    still = await db_session.get(LoginSession, expired.id)
    assert still is not None
    assert still.is_deleted is False

    executed = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.CLEANUP_SESSIONS.value}/execute",
        json={"confirm": True},
    )
    assert executed.status_code == 201, executed.text
    await db_session.refresh(expired)
    assert expired.is_deleted is True
    assert expired.revoked_at is not None


@pytest.mark.asyncio
async def test_orphan_media_file_cleanup(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    media, _ = await _seed_storage(db_session, tmp_path)
    orphan = media / "orphan_blob.bin"
    orphan.write_bytes(b"x")
    tracked = media / "tracked.bin"
    tracked.write_bytes(b"y")
    db_session.add(
        StoredFile(
            id=uuid4(),
            original_filename="tracked.bin",
            stored_filename="tracked.bin",
            extension="bin",
            mime_type="application/octet-stream",
            size_bytes=1,
            sha256_hash="a" * 64,
            storage_provider="local",
            relative_path="tracked.bin",
        )
    )
    await db_session.commit()

    response = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.CLEANUP_ORPHAN_MEDIA_FILES.value}/execute",
        json={"confirm": True},
    )
    assert response.status_code == 201, response.text
    assert not orphan.exists()
    assert tracked.exists()


@pytest.mark.asyncio
async def test_concurrent_maintenance_busy(admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path) -> None:
    await _seed_storage(db_session, tmp_path)
    maintenance_mod._MAINTENANCE_BUSY = True
    response = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value}/execute",
        json={},
    )
    assert response.status_code == 409
    assert "صيانة" in response.text


@pytest.mark.asyncio
async def test_execute_blocked_while_backup_running(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    db_session.add(
        SystemBackup(
            id=uuid4(),
            filename="busy.juman",
            storage_path="busy.juman",
            status=BackupStatus.RUNNING.value,
            format_version=1,
            include_media=False,
        )
    )
    await db_session.commit()
    response = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value}/execute",
        json={},
    )
    assert response.status_code == 409
    assert "نسخة احتياطية" in response.text


@pytest.mark.asyncio
async def test_history_forbidden_cashier(api_client: AsyncClient, db_session: AsyncSession) -> None:
    _, pair = await create_user_with_token(
        db_session, username="hist_cashier", role_name=SystemRoleName.CASHIER.value
    )
    response = await api_client.get(
        "/api/v1/system/maintenance/history",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_failed_execute_records_history(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_storage(db_session, tmp_path)

    async def boom(self):  # noqa: ANN001
        raise RuntimeError("boom-test")

    from app.modules.system_admin.maintenance.tasks import VerifyMediaIntegrityTask

    monkeypatch.setattr(VerifyMediaIntegrityTask, "execute", boom)
    response = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value}/execute",
        json={},
    )
    assert response.status_code == 422
    listed = await admin_client.get(
        "/api/v1/system/maintenance/history",
        params={"task_key": MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value, "status": "FAILED"},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1
    assert listed.json()["data"][0]["status"] == MaintenanceRunStatus.FAILED.value

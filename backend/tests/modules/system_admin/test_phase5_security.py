"""Phase 5 — audit coverage, authz matrix, inactive/locked users."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from app.modules.audit.models import AuditLog
from app.modules.rbac.constants import SystemRoleName
from app.modules.settings.constants import SettingKey
from app.modules.system_admin.constants import BackupStatus, MaintenanceTaskId
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.services import backup as backup_mod
from app.modules.system_admin.services import maintenance as maintenance_mod
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token, mint_admin_bearer
from tests.modules.settings.seed_helpers import apply_migration_settings_seed



async def _seed_alembic(session: AsyncSession) -> None:
    await session.execute(
        text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
    )
    await session.execute(text("DELETE FROM alembic_version"))
    await session.execute(
        text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
        {"v": "20260802_0033_system_backups_duration"},
    )
    await session.commit()


async def _seed_storage(session: AsyncSession, tmp_path: Path) -> Path:
    await apply_migration_settings_seed(session)
    await _seed_alembic(session)
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
        SettingKey.BACKUP_INCLUDE_MEDIA_DEFAULT.value: "false",
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
    return backup


SYSTEM_GET_PATHS = [
    "/api/v1/system/info",
    "/api/v1/system/diagnostics",
    "/api/v1/system/metrics",
    "/api/v1/system/maintenance/tasks",
    "/api/v1/system/maintenance/history",
    "/api/v1/system/backups",
    "/api/v1/system/restore/history",
]


@pytest.fixture(autouse=True)
def _reset_busy() -> None:
    backup_mod._CREATE_BUSY = False
    maintenance_mod._MAINTENANCE_BUSY = False


@pytest.mark.asyncio
async def test_system_routes_require_auth(api_client: AsyncClient) -> None:
    for path in SYSTEM_GET_PATHS:
        assert (await api_client.get(path)).status_code == 401, path
    assert (
        await api_client.post(
            f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value}/execute",
            json={},
        )
    ).status_code == 401
    assert (await api_client.post("/api/v1/system/backups", json={})).status_code == 401
    assert (await api_client.post("/api/v1/system/restore/validate", json={})).status_code == 401


@pytest.mark.asyncio
async def test_cashier_forbidden_on_privileged_routes(
    api_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    _, pair = await create_user_with_token(
        db_session, username="p5_cashier", role_name=SystemRoleName.CASHIER.value
    )
    headers = bearer_headers(pair.access_token)
    for path in SYSTEM_GET_PATHS:
        assert (await api_client.get(path, headers=headers)).status_code == 403, path
    assert (
        await api_client.post(
            f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value}/execute",
            headers=headers,
            json={},
        )
    ).status_code == 403
    assert (await api_client.post("/api/v1/system/backups", headers=headers, json={})).status_code == 403
    assert (
        await api_client.post("/api/v1/system/restore/validate", headers=headers, json={})
    ).status_code == 403


@pytest.mark.asyncio
async def test_inactive_user_denied(
    api_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    user, token = await mint_admin_bearer(db_session, username="p5_inactive")
    user.is_active = False
    await db_session.commit()
    response = await api_client.get(
        "/api/v1/system/info", headers=bearer_headers(token)
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_locked_user_denied(
    api_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    user, token = await mint_admin_bearer(db_session, username="p5_locked")
    user.is_locked = True
    await db_session.commit()
    response = await api_client.post(
        "/api/v1/system/backups",
        headers=bearer_headers(token),
        json={},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_backup_create_audit_outcome_and_duration(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    created = await admin_client.post("/api/v1/system/backups", json={"include_media": False})
    assert created.status_code == 201, created.text
    data = created.json()["data"]
    assert data["status"] == BackupStatus.COMPLETED.value
    assert data["started_at"] is not None
    assert data["finished_at"] is not None
    assert data["duration_ms"] is not None
    assert data["duration_ms"] >= 0
    assert data["audit_log_id"] is not None

    audits = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.entity_type == "system_backup",
                AuditLog.entity_id == str(data["id"]),
            )
        )
    ).scalars().all()
    create_audits = [a for a in audits if a.action == "create"]
    assert create_audits
    assert (create_audits[-1].metadata_json or {}).get("backup_outcome") == "success"


@pytest.mark.asyncio
async def test_backup_download_export_audit(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    created = await admin_client.post("/api/v1/system/backups", json={})
    backup_id = created.json()["data"]["id"]
    dl = await admin_client.get(f"/api/v1/system/backups/{backup_id}/download")
    assert dl.status_code == 200
    audits = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.entity_type == "system_backup",
                AuditLog.entity_id == str(backup_id),
                AuditLog.action == "export",
            )
        )
    ).scalars().all()
    assert audits
    meta = audits[-1].metadata_json or {}
    assert meta.get("backup_outcome") == "download"


@pytest.mark.asyncio
async def test_backup_delete_sets_audit_log_id(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    created = await admin_client.post("/api/v1/system/backups", json={})
    backup_id = created.json()["data"]["id"]
    deleted = await admin_client.delete(f"/api/v1/system/backups/{backup_id}")
    assert deleted.status_code == 200
    from uuid import UUID

    row = await db_session.get(SystemBackup, UUID(backup_id))
    assert row is not None
    assert row.audit_log_id is not None
    audits = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.id == row.audit_log_id,
            )
        )
    ).scalar_one()
    assert audits.action == "delete"
    assert (audits.metadata_json or {}).get("backup_outcome") == "deleted"


@pytest.mark.asyncio
async def test_backup_create_failure_audited(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_storage(db_session, tmp_path)

    async def boom(*args, **kwargs):
        raise RuntimeError("forced-backup-fail")

    monkeypatch.setattr(
        "app.modules.system_admin.services.backup.BackupPackageBuilder.build",
        boom,
    )
    response = await admin_client.post("/api/v1/system/backups", json={})
    assert response.status_code == 400
    rows = (
        await db_session.execute(
            select(SystemBackup).where(SystemBackup.status == BackupStatus.FAILED.value)
        )
    ).scalars().all()
    assert rows
    assert rows[-1].audit_log_id is not None
    assert rows[-1].duration_ms is not None
    audit = await db_session.get(AuditLog, rows[-1].audit_log_id)
    assert audit is not None
    assert (audit.metadata_json or {}).get("backup_outcome") == "failure"


@pytest.mark.asyncio
async def test_maintenance_started_and_completed_audits(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    response = await admin_client.post(
        f"/api/v1/system/maintenance/tasks/{MaintenanceTaskId.VERIFY_DRESS_STATUS_CONSISTENCY.value}/execute",
        json={},
    )
    assert response.status_code == 201, response.text
    execution_id = response.json()["data"]["id"]
    audits = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.entity_type == "system_maintenance_run",
                AuditLog.entity_id == str(execution_id),
            )
        )
    ).scalars().all()
    outcomes = {(a.metadata_json or {}).get("maintenance_outcome") for a in audits}
    assert "started" in outcomes
    assert "success" in outcomes


@pytest.mark.asyncio
async def test_restore_validate_outcome_metadata(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_storage(db_session, tmp_path)
    created = await admin_client.post("/api/v1/system/backups", json={})
    backup_id = created.json()["data"]["id"]
    validated = await admin_client.post(
        "/api/v1/system/restore/validate",
        json={"backup_id": backup_id},
    )
    assert validated.status_code == 200, validated.text
    audits = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.entity_type == "system_restore_validation")
        )
    ).scalars().all()
    assert audits
    assert (audits[-1].metadata_json or {}).get("restore_outcome") == "validation_ok"

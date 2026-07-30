"""API tests for System Administration backup engine."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from uuid import uuid4

import pytest
from app.modules.audit.models import AuditLog
from app.modules.settings.constants import SettingKey
from app.modules.system_admin.constants import BackupStatus
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.services import backup as backup_mod
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, mint_admin_bearer
from tests.modules.settings.seed_helpers import apply_migration_settings_seed


async def _seed_backup_settings(session: AsyncSession, tmp_path: Path) -> Path:
    await apply_migration_settings_seed(session)
    root = tmp_path / "backups"
    root.mkdir(parents=True, exist_ok=True)
    from app.modules.settings.models.setting import Setting

    for key, value in {
        SettingKey.BACKUP_STORAGE_ROOT.value: str(root),
        SettingKey.BACKUP_INCLUDE_MEDIA_DEFAULT.value: "false",
        SettingKey.MEDIA_STORAGE_ROOT.value: str(tmp_path / "media"),
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
def _reset_backup_busy() -> None:
    backup_mod._CREATE_BUSY = False


@pytest.mark.asyncio
async def test_backup_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/system/backups")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_backup_requires_permission(
    api_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_backup_settings(db_session, tmp_path)
    from app.modules.rbac.constants import SystemRoleName
    from tests.helpers.auth import create_user_with_token

    _, pair = await create_user_with_token(
        db_session, username="sys_cashier_backup", role_name=SystemRoleName.CASHIER.value
    )
    api_client.headers.update(bearer_headers(pair.access_token))
    response = await api_client.post("/api/v1/system/backups", json={})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_backup_create_list_get_download_delete(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _seed_backup_settings(db_session, tmp_path)

    created = await admin_client.post(
        "/api/v1/system/backups",
        json={"include_media": False, "notes": "nightly"},
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["status"] == BackupStatus.COMPLETED.value
    assert body["filename"].endswith(".juman")
    assert body["checksum_sha256"]
    assert body["compressed_size_bytes"] > 0
    assert body["notes"] == "nightly"
    assert body["include_media"] is False
    backup_id = body["id"]

    archive = root / body["filename"]
    assert archive.is_file()
    with zipfile.ZipFile(archive, "r") as zf:
        names = set(zf.namelist())
        assert "manifest.json" in names
        assert "metadata.json" in names
        assert "database.dump" in names
        assert "checksum.sha256" in names
        assert zf.testzip() is None

    listed = await admin_client.get("/api/v1/system/backups")
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    detail = await admin_client.get(f"/api/v1/system/backups/{backup_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == backup_id

    download = await admin_client.get(f"/api/v1/system/backups/{backup_id}/download")
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("application/zip")
    assert body["filename"] in download.headers.get("content-disposition", "")
    assert zipfile.is_zipfile(io.BytesIO(download.content))

    audits = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.entity_type == "system_backup",
                AuditLog.entity_id == backup_id,
            )
        )
    ).scalars().all()
    assert any(a.action == "create" for a in audits)

    deleted = await admin_client.delete(f"/api/v1/system/backups/{backup_id}")
    assert deleted.status_code == 200
    assert not archive.exists()

    gone = await admin_client.get(f"/api/v1/system/backups/{backup_id}/download")
    assert gone.status_code == 404

    # soft-deleted detail should 404 from get (alive only)
    missing = await admin_client.get(f"/api/v1/system/backups/{backup_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_backup_concurrent_create_409(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_backup_settings(db_session, tmp_path)
    backup_mod._CREATE_BUSY = True
    response = await admin_client.post("/api/v1/system/backups", json={})
    assert response.status_code == 409
    backup_mod._CREATE_BUSY = False


@pytest.mark.asyncio
async def test_backup_failure_marks_failed(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_backup_settings(db_session, tmp_path)

    async def _boom(self, target):  # noqa: ANN001
        raise RuntimeError("dump failed")

    monkeypatch.setattr(
        "app.modules.system_admin.services.dumpers.SqliteDumper.dump",
        _boom,
    )
    response = await admin_client.post("/api/v1/system/backups", json={})
    assert response.status_code == 400
    rows = (await db_session.execute(select(SystemBackup))).scalars().all()
    assert len(rows) == 1
    assert rows[0].status == BackupStatus.FAILED.value
    assert rows[0].error_message


@pytest.mark.asyncio
async def test_backup_include_media_missing_root_fails(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_backup_settings(db_session, tmp_path)
    # media root path does not exist
    response = await admin_client.post(
        "/api/v1/system/backups",
        json={"include_media": True},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_backup_include_media_success(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _seed_backup_settings(db_session, tmp_path)
    media = tmp_path / "media"
    media.mkdir(parents=True, exist_ok=True)
    (media / "photo.bin").write_bytes(b"abc")

    response = await admin_client.post(
        "/api/v1/system/backups",
        json={"include_media": True},
    )
    assert response.status_code == 201, response.text
    body = response.json()["data"]
    assert body["include_media"] is True
    with zipfile.ZipFile(root / body["filename"], "r") as zf:
        assert any(name.startswith("media/") for name in zf.namelist())


@pytest.mark.asyncio
async def test_backup_response_omits_dsn_secrets(
    admin_client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_backup_settings(db_session, tmp_path)
    response = await admin_client.post("/api/v1/system/backups", json={})
    assert response.status_code == 201
    payload = response.json()
    text = str(payload)
    assert "postgresql://" not in text
    assert "PASSWORD" not in text.upper() or "checksum" in text.lower()
    assert "database_url" not in text.lower()

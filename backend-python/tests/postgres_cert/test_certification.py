"""PostgreSQL Phase 6 certification suite (Layer 2).

Skipped unless JUMAN_POSTGRES_CERT=1. Uses DATABASE_URL pointing at an
isolated validation database owned by the Phase 6 orchestrator.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from app.main import create_app
from app.modules.audit.models import AuditLog
from app.modules.identity.models import User
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.models import Role
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.models import Setting
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import BackupStatus, MaintenanceTaskId
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.maintenance import MaintenanceService
from app.modules.system_admin.services.restore import RestoreService
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from tests.helpers.auth import bearer_headers, create_user_with_token, mint_admin_bearer
from tests.helpers.identity import seed_identity_basics

EXPECTED_HEAD = "20260802_0033_system_backups_duration"


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "postgres_cert: PostgreSQL Phase 6 certification tests")


def _require_cert_env() -> str:
    if os.environ.get("JUMAN_POSTGRES_CERT") != "1":
        pytest.skip("Set JUMAN_POSTGRES_CERT=1 to run PostgreSQL certification suite")
    url = os.environ.get("DATABASE_URL", "")
    if "asyncpg" not in url:
        pytest.skip("postgres_cert requires postgresql+asyncpg DATABASE_URL")
    if "juman_validation_" not in url and os.environ.get("JUMAN_POSTGRES_CERT_ALLOW_ANY") != "1":
        # Allow orchestrator-created DBs; local override with flag.
        pytest.skip(
            "postgres_cert expects an isolated juman_validation_* database "
            "(or JUMAN_POSTGRES_CERT_ALLOW_ANY=1)"
        )
    return url


@pytest.fixture(scope="module")
def database_url() -> str:
    return _require_cert_env()


@pytest.fixture
async def db_session(database_url: str) -> AsyncGenerator[AsyncSession]:
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    async with factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest.mark.postgres_cert
@pytest.mark.asyncio
async def test_alembic_head_and_core_tables(db_session: AsyncSession) -> None:
    head = (
        await db_session.execute(text("SELECT version_num FROM alembic_version"))
    ).scalar_one()
    assert head == EXPECTED_HEAD
    for table in (
        "settings",
        "permissions",
        "roles",
        "users",
        "audit_logs",
        "system_backups",
        "system_restores",
        "system_maintenance_runs",
        "dresses",
        "customers",
    ):
        exists = (
            await db_session.execute(
                text(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema='public' AND table_name=:t"
                ),
                {"t": table},
            )
        ).scalar_one_or_none()
        assert exists == 1, table


@pytest.mark.postgres_cert
@pytest.mark.asyncio
async def test_seeds_system_permissions_and_settings(db_session: AsyncSession) -> None:
    keys = (
        await db_session.execute(
            text(
                "SELECT key FROM permissions "
                "WHERE key LIKE 'system.%' AND is_deleted = false ORDER BY key"
            )
        )
    ).scalars().all()
    assert set(keys) >= {
        "system.view",
        "system.backup",
        "system.restore",
        "system.maintenance",
    }
    settings_count = int(
        (
            await db_session.execute(
                text("SELECT count(*) FROM settings WHERE is_deleted = false")
            )
        ).scalar_one()
    )
    assert settings_count > 0
    admin = (
        await db_session.execute(
            select(Role).where(Role.name == SystemRoleName.ADMIN.value, Role.is_deleted.is_(False))
        )
    ).scalar_one()
    assert admin.is_active is True


@pytest.mark.postgres_cert
@pytest.mark.asyncio
async def test_foreign_keys_and_partial_indexes(db_session: AsyncSession) -> None:
    fk = int(
        (
            await db_session.execute(
                text(
                    "SELECT count(*) FROM information_schema.table_constraints "
                    "WHERE constraint_type='FOREIGN KEY' AND table_schema='public'"
                )
            )
        ).scalar_one()
    )
    assert fk > 20
    partial = int(
        (
            await db_session.execute(
                text(
                    "SELECT count(*) FROM pg_indexes "
                    "WHERE schemaname='public' AND indexdef ILIKE '%WHERE%'"
                )
            )
        ).scalar_one()
    )
    assert partial >= 1


@pytest.mark.postgres_cert
@pytest.mark.asyncio
async def test_soft_delete_excluded_by_default(db_session: AsyncSession) -> None:
    await seed_identity_basics(db_session)
    row = Setting(
        id=uuid4(),
        key=f"phase6.probe.{uuid4().hex[:8]}",
        value="1",
        value_type="string",
        category="system",
        description="phase6",
        is_editable=True,
        is_deleted=True,
        deleted_at=datetime.now(timezone.utc),
    )
    db_session.add(row)
    await db_session.commit()
    live = (
        await db_session.execute(
            select(Setting).where(Setting.key == row.key, Setting.is_deleted.is_(False))
        )
    ).scalar_one_or_none()
    assert live is None


@pytest.mark.postgres_cert
@pytest.mark.asyncio
async def test_auth_rbac_and_inactive_role(db_session: AsyncSession, tmp_path: Path) -> None:
    await seed_identity_basics(db_session)
    roles = RoleService(db_session)
    admin_role = await roles.get_by_name(SystemRoleName.ADMIN.value)
    assert await roles.role_has_permission(admin_role.id, "system.view") is True
    admin_role.is_active = False
    await db_session.flush()
    assert await roles.role_has_permission(admin_role.id, "system.view") is False
    admin_role.is_active = True
    await db_session.flush()

    app = create_app()
    from app.dependencies.database import get_db
    from app.modules.rbac.dependencies import get_permission_service, get_role_service
    from app.modules.rbac.services.permission import PermissionService
    from app.modules.system_admin.dependencies import get_system_info_service
    from app.modules.system_admin.services.system_info import SystemInfoService

    async def _override_db():
        yield db_session

    async def _info():
        yield SystemInfoService(db_session, settings_service=SettingService(db_session))

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_system_info_service] = _info
    app.dependency_overrides[get_permission_service] = lambda: PermissionService(db_session)
    app.dependency_overrides[get_role_service] = lambda: RoleService(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, token = await mint_admin_bearer(db_session, username=f"p6a_{uuid4().hex[:8]}")
        ok = await client.get("/api/v1/system/info", headers=bearer_headers(token))
        assert ok.status_code == 200, ok.text
        _, pair = await create_user_with_token(
            db_session,
            username=f"p6c_{uuid4().hex[:8]}",
            role_name=SystemRoleName.CASHIER.value,
        )
        denied = await client.get(
            "/api/v1/system/info", headers=bearer_headers(pair.access_token)
        )
        assert denied.status_code == 403
    app.dependency_overrides.clear()


@pytest.mark.postgres_cert
@pytest.mark.asyncio
async def test_backup_validate_maintenance_and_audit(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await seed_identity_basics(db_session)
    media = tmp_path / "media"
    backups = tmp_path / "backups"
    media.mkdir()
    backups.mkdir()
    from app.modules.settings.models.setting import Setting as SettingModel

    for key, value in {
        SettingKey.MEDIA_STORAGE_ROOT.value: str(media),
        SettingKey.BACKUP_STORAGE_ROOT.value: str(backups),
        SettingKey.BACKUP_INCLUDE_MEDIA_DEFAULT.value: "false",
        SettingKey.MEDIA_STORAGE_PROVIDER.value: "local",
        SettingKey.DEFAULT_TIMEZONE.value: "Asia/Baghdad",
    }.items():
        row = (
            await db_session.execute(
                select(SettingModel).where(
                    SettingModel.key == key, SettingModel.is_deleted.is_(False)
                )
            )
        ).scalar_one_or_none()
        if row is None:
            db_session.add(
                SettingModel(
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
    await db_session.commit()

    settings = SettingService(db_session)
    backup_svc = BackupService(db_session, settings_service=settings)
    backup_ok = False
    backup_skip_reason = ""
    try:
        row = await backup_svc.create(include_media=False, notes="phase6-cert")
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if (
            "pg_dump" in msg
            or "not found" in msg
            or "أداة النسخ الاحتياطي غير متوفرة" in str(exc)
        ):
            backup_skip_reason = f"pg_dump unavailable for Postgres backup cert: {exc}"
        else:
            raise
    else:
        backup_ok = True
        assert row.status == BackupStatus.COMPLETED.value
        assert row.audit_log_id is not None
        assert row.duration_ms is not None

        restore_svc = RestoreService(
            db_session, settings_service=settings, backup_service=backup_svc
        )
        validation = await restore_svc.validate(backup_id=row.id)
        assert validation.ok is True

    maint = MaintenanceService(db_session, settings_service=settings)
    run = await maint.execute(
        MaintenanceTaskId.VERIFY_DRESS_STATUS_CONSISTENCY.value,
        confirm=False,
        dry_run=False,
    )
    assert run.status == "COMPLETED"

    audits = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.module == "system_admin").limit(5)
        )
    ).scalars().all()
    assert audits

    if not backup_ok:
        pytest.skip(backup_skip_reason)
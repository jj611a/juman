"""Fixtures for System Administration Phase 1 tests."""

from collections.abc import AsyncGenerator
from datetime import datetime, timezone

import pytest
from app.database.base import Base
from app.main import create_app
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.calendar.models import DressCalendarBlock  # noqa: F401
from app.modules.categories.models import Category  # noqa: F401
from app.modules.customers.models import Customer  # noqa: F401
from app.modules.identity.models import (  # noqa: F401
    LoginHistory,
    LoginSession,
    PasswordHistory,
    RefreshToken,
    User,
)
from app.modules.inspection.models import Inspection, InspectionItem  # noqa: F401
from app.modules.inventory.models import BarcodeCounter, Dress, DressPhoto  # noqa: F401
from app.modules.media.models import FileReference, StoredFile  # noqa: F401
from app.modules.processing.models import ProcessingBatch, ProcessingItem  # noqa: F401
from app.modules.rbac.models import Permission, Role, RolePermission  # noqa: F401
from app.modules.rbac.services.permission import PermissionService
from app.modules.rbac.services.role import RoleService
from app.modules.rentals.models import Rental, RentalItem  # noqa: F401
from app.modules.reservations.models import Reservation, ReservationItem  # noqa: F401
from app.modules.returns.models import Return, ReturnItem  # noqa: F401
from app.modules.sales.models import Sale, SaleItem, SalePayment  # noqa: F401
from app.modules.settlements.models import (  # noqa: F401
    RentalSettlement,
    RentalSettlementAdjustment,
    RentalSettlementCharge,
    RentalSettlementPayment,
)
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.system_admin.models import (  # noqa: F401
    SystemBackup,
    SystemMaintenanceRun,
    SystemRestore,
)
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.restore import RestoreService
from app.modules.system_admin.services.diagnostics import DiagnosticsService
from app.modules.system_admin.services.maintenance import MaintenanceService
from app.modules.system_admin.services.metrics import MetricsService
from app.modules.system_admin.services.system_info import SystemInfoService
from app.modules.audit.services.audit_log import AuditService
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from tests.helpers.auth import bearer_headers, mint_admin_bearer
from tests.helpers.identity import seed_identity_basics


@pytest.fixture
async def db_session(tmp_path_factory: pytest.TempPathFactory) -> AsyncGenerator[AsyncSession]:
    db_file = tmp_path_factory.mktemp("sysadmin") / "test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file.as_posix()}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest.fixture
async def api_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    await seed_identity_basics(db_session)
    app = create_app()
    app.state.started_at = datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc)

    async def _override_db():
        yield db_session

    from app.dependencies.database import get_db
    from app.modules.rbac.dependencies import get_permission_service, get_role_service
    from app.modules.system_admin.dependencies import (
        get_backup_service,
        get_diagnostics_service,
        get_maintenance_service,
        get_metrics_service,
        get_restore_service,
        get_system_info_service,
    )

    async def _info():
        yield SystemInfoService(db_session, settings_service=SettingService(db_session))

    async def _diag():
        yield DiagnosticsService(db_session, settings_service=SettingService(db_session))

    async def _maint():
        yield MaintenanceService(
            db_session,
            settings_service=SettingService(db_session),
            audit_service=AuditService(db_session),
        )

    async def _metrics():
        yield MetricsService(
            db_session,
            system_info_service=SystemInfoService(
                db_session, settings_service=SettingService(db_session)
            ),
        )

    async def _backup():
        yield BackupService(db_session, settings_service=SettingService(db_session))

    async def _restore():
        settings = SettingService(db_session)
        backup = BackupService(db_session, settings_service=settings)
        yield RestoreService(
            db_session, settings_service=settings, backup_service=backup
        )

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_system_info_service] = _info
    app.dependency_overrides[get_diagnostics_service] = _diag
    app.dependency_overrides[get_maintenance_service] = _maint
    app.dependency_overrides[get_metrics_service] = _metrics
    app.dependency_overrides[get_backup_service] = _backup
    app.dependency_overrides[get_restore_service] = _restore
    app.dependency_overrides[get_permission_service] = lambda: PermissionService(db_session)
    app.dependency_overrides[get_role_service] = lambda: RoleService(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def admin_client(api_client: AsyncClient, db_session: AsyncSession) -> AsyncClient:
    _, token = await mint_admin_bearer(db_session, username="sys_admin")
    api_client.headers.update(bearer_headers(token))
    return api_client

"""Fixtures for Audit module tests."""

from collections.abc import AsyncGenerator

import pytest
from app.database.base import Base
from app.main import create_app
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.audit.services.audit_log import AuditService
from app.modules.identity.models import (  # noqa: F401
    LoginHistory,
    LoginSession,
    PasswordHistory,
    RefreshToken,
    User,
)
from app.modules.media.models import FileReference, StoredFile  # noqa: F401
from app.modules.rbac.models import Permission, Role, RolePermission  # noqa: F401
from app.modules.settings.models import Setting  # noqa: F401
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from tests.helpers.identity import seed_identity_basics


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
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
async def audit_service(db_session: AsyncSession) -> AuditService:
    await seed_identity_basics(db_session)
    return AuditService(db_session)


@pytest.fixture
async def api_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    from app.config.settings import get_settings
    from app.dependencies.database import get_db
    from app.modules.audit.dependencies import get_audit_service
    from app.modules.identity.dependencies import get_user_service
    from app.modules.identity.services.user import UserService
    from app.modules.rbac.dependencies import get_permission_service, get_role_service
    from app.modules.rbac.services.permission import PermissionService
    from app.modules.rbac.services.role import RoleService
    from app.modules.settings.dependencies import get_setting_service
    from app.modules.settings.services.setting import SettingService

    get_settings.cache_clear()
    app = create_app()

    async def _override_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_audit_service] = lambda: AuditService(db_session)
    app.dependency_overrides[get_user_service] = lambda: UserService(db_session)
    app.dependency_overrides[get_permission_service] = lambda: PermissionService(db_session)
    app.dependency_overrides[get_role_service] = lambda: RoleService(db_session)
    app.dependency_overrides[get_setting_service] = lambda: SettingService(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await seed_identity_basics(db_session)
        yield client

    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.fixture
async def admin_client(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> AsyncClient:
    from tests.helpers.auth import bearer_headers, mint_admin_bearer

    _, token = await mint_admin_bearer(db_session, username="audit_admin")
    api_client.headers.update(bearer_headers(token))
    return api_client

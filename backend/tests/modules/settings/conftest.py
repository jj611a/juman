"""Fixtures for Settings module tests using in-memory SQLite."""

from collections.abc import AsyncGenerator

import pytest
from app.database.base import Base
from app.main import create_app
from app.modules.identity.models import User  # noqa: F401
from app.modules.rbac.models import Permission, Role, RolePermission  # noqa: F401
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.settings.services.setting import SettingService
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from tests.modules.settings.seed_helpers import apply_migration_settings_seed


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    """Provide an isolated async SQLite session with schema created."""
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
async def setting_service(db_session: AsyncSession) -> SettingService:
    """Provide a SettingService with migration seeds applied."""
    await apply_migration_settings_seed(db_session)
    await db_session.commit()
    return SettingService(db_session)


@pytest.fixture
async def api_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    """Unauthenticated HTTP client with Settings DB dependency overridden."""
    from app.config.settings import get_settings
    from app.dependencies.database import get_db
    from app.modules.identity.dependencies import get_user_service
    from app.modules.identity.services.user import UserService
    from app.modules.rbac.dependencies import get_permission_service, get_role_service
    from app.modules.rbac.services.permission import PermissionService
    from app.modules.rbac.services.role import RoleService
    from app.modules.settings.dependencies import get_setting_service
    from tests.helpers.identity import seed_identity_basics

    get_settings.cache_clear()
    app = create_app()

    async def _override_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_setting_service] = lambda: SettingService(db_session)
    app.dependency_overrides[get_permission_service] = lambda: PermissionService(db_session)
    app.dependency_overrides[get_role_service] = lambda: RoleService(db_session)
    app.dependency_overrides[get_user_service] = lambda: UserService(db_session)

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
    """Authenticated Admin client for Settings API tests."""
    from tests.helpers.auth import bearer_headers, mint_admin_bearer

    _, token = await mint_admin_bearer(db_session, username="settings_admin")
    api_client.headers.update(bearer_headers(token))
    return api_client

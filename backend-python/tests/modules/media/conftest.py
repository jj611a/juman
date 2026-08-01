"""Fixtures for Media module tests."""

from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from app.database.base import Base
from app.main import create_app
from app.modules.identity.models import User  # noqa: F401
from app.modules.media.models import FileReference, StoredFile  # noqa: F401
from app.modules.media.providers.local import LocalStorageProvider
from app.modules.media.services.media import MediaService
from app.modules.rbac.models import Permission, Role, RolePermission  # noqa: F401
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.settings.services.setting import SettingService
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
def storage_root(tmp_path: Path) -> Path:
    root = tmp_path / "media"
    root.mkdir(parents=True, exist_ok=True)
    return root


@pytest.fixture
async def media_service(
    db_session: AsyncSession,
    storage_root: Path,
) -> MediaService:
    await seed_identity_basics(db_session)
    settings = SettingService(db_session)
    provider = LocalStorageProvider(storage_root)
    return MediaService(db_session, settings=settings, provider=provider)


@pytest.fixture
async def api_client(
    db_session: AsyncSession,
    storage_root: Path,
) -> AsyncGenerator[AsyncClient]:
    from app.config.settings import get_settings
    from app.dependencies.database import get_db
    from app.modules.identity.dependencies import get_user_service
    from app.modules.identity.services.user import UserService
    from app.modules.media.dependencies import get_media_service
    from app.modules.rbac.dependencies import get_permission_service, get_role_service
    from app.modules.rbac.services.permission import PermissionService
    from app.modules.rbac.services.role import RoleService
    from app.modules.settings.dependencies import get_setting_service

    get_settings.cache_clear()
    app = create_app()

    async def _override_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    def _media_service() -> MediaService:
        return MediaService(
            db_session,
            settings=SettingService(db_session),
            provider=LocalStorageProvider(storage_root),
        )

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_user_service] = lambda: UserService(db_session)
    app.dependency_overrides[get_permission_service] = lambda: PermissionService(db_session)
    app.dependency_overrides[get_role_service] = lambda: RoleService(db_session)
    app.dependency_overrides[get_setting_service] = lambda: SettingService(db_session)
    app.dependency_overrides[get_media_service] = _media_service

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
    """Authenticated Admin client for Media API tests."""
    from tests.helpers.auth import bearer_headers, mint_admin_bearer

    _, token = await mint_admin_bearer(db_session, username="media_admin")
    api_client.headers.update(bearer_headers(token))
    return api_client

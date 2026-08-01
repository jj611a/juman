"""Fixtures for Inventory / Dresses module tests."""

from collections.abc import AsyncGenerator

import pytest
from app.database.base import Base
from app.main import create_app
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.audit.services.audit_log import AuditService
from app.modules.categories.models import Category  # noqa: F401
from app.modules.categories.services.category import CategoryService
from app.modules.identity.models import (  # noqa: F401
    LoginHistory,
    LoginSession,
    PasswordHistory,
    RefreshToken,
    User,
)
from app.modules.inventory.models import BarcodeCounter, Dress, DressPhoto  # noqa: F401
from app.modules.inventory.services.barcode import BarcodeService
from app.modules.inventory.services.dress import DressService
from app.modules.inventory.services.dress_photo import DressPhotoService
from app.modules.media.models import FileReference, StoredFile  # noqa: F401
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
async def dress_service(db_session: AsyncSession) -> DressService:
    await seed_identity_basics(db_session)
    settings = SettingService(db_session)
    return DressService(
        db_session,
        settings=settings,
        barcodes=BarcodeService(db_session, settings=settings),
        audit=AuditService(db_session),
    )


@pytest.fixture
async def barcode_service(db_session: AsyncSession) -> BarcodeService:
    await seed_identity_basics(db_session)
    settings = SettingService(db_session)
    return BarcodeService(db_session, settings=settings)


@pytest.fixture
async def category_service(db_session: AsyncSession) -> CategoryService:
    await seed_identity_basics(db_session)
    return CategoryService(db_session, audit=AuditService(db_session))


@pytest.fixture
async def sample_category(category_service: CategoryService):
    return await category_service.create_category(name_ar="سهرة", name_en="Evening")


@pytest.fixture
async def api_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    from app.config.settings import get_settings
    from app.dependencies.database import get_db
    from app.modules.categories.dependencies import get_category_service
    from app.modules.identity.dependencies import get_user_service
    from app.modules.identity.services.user import UserService
    from app.modules.inventory.dependencies import (
        get_dress_photo_service,
        get_dress_service,
        get_dress_status_service,
    )
    from app.modules.inventory.services.dress_status import DressStatusService
    from app.modules.rbac.dependencies import get_permission_service, get_role_service
    from app.modules.rbac.services.permission import PermissionService
    from app.modules.rbac.services.role import RoleService
    from app.modules.settings.dependencies import get_setting_service

    get_settings.cache_clear()
    app = create_app()

    async def _override_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    settings = SettingService(db_session)

    def _dress_service() -> DressService:
        return DressService(
            db_session,
            settings=settings,
            barcodes=BarcodeService(db_session, settings=settings),
            audit=AuditService(db_session),
        )

    def _photo_service() -> DressPhotoService:
        return DressPhotoService(
            db_session,
            settings=settings,
            audit=AuditService(db_session),
        )

    def _status_service() -> DressStatusService:
        return DressStatusService(db_session, audit=AuditService(db_session))

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_dress_service] = _dress_service
    app.dependency_overrides[get_dress_photo_service] = _photo_service
    app.dependency_overrides[get_dress_status_service] = _status_service
    app.dependency_overrides[get_category_service] = lambda: CategoryService(
        db_session,
        audit=AuditService(db_session),
    )
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

    _, token = await mint_admin_bearer(db_session, username="inventory_admin")
    api_client.headers.update(bearer_headers(token))
    return api_client

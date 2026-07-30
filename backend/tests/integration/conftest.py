"""Fixtures wiring every module service for full cross-module workflow tests."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest
from app.database.base import Base
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.models import DressCalendarBlock  # noqa: F401
from app.modules.calendar.services.calendar import CalendarService
from app.modules.categories.models import Category  # noqa: F401
from app.modules.categories.services.category import CategoryService
from app.modules.customers.models import Customer  # noqa: F401
from app.modules.customers.services.customer import CustomerService
from app.modules.identity.models import (  # noqa: F401
    LoginHistory,
    LoginSession,
    PasswordHistory,
    RefreshToken,
    User,
)
from app.modules.inspection.models import Inspection, InspectionItem  # noqa: F401
from app.modules.inspection.services.inspection import InspectionService
from app.modules.inventory.models import BarcodeCounter, Dress, DressPhoto  # noqa: F401
from app.modules.inventory.services.barcode import BarcodeService
from app.modules.inventory.services.dress import DressService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.media.models import FileReference, StoredFile  # noqa: F401
from app.modules.processing.models import ProcessingBatch, ProcessingItem  # noqa: F401
from app.modules.processing.services.processing import ProcessingService
from app.modules.rbac.models import Permission, Role, RolePermission  # noqa: F401
from app.modules.rentals.models import Rental, RentalItem  # noqa: F401
from app.modules.rentals.services.rental import RentalService
from app.modules.reservations.models import Reservation, ReservationItem  # noqa: F401
from app.modules.reservations.services.reservation import ReservationService
from app.modules.returns.models import Return, ReturnItem  # noqa: F401
from app.modules.returns.services.return_service import ReturnService
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.settings.services.setting import SettingService
from app.modules.settlements.models import (  # noqa: F401
    RentalSettlement,
    RentalSettlementAdjustment,
    RentalSettlementCharge,
    RentalSettlementPayment,
)
from app.modules.settlements.services.settlement import SettlementService
from sqlalchemy import select
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


def utc(*args: int) -> datetime:
    year, month, day = args[0], args[1], args[2]
    hour = args[3] if len(args) > 3 else 0
    minute = args[4] if len(args) > 4 else 0
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


async def set_setting(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


@pytest.fixture
async def audit(db_session: AsyncSession) -> AuditService:
    return AuditService(db_session)


@pytest.fixture
async def settings_service(db_session: AsyncSession) -> SettingService:
    return SettingService(db_session)


@pytest.fixture
async def calendar_service(db_session: AsyncSession, audit: AuditService) -> CalendarService:
    return CalendarService(db_session, audit=audit)


@pytest.fixture
async def dress_status_service(
    db_session: AsyncSession, audit: AuditService
) -> DressStatusService:
    return DressStatusService(db_session, audit=audit)


@pytest.fixture
async def category_service(db_session: AsyncSession, audit: AuditService) -> CategoryService:
    await seed_identity_basics(db_session)
    return CategoryService(db_session, audit=audit)


@pytest.fixture
async def customer_service(
    db_session: AsyncSession, settings_service: SettingService, audit: AuditService
) -> CustomerService:
    await seed_identity_basics(db_session)
    return CustomerService(db_session, settings=settings_service, audit=audit)


@pytest.fixture
async def dress_service(
    db_session: AsyncSession, settings_service: SettingService, audit: AuditService
) -> DressService:
    await seed_identity_basics(db_session)
    return DressService(
        db_session,
        settings=settings_service,
        barcodes=BarcodeService(db_session, settings=settings_service),
        audit=audit,
    )


@pytest.fixture
async def reservation_service(
    db_session: AsyncSession,
    settings_service: SettingService,
    calendar_service: CalendarService,
    dress_status_service: DressStatusService,
    audit: AuditService,
) -> ReservationService:
    await seed_identity_basics(db_session)
    return ReservationService(
        db_session,
        settings=settings_service,
        calendar=calendar_service,
        dress_status=dress_status_service,
        audit=audit,
    )


@pytest.fixture
async def rental_service(
    db_session: AsyncSession,
    settings_service: SettingService,
    calendar_service: CalendarService,
    dress_status_service: DressStatusService,
    audit: AuditService,
) -> RentalService:
    await seed_identity_basics(db_session)
    return RentalService(
        db_session,
        settings=settings_service,
        calendar=calendar_service,
        dress_status=dress_status_service,
        audit=audit,
    )


@pytest.fixture
async def return_service(
    db_session: AsyncSession,
    settings_service: SettingService,
    dress_status_service: DressStatusService,
    rental_service: RentalService,
    audit: AuditService,
) -> ReturnService:
    return ReturnService(
        db_session,
        settings=settings_service,
        dress_status=dress_status_service,
        rentals=rental_service,
        audit=audit,
    )


@pytest.fixture
async def inspection_service(
    db_session: AsyncSession,
    settings_service: SettingService,
    dress_status_service: DressStatusService,
    return_service: ReturnService,
    audit: AuditService,
) -> InspectionService:
    return InspectionService(
        db_session,
        settings=settings_service,
        dress_status=dress_status_service,
        returns=return_service,
        audit=audit,
    )


@pytest.fixture
async def processing_service(
    db_session: AsyncSession,
    settings_service: SettingService,
    calendar_service: CalendarService,
    dress_status_service: DressStatusService,
    audit: AuditService,
) -> ProcessingService:
    return ProcessingService(
        db_session,
        settings=settings_service,
        calendar=calendar_service,
        dress_status=dress_status_service,
        audit=audit,
    )


@pytest.fixture
async def settlement_service(
    db_session: AsyncSession,
    settings_service: SettingService,
    audit: AuditService,
) -> SettlementService:
    return SettlementService(db_session, settings=settings_service, audit=audit)


@pytest.fixture
async def sample_category(category_service: CategoryService) -> Category:
    return await category_service.create_category(name_ar="فساتين سهرة", name_en="Evening")


@pytest.fixture
async def sample_customer(customer_service: CustomerService) -> Customer:
    return await customer_service.create_customer(
        full_name="سارة أحمد",
        phone="07701234567",
        address="بغداد - الكرادة",
    )

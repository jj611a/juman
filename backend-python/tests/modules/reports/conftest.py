"""Fixtures for Reports module tests."""

from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from app.database.base import Base
from app.main import create_app
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.models import DressCalendarBlock  # noqa: F401
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
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.models import BarcodeCounter, Dress, DressPhoto  # noqa: F401
from app.modules.inventory.services.barcode import BarcodeService
from app.modules.inventory.services.dress import DressService
from app.modules.media.models import FileReference, StoredFile  # noqa: F401
from app.modules.processing.models import ProcessingBatch, ProcessingItem  # noqa: F401
from app.modules.rbac.models import Permission, Role, RolePermission  # noqa: F401
from app.modules.rbac.services.permission import PermissionService
from app.modules.rbac.services.role import RoleService
from app.modules.rentals.constants import RentalStatus
from app.modules.rentals.models import Rental, RentalItem  # noqa: F401
from app.modules.reports.services.report import ReportService
from app.modules.reservations.models import Reservation, ReservationItem  # noqa: F401
from app.modules.returns.models import Return, ReturnItem  # noqa: F401
from app.modules.sales.constants import SaleOrigin, SaleStatus
from app.modules.sales.models import Sale, SaleItem, SalePayment  # noqa: F401
from app.modules.settlements.constants import SettlementStatus
from app.modules.settlements.models import (  # noqa: F401
    RentalSettlement,
    RentalSettlementAdjustment,
    RentalSettlementCharge,
    RentalSettlementPayment,
)
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.settings.services.setting import SettingService
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from tests.helpers.auth import bearer_headers, mint_admin_bearer
from tests.helpers.identity import seed_identity_basics


def utc(*args: int) -> datetime:
    year, month, day = args[0], args[1], args[2]
    hour = args[3] if len(args) > 3 else 0
    minute = args[4] if len(args) > 4 else 0
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


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
async def report_service(db_session: AsyncSession) -> ReportService:
    await seed_identity_basics(db_session)
    return ReportService(db_session, settings=SettingService(db_session))


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
async def customer_service(db_session: AsyncSession) -> CustomerService:
    await seed_identity_basics(db_session)
    return CustomerService(
        db_session,
        settings=SettingService(db_session),
        audit=AuditService(db_session),
    )


@pytest.fixture
async def sample_category(db_session: AsyncSession):
    await seed_identity_basics(db_session)
    return await CategoryService(db_session, audit=AuditService(db_session)).create_category(
        name_ar="تقارير",
        name_en="Reports",
    )


@pytest.fixture
async def sample_customer(customer_service: CustomerService):
    return await customer_service.create_customer(
        full_name="زبونة تقارير",
        phone="07001112233",
    )


@pytest.fixture
async def sample_dress(dress_service: DressService, sample_category):
    return await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="فستان تقارير",
        size="M",
        colour="RED",
        purchase_price=100000,
        default_daily_rental_price=25000,
        default_sale_price=500000,
        brand="Juman",
    )


@pytest.fixture
async def api_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    await seed_identity_basics(db_session)
    app = create_app()

    async def _override_db():
        yield db_session

    from app.dependencies.database import get_db
    from app.modules.rbac.dependencies import get_permission_service, get_role_service
    from app.modules.reports.dependencies import get_report_service

    async def _report():
        yield ReportService(db_session, settings=SettingService(db_session))

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_report_service] = _report
    app.dependency_overrides[get_permission_service] = lambda: PermissionService(db_session)
    app.dependency_overrides[get_role_service] = lambda: RoleService(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def admin_client(api_client: AsyncClient, db_session: AsyncSession) -> AsyncClient:
    _, token = await mint_admin_bearer(db_session, username="rpt_admin")
    api_client.headers.update(bearer_headers(token))
    return api_client


async def insert_completed_sale(
    session: AsyncSession,
    *,
    dress: Dress,
    amount: int,
    sold_at: datetime,
    origin: str = SaleOrigin.NORMAL_SALE.value,
    sold_by=None,
    customer_id=None,
) -> Sale:
    sale = Sale(
        id=uuid4(),
        sale_number=f"SAL-{uuid4().hex[:8].upper()}",
        origin=origin,
        status=SaleStatus.COMPLETED.value,
        customer_id=customer_id,
        rental_id=None,
        return_id=None,
        inspection_id=None,
        total_amount=amount,
        sold_at=sold_at,
        sold_by=sold_by,
        notes=None,
    )
    session.add(sale)
    await session.flush()
    session.add(
        SaleItem(
            id=uuid4(),
            sale_id=sale.id,
            dress_id=dress.id,
            default_sale_price=dress.default_sale_price,
            actual_sale_price=amount,
            inspection_item_id=None,
            notes=None,
        )
    )
    session.add(
        SalePayment(
            id=uuid4(),
            sale_id=sale.id,
            amount=amount,
            payment_method="CASH",
            received_at=sold_at,
            received_by=sold_by,
            reference_number=None,
            notes=None,
        )
    )
    dress.status = DressStatus.SOLD.value
    await session.flush()
    return sale


async def insert_active_rental(
    session: AsyncSession,
    *,
    customer: Customer,
    dress: Dress,
    rental_at: datetime,
    expected_return_at: datetime,
    status: str = RentalStatus.ACTIVE.value,
) -> Rental:
    rental = Rental(
        id=uuid4(),
        rental_number=f"RENT-{uuid4().hex[:8].upper()}",
        customer_id=customer.id,
        reservation_id=None,
        rental_at=rental_at,
        expected_return_at=expected_return_at,
        status=status,
        initial_payment_type="FIXED",
        initial_payment_rate=None,
        initial_payment_value=10000,
        estimated_total=25000,
        notes=None,
    )
    session.add(rental)
    await session.flush()
    item_id = uuid4()
    session.add(
        RentalItem(
            id=item_id,
            rental_id=rental.id,
            dress_id=dress.id,
            agreed_daily_rental_price=25000,
            expected_rental_days=1,
            calendar_block_id=None,
            notes=None,
        )
    )
    if status == RentalStatus.ACTIVE.value:
        dress.status = DressStatus.RENTED.value
    await session.flush()
    rental._test_item_id = item_id  # type: ignore[attr-defined]
    return rental


async def insert_settlement(
    session: AsyncSession,
    *,
    rental: Rental,
    created_at: datetime,
    gross: int = 30000,
    paid: int = 30000,
    status: str = SettlementStatus.PAID.value,
) -> RentalSettlement:
    ret = Return(
        id=uuid4(),
        return_number=f"RET-{uuid4().hex[:8].upper()}",
        rental_id=rental.id,
        customer_id=rental.customer_id,
        returned_at=created_at,
        status="PENDING_INSPECTION",
        notes=None,
    )
    session.add(ret)
    await session.flush()
    settlement = RentalSettlement(
        id=uuid4(),
        settlement_number=f"STL-{uuid4().hex[:8].upper()}",
        rental_id=rental.id,
        return_id=ret.id,
        status=status,
        rental_charge_amount=gross,
        initial_payment_credit=0,
        late_penalty_amount=0,
        minor_damage_penalty_amount=0,
        manual_adjustment_amount=0,
        gross_total=gross,
        total_due=gross,
        total_paid=paid,
        remaining_balance=max(0, gross - paid),
        settled_at=created_at if status == SettlementStatus.PAID.value else None,
        settled_by=None,
        notes=None,
    )
    session.add(settlement)
    await session.flush()
    # backdate created_at
    settlement.created_at = created_at
    if paid:
        pay = RentalSettlementPayment(
            id=uuid4(),
            settlement_id=settlement.id,
            amount=paid,
            payment_method="CASH",
            received_at=created_at,
            received_by=None,
            reference_number=None,
            notes=None,
        )
        session.add(pay)
    await session.flush()
    return settlement

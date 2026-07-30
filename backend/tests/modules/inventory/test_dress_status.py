"""DressStatusService and status API tests."""

from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress import DressService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.inventory.status_transitions import ALLOWED_TRANSITIONS
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


VALID_EDGES: list[tuple[DressStatus, DressStatus]] = [
    (src, dst)
    for src, targets in ALLOWED_TRANSITIONS.items()
    for dst in targets
]


async def _make_dress(dress_service: DressService, category_id):
    return await dress_service.create_dress(
        category_id=category_id,
        name_ar="فستان حالة",
        size="M",
        colour="BLACK",
        purchase_price=1000,
        default_daily_rental_price=100,
        default_sale_price=1500,
    )


async def _force_status(db_session: AsyncSession, dress_id, status: DressStatus) -> None:
    """Test helper: set status without the engine (setup only)."""
    from app.modules.inventory.repositories.dress import DressRepository

    repo = DressRepository(db_session)
    dress = await repo.get_by_id(dress_id)
    assert dress is not None
    await repo.update_fields(dress, status=status.value)


@pytest.fixture
async def status_service(db_session: AsyncSession) -> DressStatusService:
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    return DressStatusService(db_session, audit=AuditService(db_session))


@pytest.mark.asyncio
@pytest.mark.parametrize(("from_status", "to_status"), VALID_EDGES)
async def test_every_valid_transition(
    dress_service: DressService,
    status_service: DressStatusService,
    sample_category,
    db_session: AsyncSession,
    from_status: DressStatus,
    to_status: DressStatus,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    await _force_status(db_session, dress.id, from_status)
    result = await status_service.change_status(
        dress.id,
        to_status,
        reason="انتقال صالح",
        actor_username="admin",
    )
    assert result.previous_status == from_status.value
    assert result.new_status == to_status.value
    assert result.allowed_transitions == status_service.get_allowed_transitions_for_status(
        to_status
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("from_status", "to_status"),
    [
        (DressStatus.AVAILABLE, DressStatus.AVAILABLE),
        (DressStatus.AVAILABLE, DressStatus.INSPECTION),
        (DressStatus.AVAILABLE, DressStatus.PROCESSING),
        (DressStatus.AVAILABLE, DressStatus.RUINED),
        (DressStatus.AVAILABLE, DressStatus.RETURNED),
        (DressStatus.RESERVED, DressStatus.SOLD),
        (DressStatus.RESERVED, DressStatus.INSPECTION),
        (DressStatus.RENTED, DressStatus.AVAILABLE),
        (DressStatus.RENTED, DressStatus.RETURNED),
        (DressStatus.RENTED, DressStatus.PROCESSING),
        (DressStatus.INSPECTION, DressStatus.RESERVED),
        (DressStatus.INSPECTION, DressStatus.RUINED),
        (DressStatus.INSPECTION, DressStatus.SOLD),
        (DressStatus.PROCESSING, DressStatus.RENTED),
        (DressStatus.PROCESSING, DressStatus.INSPECTION),
        (DressStatus.SOLD, DressStatus.AVAILABLE),
        (DressStatus.SOLD, DressStatus.RUINED),
        (DressStatus.RUINED, DressStatus.AVAILABLE),
        (DressStatus.RUINED, DressStatus.SOLD),
        (DressStatus.RUINED_PENDING_SALE, DressStatus.AVAILABLE),
        (DressStatus.RUINED_PENDING_SALE, DressStatus.PROCESSING),
        (DressStatus.RETURNED, DressStatus.INSPECTION),
        (DressStatus.AVAILABLE, DressStatus.RETURNED),
    ],
)
async def test_invalid_transitions_rejected(
    dress_service: DressService,
    status_service: DressStatusService,
    sample_category,
    db_session: AsyncSession,
    from_status: DressStatus,
    to_status: DressStatus,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    await _force_status(db_session, dress.id, from_status)
    with pytest.raises(ValidationError):
        await status_service.change_status(dress.id, to_status)


@pytest.mark.asyncio
async def test_terminals_have_no_allowed_transitions(
    status_service: DressStatusService,
) -> None:
    assert status_service.get_allowed_transitions_for_status(DressStatus.SOLD) == []
    assert status_service.get_allowed_transitions_for_status(DressStatus.RUINED) == []


@pytest.mark.asyncio
async def test_change_status_audit_and_helpers(
    dress_service: DressService,
    status_service: DressStatusService,
    sample_category,
    db_session: AsyncSession,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    assert await status_service.get_current_status(dress.id) == DressStatus.AVAILABLE.value
    allowed = await status_service.get_allowed_transitions(dress.id)
    assert set(allowed) == {"RENTED", "RESERVED", "SOLD"}

    result = await status_service.change_status(
        dress.id,
        "rented",
        reason="تأجير مباشر",
        actor_username="admin",
    )
    assert result.new_status == DressStatus.RENTED.value

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(
        module="inventory",
        entity_id=str(dress.id),
        action=AuditAction.STATUS_CHANGED.value,
    )
    assert logs
    assert logs[0].old_values == {"status": "AVAILABLE"}
    assert logs[0].new_values == {"status": "RENTED"}
    assert logs[0].metadata_json == {"reason": "تأجير مباشر"}

    with pytest.raises(NotFoundError):
        await status_service.change_status(uuid4(), DressStatus.RESERVED)
    with pytest.raises(ValidationError):
        await status_service.change_status(
            dress.id,
            DressStatus.INSPECTION,
            reason="x" * 501,
        )


@pytest.mark.asyncio
async def test_status_api_flow(
    admin_client: AsyncClient,
    dress_service: DressService,
    sample_category,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)

    ok = await admin_client.post(
        f"/api/v1/dresses/{dress.id}/status",
        json={"new_status": "RESERVED", "reason": "حجز"},
    )
    assert ok.status_code == 200, ok.text
    body = ok.json()["data"]
    assert body["previous_status"] == "AVAILABLE"
    assert body["new_status"] == "RESERVED"
    assert body["reason"] == "حجز"
    assert "AVAILABLE" in body["allowed_transitions"]

    bad = await admin_client.post(
        f"/api/v1/dresses/{dress.id}/status",
        json={"new_status": "SOLD"},
    )
    assert bad.status_code == 422

    # PATCH must not change status even if extra field sent (ignored by schema)
    patched = await admin_client.patch(
        f"/api/v1/dresses/{dress.id}",
        json={"brand": "X", "status": "SOLD"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["status"] == "RESERVED"


@pytest.mark.asyncio
async def test_status_api_authz(
    api_client: AsyncClient,
    dress_service: DressService,
    sample_category,
    db_session: AsyncSession,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    unauth = await api_client.post(
        f"/api/v1/dresses/{dress.id}/status",
        json={"new_status": "RESERVED"},
    )
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="status_viewer",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    # Laundry has inventory.view but not update
    forbidden = await api_client.post(
        f"/api/v1/dresses/{dress.id}/status",
        headers=bearer_headers(pair.access_token),
        json={"new_status": "RESERVED"},
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_dependency_status_factory(db_session: AsyncSession) -> None:
    from app.modules.inventory.dependencies import get_dress_status_service
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    svc = await get_dress_status_service(db_session)
    assert isinstance(svc, DressStatusService)

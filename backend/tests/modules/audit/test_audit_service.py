"""AuditService unit/integration tests."""

from datetime import timedelta
from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.utils.datetime import utc_now


@pytest.mark.asyncio
async def test_record_and_list(audit_service: AuditService) -> None:
    entity_id = uuid4()
    user_id = uuid4()
    created = await audit_service.record_create(
        module="Settings",
        entity_type="Setting",
        entity_id=entity_id,
        new_values={"key": "currency", "value": "IQD"},
        user_id=user_id,
        username="AdminUser",
        ip_address="127.0.0.1",
        metadata={"request_id": "req-1"},
        message="seed currency",
    )
    assert created.module == "settings"
    assert created.action == AuditAction.CREATE
    assert created.entity_id == str(entity_id)
    assert created.username == "adminuser"
    assert created.old_values is None
    assert created.new_values == {"key": "currency", "value": "IQD"}
    assert created.metadata_json == {"request_id": "req-1"}

    await audit_service.record_update(
        module="settings",
        entity_type="Setting",
        entity_id=entity_id,
        old_values={"value": "IQD"},
        new_values={"value": "USD"},
        user_id=user_id,
        username="adminuser",
    )
    await audit_service.record_delete(
        module="settings",
        entity_type="Setting",
        entity_id=entity_id,
        old_values={"key": "currency"},
        soft=True,
        user_id=user_id,
        username="adminuser",
    )

    items, total = await audit_service.list_logs(module="settings")
    assert total == 3
    assert len(items) == 3
    assert items[0].action == AuditAction.SOFT_DELETE

    filtered, count = await audit_service.list_logs(action=AuditAction.UPDATE.value)
    assert count == 1
    assert filtered[0].new_values == {"value": "USD"}


@pytest.mark.asyncio
async def test_record_hard_delete_and_custom(audit_service: AuditService) -> None:
    row = await audit_service.record_delete(
        module="media",
        entity_type="StoredFile",
        entity_id=uuid4(),
        soft=False,
        old_values={"path": "/a.png"},
    )
    assert row.action == AuditAction.DELETE

    custom = await audit_service.record(
        module="identity",
        entity_type="User",
        entity_id=uuid4(),
        action=AuditAction.ACTIVATE,
        new_values={"is_active": True},
        username="ops",
    )
    assert custom.action == "activate"


@pytest.mark.asyncio
async def test_get_log_and_not_found(audit_service: AuditService) -> None:
    row = await audit_service.record_create(
        module="rbac",
        entity_type="Role",
        entity_id=uuid4(),
        new_values={"name": "Supervisor"},
    )
    got = await audit_service.get_log(row.id)
    assert got.id == row.id

    with pytest.raises(NotFoundError):
        await audit_service.get_log(uuid4())


@pytest.mark.asyncio
async def test_filters_q_and_dates(audit_service: AuditService) -> None:
    now = utc_now()
    early = await audit_service.record(
        module="inventory",
        entity_type="Dress",
        entity_id="dress-1",
        action=AuditAction.UPDATE,
        username="cashier1",
    )
    early.created_at = now - timedelta(days=2)
    await audit_service.session.flush()

    await audit_service.record(
        module="inventory",
        entity_type="Dress",
        entity_id="dress-2",
        action=AuditAction.CREATE,
        username="cashier2",
    )

    by_q, total_q = await audit_service.list_logs(q="dress-2")
    assert total_q == 1
    assert by_q[0].entity_id == "dress-2"

    by_user, total_user = await audit_service.list_logs(username="Cashier1")
    assert total_user == 1

    by_range, total_range = await audit_service.list_logs(
        created_from=now - timedelta(hours=1),
    )
    assert total_range == 1
    assert by_range[0].entity_id == "dress-2"

    by_to, total_to = await audit_service.list_logs(
        created_to=now - timedelta(days=1),
    )
    assert total_to == 1
    assert by_to[0].entity_id == "dress-1"

    by_entity, total_entity = await audit_service.list_logs(
        entity_type="Dress",
        entity_id="dress-1",
    )
    assert total_entity == 1
    assert "Dress" in repr(by_entity[0])


@pytest.mark.asyncio
async def test_record_validation(audit_service: AuditService) -> None:
    with pytest.raises(ValidationError):
        await audit_service.record(
            module="  ",
            entity_type="X",
            action=AuditAction.CUSTOM,
        )
    with pytest.raises(ValidationError):
        await audit_service.record(
            module="settings",
            entity_type=" ",
            action=AuditAction.CUSTOM,
        )

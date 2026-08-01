"""Identity Phase 1 UserService tests."""

import pytest
from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_get_list_update(user_service: UserService, db_session: AsyncSession) -> None:
    roles = RoleService(db_session)
    cashier = await roles.get_by_name(SystemRoleName.CASHIER.value)

    created = await user_service.create_user(
        username="Cashier1",
        password="Password1!",
        full_name="Cashier One",
        role_id=cashier.id,
        email="c1@example.com",
        phone="+9647700000001",
    )
    assert created.username == "cashier1"
    assert created.role_id == cashier.id
    assert created.must_change_password is True

    fetched = await user_service.get_user(created.id)
    assert fetched.id == created.id

    items, total = await user_service.list_users()
    assert total >= 1
    assert any(u.id == created.id for u in items)

    updated = await user_service.update_user(
        created.id,
        full_name="Cashier Updated",
        phone="+9647700000002",
    )
    assert updated.full_name == "Cashier Updated"


@pytest.mark.asyncio
async def test_username_unique_and_immutable(
    user_service: UserService,
    db_session: AsyncSession,
) -> None:
    roles = RoleService(db_session)
    cashier = await roles.get_by_name(SystemRoleName.CASHIER.value)
    await user_service.create_user(
        username="dupuser",
        password="Password1!",
        full_name="One",
        role_id=cashier.id,
    )
    with pytest.raises(ConflictError):
        await user_service.create_user(
            username="DupUser",
            password="Password1!",
            full_name="Two",
            role_id=cashier.id,
        )


@pytest.mark.asyncio
async def test_role_must_exist(user_service: UserService) -> None:
    from uuid import uuid4

    with pytest.raises(NotFoundError):
        await user_service.create_user(
            username="norole",
            password="Password1!",
            full_name="No Role",
            role_id=uuid4(),
        )


@pytest.mark.asyncio
async def test_activate_deactivate_soft_delete(
    user_service: UserService,
    db_session: AsyncSession,
) -> None:
    roles = RoleService(db_session)
    cashier = await roles.get_by_name(SystemRoleName.CASHIER.value)
    user = await user_service.create_user(
        username="tempuser",
        password="Password1!",
        full_name="Temp",
        role_id=cashier.id,
    )
    deactivated = await user_service.deactivate_user(user.id)
    assert deactivated.is_active is False
    activated = await user_service.activate_user(user.id)
    assert activated.is_active is True
    await user_service.soft_delete_user(user.id)
    with pytest.raises(NotFoundError):
        await user_service.get_user(user.id)


@pytest.mark.asyncio
async def test_last_admin_protected(
    user_service: UserService,
    db_session: AsyncSession,
) -> None:
    roles = RoleService(db_session)
    admin = await roles.get_by_name(SystemRoleName.ADMIN.value)
    only = await user_service.create_user(
        username="onlyadmin",
        password="Password1!",
        full_name="Only Admin",
        role_id=admin.id,
    )
    with pytest.raises(BusinessError):
        await user_service.deactivate_user(only.id)


@pytest.mark.asyncio
async def test_short_password_rejected(
    user_service: UserService,
    db_session: AsyncSession,
) -> None:
    roles = RoleService(db_session)
    cashier = await roles.get_by_name(SystemRoleName.CASHIER.value)
    with pytest.raises(ValidationError):
        await user_service.create_user(
            username="shortpwd",
            password="short",
            full_name="Short",
            role_id=cashier.id,
        )

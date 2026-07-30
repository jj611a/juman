"""Phase 5 — inactive role fail-closed permissions."""

from __future__ import annotations

import pytest
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.identity import seed_identity_basics


@pytest.mark.asyncio
async def test_inactive_role_denies_permission(db_session: AsyncSession) -> None:
    await seed_identity_basics(db_session)
    roles = RoleService(db_session)
    admin = await roles.get_by_name(SystemRoleName.ADMIN.value)
    assert admin is not None
    assert await roles.role_has_permission(admin.id, "system.view") is True

    admin.is_active = False
    await db_session.flush()
    assert await roles.role_has_permission(admin.id, "system.view") is False

    admin.is_active = True
    await db_session.flush()
    assert await roles.role_has_permission(admin.id, "system.view") is True


@pytest.mark.asyncio
async def test_missing_role_denies_permission(db_session: AsyncSession) -> None:
    await seed_identity_basics(db_session)
    roles = RoleService(db_session)
    from uuid import uuid4

    assert await roles.role_has_permission(uuid4(), "system.view") is False

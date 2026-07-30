"""Shared helpers for Identity Phase 1 tests."""

from __future__ import annotations

from uuid import UUID

from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.settings.seed_helpers import apply_migration_settings_seed


async def seed_identity_basics(session: AsyncSession) -> UUID:
    """
    Seed RBAC defaults and settings.

    Returns the Admin role id (no bootstrap user — Phase 1 has no auth).
    """
    await apply_migration_settings_seed(session)
    role_service = RoleService(session)
    await role_service.ensure_defaults()
    admin_role = await role_service.get_by_name(SystemRoleName.ADMIN.value)
    await session.commit()
    return admin_role.id


ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "StorePass1!"

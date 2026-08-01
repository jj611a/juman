"""Shared helpers for authenticated API tests."""

from __future__ import annotations

from uuid import uuid4

from app.modules.identity.models.user import User
from app.modules.identity.schemas.token import TokenPair
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.services.setting import SettingService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.identity import ADMIN_PASSWORD


async def create_user_with_token(
    session: AsyncSession,
    *,
    username: str,
    role_name: str,
    password: str = "Password1!",
    full_name: str = "Test User",
    must_change_password: bool = False,
) -> tuple[User, TokenPair]:
    """Create a user and issue a session-bound token pair."""
    roles = RoleService(session)
    role = await roles.get_by_name(role_name)
    users = UserService(session)
    user = await users.create_user(
        username=username,
        password=password,
        full_name=full_name,
        role_id=role.id,
        must_change_password=must_change_password,
    )
    sessions = SessionService(session, settings=SettingService(session))
    _, pair = await sessions.create_session(user, record_login=False)
    return user, pair


async def mint_admin_bearer(
    session: AsyncSession,
    *,
    username: str | None = None,
    password: str = ADMIN_PASSWORD,
) -> tuple[User, str]:
    """Create an Admin user and return Bearer access token."""
    name = username or f"admin_{uuid4().hex[:10]}"
    user, pair = await create_user_with_token(
        session,
        username=name,
        role_name=SystemRoleName.ADMIN.value,
        password=password,
        full_name="Admin",
        must_change_password=False,
    )
    return user, pair.access_token


def bearer_headers(token: str) -> dict[str, str]:
    """Build Authorization headers for a Bearer access token."""
    return {"Authorization": f"Bearer {token}"}

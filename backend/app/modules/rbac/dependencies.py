"""FastAPI dependencies for the RBAC module."""

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.exceptions import AuthorizationError
from app.modules.identity.dependencies import get_current_user
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.services.permission import PermissionService
from app.modules.rbac.services.role import RoleService


async def get_permission_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PermissionService:
    """Provide a request-scoped ``PermissionService``."""
    return PermissionService(session)


async def get_role_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RoleService:
    """Provide a request-scoped ``RoleService``."""
    return RoleService(session)


def require_permission(permission: str) -> Callable[..., Any]:
    """Require the authenticated principal to hold the given permission key."""

    async def _dependency(
        principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
        roles: Annotated[RoleService, Depends(get_role_service)],
    ) -> AuthenticatedPrincipal:
        allowed = await roles.role_has_permission(principal.user.role_id, permission)
        if not allowed:
            raise AuthorizationError(
                "ليس لديك صلاحية لتنفيذ هذا الإجراء",
                details={"required_permission": permission},
            )
        return principal

    return _dependency


def require_any_permission(*permissions: str) -> Callable[..., Any]:
    """Require the authenticated principal to hold at least one permission key."""

    async def _dependency(
        principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
        roles: Annotated[RoleService, Depends(get_role_service)],
    ) -> AuthenticatedPrincipal:
        for key in permissions:
            if await roles.role_has_permission(principal.user.role_id, key):
                return principal
        raise AuthorizationError(
            "ليس لديك صلاحية لتنفيذ هذا الإجراء",
            details={"required_any_of": list(permissions)},
        )

    return _dependency


def require_all_permissions(*permissions: str) -> Callable[..., Any]:
    """Require the authenticated principal to hold all permission keys."""

    async def _dependency(
        principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
        roles: Annotated[RoleService, Depends(get_role_service)],
    ) -> AuthenticatedPrincipal:
        for key in permissions:
            if not await roles.role_has_permission(principal.user.role_id, key):
                raise AuthorizationError(
                    "ليس لديك صلاحية لتنفيذ هذا الإجراء",
                    details={"required_all": list(permissions)},
                )
        return principal

    return _dependency


def require_system_role(role_name: str) -> Callable[..., Any]:
    """Require the authenticated principal's role name to match exactly."""

    async def _dependency(
        principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    ) -> AuthenticatedPrincipal:
        role = principal.user.role
        actual = role.name if role is not None else None
        if actual != role_name:
            raise AuthorizationError(
                "ليس لديك صلاحية لتنفيذ هذا الإجراء",
                details={"required_role": role_name, "actual_role": actual},
            )
        return principal

    return _dependency

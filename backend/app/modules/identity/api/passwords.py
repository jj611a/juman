"""Password lifecycle HTTP endpoints — Identity Phase 6."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.identity.constants import IdentityPermission
from app.modules.identity.dependencies import get_current_user, get_password_service
from app.modules.identity.schemas.password import (
    AdminResetPasswordRequest,
    ChangePasswordRequest,
)
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.identity.schemas.user import MessageOnlyResponse
from app.modules.identity.services.password import PasswordService
from app.modules.rbac.dependencies import require_permission

router = APIRouter(tags=["Passwords"])


@router.post(
    "/change-password",
    response_model=MessageOnlyResponse,
    summary="Change own password",
)
async def change_password(
    body: ChangePasswordRequest,
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    service: Annotated[PasswordService, Depends(get_password_service)],
) -> MessageOnlyResponse:
    """Self-service password change (allowed while force-change is required)."""
    await service.change_password(
        principal.user,
        body.current_password,
        body.new_password,
        current_session_id=principal.session_id,
    )
    return MessageOnlyResponse(message="تم تغيير كلمة المرور بنجاح")


@router.post(
    "/admin/reset-password",
    response_model=MessageOnlyResponse,
    summary="Admin reset user password",
)
async def admin_reset_password(
    body: AdminResetPasswordRequest,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(IdentityPermission.USERS_MANAGE.value)),
    ],
    service: Annotated[PasswordService, Depends(get_password_service)],
) -> MessageOnlyResponse:
    """Admin reset password, force change, and revoke all sessions."""
    await service.admin_reset_password(
        body.user_id,
        body.new_password,
        actor_id=principal.user.id,
    )
    return MessageOnlyResponse(message="تم إعادة تعيين كلمة المرور")

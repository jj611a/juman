"""Current-user profile endpoints — Identity Phase 7."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.identity.dependencies import get_current_user, get_user_service
from app.modules.identity.schemas.auth import MeUpdateRequest
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.identity.schemas.user import UserItemResponse, UserResponse
from app.modules.identity.services.user import UserService

router = APIRouter(tags=["Me"])


@router.get(
    "/me",
    response_model=UserItemResponse,
    summary="Get current user",
)
async def get_me(
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
) -> UserItemResponse:
    """Return the authenticated user's profile."""
    return UserItemResponse(data=UserResponse.from_model(principal.user))


@router.patch(
    "/me",
    response_model=UserItemResponse,
    summary="Update current user profile",
)
async def patch_me(
    body: MeUpdateRequest,
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    users: Annotated[UserService, Depends(get_user_service)],
) -> UserItemResponse:
    """Update own profile fields (full_name, phone, email)."""
    user = await users.update_user(
        principal.user.id,
        full_name=body.full_name,
        phone=body.phone,
        email=body.email,
        updated_by=principal.user.id,
    )
    return UserItemResponse(data=UserResponse.from_model(user))

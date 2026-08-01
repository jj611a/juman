"""Identity schemas."""

from app.modules.identity.schemas.auth_result import AuthenticationResult
from app.modules.identity.schemas.login_history import (
    LoginHistoryListResponse,
    LoginHistoryResponse,
)
from app.modules.identity.schemas.password import (
    AdminResetPasswordRequest,
    ChangePasswordRequest,
)
from app.modules.identity.schemas.session import (
    AuthenticatedPrincipal,
    SessionListResponse,
    SessionResponse,
)
from app.modules.identity.schemas.token import TokenPair
from app.modules.identity.schemas.user import (
    MessageOnlyResponse,
    UserCreateRequest,
    UserItemResponse,
    UserListResponse,
    UserResponse,
    UserUpdateRequest,
)

__all__ = [
    "AdminResetPasswordRequest",
    "AuthenticatedPrincipal",
    "AuthenticationResult",
    "ChangePasswordRequest",
    "LoginHistoryListResponse",
    "LoginHistoryResponse",
    "MessageOnlyResponse",
    "SessionListResponse",
    "SessionResponse",
    "TokenPair",
    "UserCreateRequest",
    "UserItemResponse",
    "UserListResponse",
    "UserResponse",
    "UserUpdateRequest",
]

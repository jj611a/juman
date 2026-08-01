"""Authentication result types (no tokens)."""

from __future__ import annotations

from dataclasses import dataclass

from app.modules.identity.constants import AuthenticationFailureReason
from app.modules.identity.models.user import User


@dataclass(frozen=True, slots=True)
class AuthenticationResult:
    """Outcome of ``AuthenticationService.authenticate`` — never includes tokens."""

    success: bool
    failure_reason: AuthenticationFailureReason | None
    user: User | None

    @classmethod
    def ok(cls, user: User) -> AuthenticationResult:
        return cls(success=True, failure_reason=None, user=user)

    @classmethod
    def fail(
        cls,
        reason: AuthenticationFailureReason,
        *,
        user: User | None = None,
    ) -> AuthenticationResult:
        return cls(success=False, failure_reason=reason, user=user)

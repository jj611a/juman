"""Authentication dependencies — delegates to Identity module implementation."""

from app.modules.identity.dependencies import (
    get_current_user,
    get_optional_bearer_token,
)

__all__ = ["get_current_user", "get_optional_bearer_token"]

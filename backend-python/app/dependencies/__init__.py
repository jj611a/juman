"""FastAPI dependency injection providers."""

from app.dependencies.database import get_db

__all__ = [
    "get_current_user",
    "get_db",
    "get_optional_bearer_token",
]


def __getattr__(name: str):
    """Lazy-load auth helpers to avoid circular imports with Identity."""
    if name in {"get_current_user", "get_optional_bearer_token"}:
        from app.dependencies import auth

        return getattr(auth, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

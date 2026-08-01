"""Security-related typing protocols (no concrete User model)."""

from typing import Protocol
from uuid import UUID


class AuthenticatedPrincipal(Protocol):
    """
    Minimal authenticated actor contract.

    Future Users module will provide a concrete implementation satisfying this
    protocol without changing dependent signatures.
    """

    id: UUID
    is_active: bool

    def has_permission(self, permission: str) -> bool:
        """Return True if this principal holds the permission code."""
        ...

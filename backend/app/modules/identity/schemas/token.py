"""Token issuance result types (no HTTP login)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class TokenPair:
    """Access JWT + opaque refresh plaintext (plaintext returned once only)."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_expires_at: datetime | None = None
    refresh_expires_at: datetime | None = None

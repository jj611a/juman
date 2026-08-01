"""Argon2 password hashing helpers."""

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import get_settings

_hasher: PasswordHasher | None = None


def _get_hasher() -> PasswordHasher:
    global _hasher
    if _hasher is None:
        settings = get_settings()
        _hasher = PasswordHasher(
            time_cost=settings.argon2_time_cost,
            memory_cost=settings.argon2_memory_cost,
            parallelism=settings.argon2_parallelism,
        )
    return _hasher


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _get_hasher().hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """
    Verify a plaintext password against an Argon2 hash.

    Returns True on match; False on mismatch. Does not raise on mismatch.
    """
    try:
        return _get_hasher().verify(password_hash, password)
    except VerifyMismatchError:
        return False

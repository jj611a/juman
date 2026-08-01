"""Opaque refresh-token hashing helpers."""

import hashlib


def hash_refresh_token(raw_token: str) -> str:
    """Return a deterministic SHA-256 hex digest for opaque refresh token lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

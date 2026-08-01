"""Tests for Argon2 password helpers and JWT utilities."""

from app.security.jwt import create_access_token, decode_token
from app.security.password import hash_password, verify_password


def test_password_hash_and_verify_roundtrip() -> None:
    """Hashed passwords must verify successfully and reject wrong input."""
    password = "Str0ng-Passphrase!"
    digest = hash_password(password)
    assert digest != password
    assert verify_password(digest, password) is True
    assert verify_password(digest, "wrong-password") is False


def test_access_token_roundtrip() -> None:
    """Access tokens must encode and decode a stable subject claim."""
    token = create_access_token("11111111-1111-1111-1111-111111111111")
    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == "11111111-1111-1111-1111-111111111111"
    assert payload["type"] == "access"

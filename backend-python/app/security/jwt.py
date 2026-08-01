"""JWT create and decode helpers (no User model dependency)."""

from datetime import timedelta
from typing import Any
from uuid import UUID

from jose import JWTError, jwt

from app.config import get_settings
from app.exceptions import AuthenticationError
from app.utils.datetime import utc_now


def _encode(payload: dict[str, Any], expires_delta: timedelta) -> str:
    settings = get_settings()
    now = utc_now()
    claims = {
        **payload,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(claims, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(
    subject: str | UUID,
    *,
    extra_claims: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject: Stable subject identifier (typically a user UUID string).
        extra_claims: Optional additional claims (e.g. session id ``sid``).
        expires_minutes: Optional TTL override (falls back to env settings).
    """
    settings = get_settings()
    minutes = (
        expires_minutes if expires_minutes is not None else settings.jwt_access_token_expire_minutes
    )
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return _encode(payload, timedelta(minutes=minutes))


def create_refresh_token(
    subject: str | UUID,
    *,
    expires_days: int | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a signed JWT refresh token (legacy helper; Identity uses opaque tokens)."""
    settings = get_settings()
    days = expires_days if expires_days is not None else settings.jwt_refresh_token_expire_days
    payload: dict[str, Any] = {"sub": str(subject), "type": "refresh"}
    if extra_claims:
        payload.update(extra_claims)
    return _encode(payload, timedelta(days=days))


def decode_token(token: str, *, expected_type: str | None = "access") -> dict[str, Any]:
    """
    Decode and validate a JWT.

    Raises:
        AuthenticationError: If the token is invalid, expired, or wrong type.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except JWTError as exc:
        raise AuthenticationError(
            "رمز المصادقة غير صالح أو منتهي الصلاحية",
            details={"reason": str(exc)},
        ) from exc

    if expected_type is not None and payload.get("type") != expected_type:
        raise AuthenticationError(
            "نوع رمز المصادقة غير صالح",
            details={"expected": expected_type, "actual": payload.get("type")},
        )
    if "sub" not in payload:
        raise AuthenticationError("رمز المصادقة لا يحتوي على معرف المستخدم")
    return payload

"""Username / phone / email validators for Identity Phase 1."""

from __future__ import annotations

import re

from app.exceptions import ValidationError
from app.modules.identity.constants import PHONE_PATTERN, USERNAME_PATTERN

_USERNAME_RE = re.compile(USERNAME_PATTERN)
_PHONE_RE = re.compile(PHONE_PATTERN)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_username(username: str) -> str:
    """Lowercase and strip username."""
    return username.strip().lower()


def validate_username(username: str) -> str:
    """Validate and normalize a username."""
    normalized = normalize_username(username)
    if not _USERNAME_RE.fullmatch(normalized):
        raise ValidationError(
            "اسم المستخدم غير صالح",
            details={
                "field": "username",
                "rule": "3-100 chars; lowercase letters, digits, . _ -",
            },
        )
    return normalized


def validate_optional_email(email: str | None) -> str | None:
    """Validate optional email format."""
    if email is None:
        return None
    value = email.strip()
    if not value:
        return None
    if not _EMAIL_RE.fullmatch(value) or len(value) > 255:
        raise ValidationError("البريد الإلكتروني غير صالح", details={"field": "email"})
    return value.lower()


def validate_optional_phone(phone: str | None) -> str | None:
    """Validate optional phone format."""
    if phone is None:
        return None
    value = phone.strip()
    if not value:
        return None
    if not _PHONE_RE.fullmatch(value):
        raise ValidationError("رقم الهاتف غير صالح", details={"field": "phone"})
    return value


def validate_full_name(full_name: str) -> str:
    """Require a non-empty full name."""
    value = full_name.strip()
    if not value or len(value) > 200:
        raise ValidationError("الاسم الكامل غير صالح", details={"field": "full_name"})
    return value

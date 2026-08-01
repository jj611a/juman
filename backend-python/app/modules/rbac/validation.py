"""Validation helpers for RBAC entities."""

from __future__ import annotations

import re

from app.exceptions import ValidationError

PERMISSION_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$")


def validate_permission_key(key: str) -> str:
    """Validate and normalize a dot-notation permission key."""
    normalized = key.strip().lower()
    if not PERMISSION_KEY_PATTERN.fullmatch(normalized):
        raise ValidationError(
            "مفتاح الصلاحية يجب أن يكون بصيغة module.action",
            details={"key": key, "pattern": "module.action"},
        )
    return normalized


def validate_role_name(name: str) -> str:
    """Validate a role name."""
    normalized = name.strip()
    if not normalized:
        raise ValidationError("اسم الدور مطلوب")
    if len(normalized) > 100:
        raise ValidationError("اسم الدور طويل جداً", details={"max_length": 100})
    return normalized


def derive_module_from_key(key: str) -> str:
    """Extract the module segment from a permission key."""
    return key.split(".", maxsplit=1)[0]

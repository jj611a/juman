"""Dress field validators."""

from __future__ import annotations

from app.exceptions import ValidationError
from app.modules.inventory.constants import DressColour, DressSize, DressStatus


def validate_name_ar(name_ar: str) -> str:
    """Require a non-empty Arabic name (max 200)."""
    value = name_ar.strip()
    if not value or len(value) > 200:
        raise ValidationError("الاسم العربي غير صالح", details={"field": "name_ar"})
    return value


def normalize_optional_text(value: str | None, *, max_length: int) -> str | None:
    """Strip optional text; empty becomes None."""
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) > max_length:
        raise ValidationError(
            "النص أطول من الحد المسموح",
            details={"max_length": max_length},
        )
    return text


def validate_size(size: str) -> str:
    """Require an allowlisted size code (stored uppercase)."""
    value = size.strip().upper()
    try:
        return DressSize(value).value
    except ValueError as exc:
        raise ValidationError(
            "مقاس الفستان غير صالح",
            details={"field": "size", "allowed": [s.value for s in DressSize]},
        ) from exc


def validate_colour(colour: str) -> str:
    """Require an allowlisted colour code (stored uppercase)."""
    value = colour.strip().upper()
    try:
        return DressColour(value).value
    except ValueError as exc:
        raise ValidationError(
            "لون الفستان غير صالح",
            details={"field": "colour", "allowed": [c.value for c in DressColour]},
        ) from exc


def validate_status(status: str) -> str:
    """Require a valid DressStatus value."""
    value = status.strip().upper()
    try:
        return DressStatus(value).value
    except ValueError as exc:
        raise ValidationError(
            "حالة الفستان غير صالحة",
            details={"field": "status", "allowed": [s.value for s in DressStatus]},
        ) from exc


def validate_price(value: int, *, field: str) -> int:
    """Require a non-negative IQD integer."""
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValidationError(
            "السعر يجب أن يكون عدداً صحيحاً بالدينار العراقي (≥ 0)",
            details={"field": field},
        )
    return value

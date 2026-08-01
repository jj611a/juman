"""Customer field validators."""

from __future__ import annotations

import re
from datetime import date

from app.exceptions import ValidationError
from app.modules.customers.constants import CustomerGender
from app.modules.identity.constants import PHONE_PATTERN
from app.utils.datetime import utc_now

_PHONE_RE = re.compile(PHONE_PATTERN)
_NATIONAL_ID_RE = re.compile(r"^\d{8,20}$")


def validate_full_name(full_name: str) -> str:
    """Require a non-empty full name (max 200)."""
    value = full_name.strip()
    if not value or len(value) > 200:
        raise ValidationError("الاسم الكامل غير صالح", details={"field": "full_name"})
    return value


def validate_required_phone(phone: str) -> str:
    """Require and validate a phone number."""
    value = phone.strip()
    if not value:
        raise ValidationError("رقم الهاتف مطلوب", details={"field": "phone"})
    if not _PHONE_RE.fullmatch(value):
        raise ValidationError("رقم الهاتف غير صالح", details={"field": "phone"})
    return value


def validate_optional_phone(phone: str | None, *, field: str = "alternative_phone") -> str | None:
    """Validate optional phone; empty becomes None."""
    if phone is None:
        return None
    value = phone.strip()
    if not value:
        return None
    if not _PHONE_RE.fullmatch(value):
        raise ValidationError("رقم الهاتف غير صالح", details={"field": field})
    return value


def validate_national_id(national_id: str | None) -> str | None:
    """Optional national ID: digits only, length 8–20 after stripping spaces."""
    if national_id is None:
        return None
    value = national_id.strip().replace(" ", "")
    if not value:
        return None
    if not _NATIONAL_ID_RE.fullmatch(value):
        raise ValidationError(
            "رقم الهوية الوطنية غير صالح",
            details={"field": "national_id", "min_length": 8, "max_length": 20},
        )
    return value


def validate_gender(gender: str | None) -> str | None:
    """Optional gender allowlist."""
    if gender is None:
        return None
    value = gender.strip().upper()
    if not value:
        return None
    try:
        return CustomerGender(value).value
    except ValueError as exc:
        raise ValidationError(
            "الجنس غير صالح",
            details={"field": "gender", "allowed": [g.value for g in CustomerGender]},
        ) from exc


def validate_birth_date(birth_date: date | None) -> date | None:
    """Optional birth date must not be in the future."""
    if birth_date is None:
        return None
    today = utc_now().date()
    if birth_date > today:
        raise ValidationError(
            "تاريخ الميلاد لا يمكن أن يكون في المستقبل",
            details={"field": "birth_date"},
        )
    return birth_date


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

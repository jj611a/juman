"""Value serialization and domain validation for settings."""

from __future__ import annotations

import json
from typing import Any

from app.exceptions import ValidationError
from app.modules.settings.constants import SettingKey
from app.modules.settings.enums import SettingValueType


def serialize_setting_value(value: Any, value_type: SettingValueType | str) -> str:
    """Convert a Python value to the canonical string stored in the database."""
    value_type = SettingValueType(value_type)

    if value_type == SettingValueType.STRING:
        if value is None:
            return ""
        if not isinstance(value, str):
            raise ValidationError(
                "قيمة النص يجب أن تكون سلسلة نصية",
                details={"value_type": value_type.value},
            )
        return value

    if value_type == SettingValueType.INTEGER:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValidationError(
                "قيمة العدد الصحيح غير صالحة",
                details={"value_type": value_type.value},
            )
        return str(value)

    if value_type == SettingValueType.FLOAT:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationError(
                "قيمة العدد العشري غير صالحة",
                details={"value_type": value_type.value},
            )
        return str(float(value))

    if value_type == SettingValueType.BOOLEAN:
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes"}:
                return "true"
            if normalized in {"false", "0", "no"}:
                return "false"
        raise ValidationError(
            "قيمة المنطقي يجب أن تكون true أو false",
            details={"value_type": value_type.value},
        )

    if value_type == SettingValueType.JSON:
        try:
            return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError) as exc:
            raise ValidationError(
                "قيمة JSON غير صالحة",
                details={"value_type": value_type.value},
            ) from exc

    raise ValidationError("نوع القيمة غير مدعوم", details={"value_type": str(value_type)})


def deserialize_setting_value(raw: str, value_type: SettingValueType | str) -> Any:
    """Convert a stored string value to a typed Python object."""
    value_type = SettingValueType(value_type)

    if value_type == SettingValueType.STRING:
        return raw

    if value_type == SettingValueType.INTEGER:
        try:
            return int(raw)
        except (TypeError, ValueError) as exc:
            raise ValidationError(
                "تعذر تحويل القيمة إلى عدد صحيح",
                details={"value": raw},
            ) from exc

    if value_type == SettingValueType.FLOAT:
        try:
            return float(raw)
        except (TypeError, ValueError) as exc:
            raise ValidationError(
                "تعذر تحويل القيمة إلى عدد عشري",
                details={"value": raw},
            ) from exc

    if value_type == SettingValueType.BOOLEAN:
        normalized = raw.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
        raise ValidationError(
            "تعذر تحويل القيمة إلى منطقي",
            details={"value": raw},
        )

    if value_type == SettingValueType.JSON:
        try:
            return json.loads(raw) if raw else None
        except json.JSONDecodeError as exc:
            raise ValidationError(
                "تعذر تحويل القيمة إلى JSON",
                details={"value": raw},
            ) from exc

    raise ValidationError("نوع القيمة غير مدعوم", details={"value_type": str(value_type)})


def validate_setting_value(key: str, value: Any, value_type: SettingValueType | str) -> Any:
    """
    Validate and normalize a setting value for the given key and type.

    Returns the normalized Python value (not serialized).
    """
    value_type = SettingValueType(value_type)
    # Round-trip through serialize/deserialize to normalize representation.
    serialized = serialize_setting_value(value, value_type)
    normalized = deserialize_setting_value(serialized, value_type)

    if key == SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE and (
        not isinstance(normalized, int) or normalized < 0 or normalized > 100
    ):
        raise ValidationError(
            "نسبة الدفعة الأولية يجب أن تكون بين 0 و 100",
            details={"key": key, "min": 0, "max": 100, "value": normalized},
        )

    if key in {
        SettingKey.MANDATORY_PROCESSING_DAYS,
        SettingKey.OPTIONAL_PROCESSING_DAYS,
    } and (not isinstance(normalized, int) or normalized < 0):
        raise ValidationError(
            "عدد أيام المعالجة يجب أن يكون صفر أو أكثر",
            details={"key": key, "value": normalized},
        )

    if key == SettingKey.INVENTORY_BARCODE_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو باركود الفستان يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.INVENTORY_BARCODE_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة الباركود مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.INVENTORY_BARCODE_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل الباركود يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.CUSTOMERS_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم العميل يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.CUSTOMERS_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم العميل مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.CUSTOMERS_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم العميل يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.RESERVATIONS_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم الحجز يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.RESERVATIONS_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم الحجز مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.RESERVATIONS_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم الحجز يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.RENTALS_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم الإيجار يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.RENTALS_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم الإيجار مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.RENTALS_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم الإيجار يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.RETURNS_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم الإرجاع يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.RETURNS_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم الإرجاع مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.RETURNS_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم الإرجاع يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.INSPECTION_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم الفحص يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.INSPECTION_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم الفحص مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.INSPECTION_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم الفحص يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.PROCESSING_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم المعالجة يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.PROCESSING_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم المعالجة مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.PROCESSING_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم المعالجة يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.SETTLEMENT_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم التسوية يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.SETTLEMENT_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم التسوية مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.SETTLEMENT_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم التسوية يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.SALE_NUMBER_PADDING and (
        not isinstance(normalized, int) or normalized < 1 or normalized > 16
    ):
        raise ValidationError(
            "حشو رقم البيع يجب أن يكون بين 1 و 16",
            details={"key": key, "min": 1, "max": 16, "value": normalized},
        )

    if key == SettingKey.SALE_NUMBER_PREFIX and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "بادئة رقم البيع مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.SALE_NUMBER_SEPARATOR:
        if not isinstance(normalized, str) or normalized not in {"", "-", "_"}:
            raise ValidationError(
                "فاصل رقم البيع يجب أن يكون فارغاً أو - أو _",
                details={"key": key, "allowed": ["", "-", "_"]},
            )

    if key == SettingKey.CURRENCY and (not isinstance(normalized, str) or not normalized.strip()):
        raise ValidationError(
            "العملة مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.DEFAULT_TIMEZONE and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "المنطقة الزمنية مطلوبة",
            details={"key": key},
        )

    if key == SettingKey.COMPANY_NAME and (
        not isinstance(normalized, str) or not normalized.strip()
    ):
        raise ValidationError(
            "اسم الشركة مطلوب",
            details={"key": key},
        )

    return normalized

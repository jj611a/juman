"""Unit tests for settings value serialization and validation."""

import pytest
from app.exceptions import ValidationError
from app.modules.settings.constants import SettingKey
from app.modules.settings.enums import SettingValueType
from app.modules.settings.validation import (
    deserialize_setting_value,
    serialize_setting_value,
    validate_setting_value,
)


def test_serialize_and_deserialize_string() -> None:
    raw = serialize_setting_value("جمان", SettingValueType.STRING)
    assert deserialize_setting_value(raw, SettingValueType.STRING) == "جمان"


def test_serialize_and_deserialize_integer() -> None:
    raw = serialize_setting_value(50, SettingValueType.INTEGER)
    assert deserialize_setting_value(raw, SettingValueType.INTEGER) == 50


def test_serialize_and_deserialize_float() -> None:
    raw = serialize_setting_value(12.5, SettingValueType.FLOAT)
    assert deserialize_setting_value(raw, SettingValueType.FLOAT) == 12.5


def test_serialize_and_deserialize_boolean() -> None:
    assert serialize_setting_value(True, SettingValueType.BOOLEAN) == "true"
    assert deserialize_setting_value("true", SettingValueType.BOOLEAN) is True
    assert deserialize_setting_value("false", SettingValueType.BOOLEAN) is False


def test_serialize_and_deserialize_json() -> None:
    raw = serialize_setting_value({"a": 1}, SettingValueType.JSON)
    assert deserialize_setting_value(raw, SettingValueType.JSON) == {"a": 1}


def test_reject_bool_as_integer() -> None:
    with pytest.raises(ValidationError):
        serialize_setting_value(True, SettingValueType.INTEGER)


@pytest.mark.parametrize("value", [0, 50, 100])
def test_maximum_initial_payment_percentage_valid(value: int) -> None:
    assert (
        validate_setting_value(
            SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE,
            value,
            SettingValueType.INTEGER,
        )
        == value
    )


@pytest.mark.parametrize("value", [-1, 101])
def test_maximum_initial_payment_percentage_invalid(value: int) -> None:
    with pytest.raises(ValidationError) as exc_info:
        validate_setting_value(
            SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE,
            value,
            SettingValueType.INTEGER,
        )
    assert "0" in exc_info.value.message and "100" in exc_info.value.message


def test_barcode_padding_must_be_in_range() -> None:
    with pytest.raises(ValidationError):
        validate_setting_value(
            SettingKey.INVENTORY_BARCODE_PADDING,
            0,
            SettingValueType.INTEGER,
        )
    with pytest.raises(ValidationError):
        validate_setting_value(
            SettingKey.INVENTORY_BARCODE_PADDING,
            17,
            SettingValueType.INTEGER,
        )


def test_barcode_prefix_required() -> None:
    with pytest.raises(ValidationError):
        validate_setting_value(
            SettingKey.INVENTORY_BARCODE_PREFIX,
            "  ",
            SettingValueType.STRING,
        )


def test_barcode_separator_allowed_values() -> None:
    with pytest.raises(ValidationError):
        validate_setting_value(
            SettingKey.INVENTORY_BARCODE_SEPARATOR,
            "*",
            SettingValueType.STRING,
        )


def test_currency_required() -> None:
    with pytest.raises(ValidationError):
        validate_setting_value(SettingKey.CURRENCY, "", SettingValueType.STRING)


def test_processing_days_cannot_be_negative() -> None:
    with pytest.raises(ValidationError):
        validate_setting_value(
            SettingKey.MANDATORY_PROCESSING_DAYS,
            -1,
            SettingValueType.INTEGER,
        )

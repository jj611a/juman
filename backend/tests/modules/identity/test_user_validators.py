"""Identity Phase 1 validator unit tests."""

import pytest
from app.exceptions import ValidationError
from app.modules.identity.validators import (
    validate_full_name,
    validate_optional_email,
    validate_optional_phone,
    validate_username,
)


def test_validate_username_ok() -> None:
    assert validate_username("Admin.User_1") == "admin.user_1"


def test_validate_username_rejects_bad() -> None:
    with pytest.raises(ValidationError):
        validate_username("ab")
    with pytest.raises(ValidationError):
        validate_username("Bad Name")


def test_validate_email_and_phone() -> None:
    assert validate_optional_email("A@B.COM") == "a@b.com"
    assert validate_optional_email(None) is None
    with pytest.raises(ValidationError):
        validate_optional_email("not-an-email")

    assert validate_optional_phone("+964 770 1234567") == "+964 770 1234567"
    with pytest.raises(ValidationError):
        validate_optional_phone("12")


def test_validate_full_name() -> None:
    assert validate_full_name("  Ali  ") == "Ali"
    with pytest.raises(ValidationError):
        validate_full_name("   ")

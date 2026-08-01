"""Unit tests for report date-range helpers."""

from datetime import date, datetime, timezone

import pytest
from app.exceptions import ValidationError
from app.modules.reports.services.date_range import baghdad_day_window, resolve_half_open_range


def test_half_open_date_only_baghdad() -> None:
    start, end = resolve_half_open_range(
        date(2026, 7, 1), date(2026, 7, 2), tz_name="Asia/Baghdad"
    )
    assert start == datetime(2026, 6, 30, 21, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 7, 1, 21, 0, tzinfo=timezone.utc)


def test_rejects_inverted_range() -> None:
    with pytest.raises(ValidationError) as exc:
        resolve_half_open_range(date(2026, 7, 2), date(2026, 7, 1), tz_name="Asia/Baghdad")
    assert "date_from" in (exc.value.details or {})


def test_rejects_span_over_366_days() -> None:
    with pytest.raises(ValidationError) as exc:
        resolve_half_open_range(date(2025, 1, 1), date(2026, 2, 2), tz_name="Asia/Baghdad")
    assert exc.value.details["max_days"] == 366


def test_datetime_range_uses_utc() -> None:
    start, end = resolve_half_open_range(
        datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc),
        datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc),
        tz_name="Asia/Baghdad",
    )
    assert start.hour == 10
    assert end.hour == 12


def test_baghdad_day_window() -> None:
    # 2026-07-01 02:00 UTC = 05:00 Baghdad
    now = datetime(2026, 7, 1, 2, 0, tzinfo=timezone.utc)
    start, end = baghdad_day_window(now, tz_name="Asia/Baghdad")
    assert start == datetime(2026, 6, 30, 21, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 7, 1, 21, 0, tzinfo=timezone.utc)


def test_invalid_timezone() -> None:
    with pytest.raises(ValidationError):
        resolve_half_open_range(date(2026, 1, 1), date(2026, 1, 2), tz_name="Not/AZone")


def test_baghdad_day_window_invalid_tz() -> None:
    with pytest.raises(ValidationError):
        baghdad_day_window(datetime(2026, 1, 1, tzinfo=timezone.utc), tz_name="Nope")

"""Date-range resolution for reports (Baghdad business days → UTC half-open)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, time, timezone
from zoneinfo import ZoneInfo

from app.exceptions import ValidationError
from app.modules.reports.constants import MAX_RANGE_DAYS
from app.utils.datetime import ensure_utc


def resolve_half_open_range(
    date_from: date | datetime,
    date_to: date | datetime,
    *,
    tz_name: str,
) -> tuple[datetime, datetime]:
    """
    Resolve [from, to) in UTC.

    - date-only values use start-of-day in ``tz_name``
    - datetime values are converted via ensure_utc
    """
    try:
        tz = ZoneInfo(tz_name)
    except Exception as exc:  # noqa: BLE001
        raise ValidationError(
            "المنطقة الزمنية غير صالحة",
            details={"field": "default_timezone", "value": tz_name},
        ) from exc

    start = _to_utc_instant(date_from, tz=tz, as_end=False)
    end = _to_utc_instant(date_to, tz=tz, as_end=False)

    if start >= end:
        raise ValidationError(
            "تاريخ البداية يجب أن يكون قبل تاريخ النهاية",
            details={"field": "date_from", "date_from": str(date_from), "date_to": str(date_to)},
        )

    if (end - start) > timedelta(days=MAX_RANGE_DAYS):
        raise ValidationError(
            "نطاق التاريخ يتجاوز الحد الأقصى المسموح",
            details={"field": "date_to", "max_days": MAX_RANGE_DAYS},
        )

    return start, end


def baghdad_day_window(now_utc: datetime, *, tz_name: str) -> tuple[datetime, datetime]:
    """Return [start_of_today, start_of_tomorrow) in UTC for the business timezone."""
    now = ensure_utc(now_utc)
    try:
        tz = ZoneInfo(tz_name)
    except Exception as exc:  # noqa: BLE001
        raise ValidationError(
            "المنطقة الزمنية غير صالحة",
            details={"field": "default_timezone", "value": tz_name},
        ) from exc
    local = now.astimezone(tz)
    start_local = datetime.combine(local.date(), time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def _to_utc_instant(
    value: date | datetime,
    *,
    tz: ZoneInfo,
    as_end: bool,
) -> datetime:
    if isinstance(value, datetime):
        return ensure_utc(value)
    # pure date
    day = value + timedelta(days=1) if as_end else value
    local = datetime.combine(day, time.min, tzinfo=tz)
    return local.astimezone(timezone.utc)

"""UTC-aware datetime helpers."""

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return the current UTC timestamp with timezone info."""
    return datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC (SQLite may return naive values)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)

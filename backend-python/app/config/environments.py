"""Environment enumeration for runtime configuration profiles."""

from enum import StrEnum


class AppEnvironment(StrEnum):
    """Supported application runtime environments."""

    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"

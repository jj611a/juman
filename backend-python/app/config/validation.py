"""Runtime configuration validation for application startup."""

from __future__ import annotations

from app.config.environments import AppEnvironment
from app.config.settings import Settings

# Known insecure / example secrets that must never be used in production.
INSECURE_SECRET_KEYS: frozenset[str] = frozenset(
    {
        "change-me-in-production",
        "change-me-to-a-long-random-secret-key-in-production",
        "test-secret-key-for-juman-foundation",
        "unit-test-secret",
        "secret",
        "secret_key",
        "changeme",
    }
)

MIN_PRODUCTION_SECRET_KEY_LENGTH = 32
ALLOWED_PRODUCTION_JWT_ALGORITHMS: frozenset[str] = frozenset({"HS256", "HS384", "HS512"})


class ConfigurationError(RuntimeError):
    """Raised when application configuration is unsafe or incomplete for startup."""


def validate_settings(settings: Settings) -> None:
    """
    Validate settings for the current runtime environment.

    Development and testing may use default or short secrets.
    Production must fail fast on missing, empty, or insecure configuration.
    """
    if settings.app_env == AppEnvironment.PRODUCTION:
        _validate_production(settings)
        return

    if settings.app_env == AppEnvironment.TESTING:
        _validate_testing(settings)
        return

    _validate_development(settings)


def _validate_development(settings: Settings) -> None:
    """Development allows defaults; still reject blank secrets if explicitly set empty."""
    if settings.secret_key is not None and settings.secret_key.strip() == "":
        raise ConfigurationError("SECRET_KEY must not be empty.")
    if not settings.database_url.strip():
        raise ConfigurationError("DATABASE_URL must not be empty.")


def _validate_testing(settings: Settings) -> None:
    """Testing may use a dedicated test key; blank values are rejected."""
    if not settings.secret_key or not settings.secret_key.strip():
        raise ConfigurationError("SECRET_KEY is required in testing.")
    if not settings.database_url.strip():
        raise ConfigurationError("DATABASE_URL is required in testing.")


def _validate_production(settings: Settings) -> None:
    """Enforce strict production configuration requirements."""
    errors: list[str] = []

    secret = (settings.secret_key or "").strip()
    if not secret:
        errors.append("SECRET_KEY is missing or empty.")
    elif secret.lower() in {value.lower() for value in INSECURE_SECRET_KEYS}:
        errors.append(
            "SECRET_KEY is set to an insecure default/example value. "
            "Generate a long random secret for production."
        )
    elif len(secret) < MIN_PRODUCTION_SECRET_KEY_LENGTH:
        errors.append(
            "SECRET_KEY must be at least "
            f"{MIN_PRODUCTION_SECRET_KEY_LENGTH} characters in production."
        )

    database_url = (settings.database_url or "").strip()
    if not database_url:
        errors.append("DATABASE_URL is missing or empty.")
    elif not database_url.startswith("postgresql+asyncpg://"):
        errors.append(
            "DATABASE_URL must use the async PostgreSQL driver "
            "(postgresql+asyncpg://...) in production."
        )
    elif _is_insecure_database_url(database_url):
        errors.append(
            "DATABASE_URL appears to use insecure placeholder credentials "
            "(for example juman:juman@localhost). Set a real production database URL."
        )

    if settings.jwt_access_token_expire_minutes <= 0:
        errors.append("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be greater than 0.")
    elif settings.jwt_access_token_expire_minutes > 60 * 24:
        errors.append(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES must not exceed 1440 (24 hours) in production."
        )

    if settings.jwt_refresh_token_expire_days <= 0:
        errors.append("JWT_REFRESH_TOKEN_EXPIRE_DAYS must be greater than 0.")
    elif settings.jwt_refresh_token_expire_days > 90:
        errors.append("JWT_REFRESH_TOKEN_EXPIRE_DAYS must not exceed 90 in production.")

    algorithm = (settings.jwt_algorithm or "").strip().upper()
    if algorithm not in ALLOWED_PRODUCTION_JWT_ALGORITHMS:
        errors.append(
            "JWT_ALGORITHM must be one of: "
            + ", ".join(sorted(ALLOWED_PRODUCTION_JWT_ALGORITHMS))
            + "."
        )

    if not settings.jwt_issuer.strip():
        errors.append("JWT_ISSUER must not be empty in production.")
    if not settings.jwt_audience.strip():
        errors.append("JWT_AUDIENCE must not be empty in production.")

    if not settings.cors_origins:
        errors.append("CORS_ORIGINS must include at least one explicit origin in production.")
    elif any(origin.strip() == "*" for origin in settings.cors_origins):
        errors.append("CORS_ORIGINS must not include '*' in production.")

    if settings.app_debug:
        errors.append("APP_DEBUG must be false in production.")

    if settings.redis_enabled and not settings.redis_url:
        errors.append("REDIS_URL is required when REDIS_ENABLED=true.")

    if settings.database_pool_size < 1:
        errors.append("DATABASE_POOL_SIZE must be at least 1 in production.")
    if settings.database_max_overflow < 0:
        errors.append("DATABASE_MAX_OVERFLOW must be >= 0 in production.")

    if errors:
        joined = "\n".join(f"- {error}" for error in errors)
        raise ConfigurationError(
            "Invalid production configuration. Application startup aborted.\n" + joined
        )


def _is_insecure_database_url(database_url: str) -> bool:
    """Detect common placeholder database credentials used in examples."""
    normalized = database_url.lower()
    insecure_markers = (
        "juman:juman@",
        "user:password@",
        "postgres:postgres@localhost",
        "postgres:postgres@127.0.0.1",
    )
    return any(marker in normalized for marker in insecure_markers)

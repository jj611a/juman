"""Tests for configuration loading, profiles, and production startup validation."""

import os

import pytest
from app.config.environments import AppEnvironment
from app.config.settings import Settings, get_settings
from app.config.validation import ConfigurationError, validate_settings
from app.main import create_app


def test_settings_defaults_for_testing(monkeypatch) -> None:
    """Testing environment should enable debug and disable JSON logs by default."""
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("SECRET_KEY", "unit-test-secret")
    settings = Settings()
    assert settings.app_env == AppEnvironment.TESTING
    assert settings.is_testing is True
    assert settings.app_debug is True
    assert settings.log_json is False
    validate_settings(settings)
    get_settings.cache_clear()


def test_production_forces_safe_defaults(monkeypatch) -> None:
    """Production profile should disable debug and enable JSON logging."""
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_DEBUG", "true")
    monkeypatch.setenv("LOG_JSON", "false")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv(
        "SECRET_KEY",
        "production-grade-secret-key-with-32plus-chars",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman_prod:s3curePass@db.internal:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.juman.local")
    settings = Settings()
    assert settings.is_production is True
    assert settings.app_debug is False
    assert settings.log_json is True
    assert settings.log_level == "INFO"
    validate_settings(settings)
    get_settings.cache_clear()


def test_cors_origins_parse_from_csv(monkeypatch) -> None:
    """CORS_ORIGINS may be provided as a comma-separated string."""
    get_settings.cache_clear()
    monkeypatch.setenv("CORS_ORIGINS", "http://a.local, http://b.local")
    monkeypatch.setenv("SECRET_KEY", "unit-test-secret")
    settings = Settings()
    assert settings.cors_origins == ["http://a.local", "http://b.local"]
    get_settings.cache_clear()
    os.environ.pop("CORS_ORIGINS", None)


def test_production_rejects_default_secret_key(monkeypatch) -> None:
    """Production must not start with the example/default SECRET_KEY."""
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman_prod:s3curePass@db.internal:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.juman.local")
    settings = Settings()
    with pytest.raises(ConfigurationError, match="SECRET_KEY"):
        validate_settings(settings)
    get_settings.cache_clear()


def test_production_rejects_example_env_secret(monkeypatch) -> None:
    """Production must reject the .env.example SECRET_KEY value."""
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "SECRET_KEY",
        "change-me-to-a-long-random-secret-key-in-production",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman_prod:s3curePass@db.internal:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.juman.local")
    settings = Settings()
    with pytest.raises(ConfigurationError, match="SECRET_KEY"):
        validate_settings(settings)
    get_settings.cache_clear()


def test_production_rejects_empty_secret_key(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "   ")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman_prod:s3curePass@db.internal:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.juman.local")
    settings = Settings()
    with pytest.raises(ConfigurationError, match="SECRET_KEY"):
        validate_settings(settings)
    get_settings.cache_clear()


def test_production_rejects_short_secret_key(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "short-but-not-default")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman_prod:s3curePass@db.internal:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.juman.local")
    settings = Settings()
    with pytest.raises(ConfigurationError, match="at least 32"):
        validate_settings(settings)
    get_settings.cache_clear()


def test_production_rejects_placeholder_database_url(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "SECRET_KEY",
        "production-grade-secret-key-with-32plus-chars",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman:juman@localhost:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.juman.local")
    settings = Settings()
    with pytest.raises(ConfigurationError, match="DATABASE_URL"):
        validate_settings(settings)
    get_settings.cache_clear()


def test_production_rejects_wildcard_cors(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "SECRET_KEY",
        "production-grade-secret-key-with-32plus-chars",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman_prod:s3curePass@db.internal:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "*")
    settings = Settings()
    with pytest.raises(ConfigurationError, match="CORS_ORIGINS"):
        validate_settings(settings)
    get_settings.cache_clear()


def test_production_rejects_invalid_jwt_expiry(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "SECRET_KEY",
        "production-grade-secret-key-with-32plus-chars",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman_prod:s3curePass@db.internal:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.juman.local")
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "0")
    settings = Settings()
    with pytest.raises(ConfigurationError, match="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"):
        validate_settings(settings)
    get_settings.cache_clear()


def test_create_app_aborts_on_invalid_production_config(monkeypatch) -> None:
    """Application factory must raise before serving when production config is unsafe."""
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://juman:juman@localhost:5432/juman",
    )
    monkeypatch.setenv("CORS_ORIGINS", "*")
    settings = Settings()
    with pytest.raises(ConfigurationError):
        create_app(settings)
    get_settings.cache_clear()


def test_development_allows_default_secret(monkeypatch) -> None:
    """Development may boot with the default SECRET_KEY."""
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production")
    settings = Settings()
    validate_settings(settings)
    get_settings.cache_clear()

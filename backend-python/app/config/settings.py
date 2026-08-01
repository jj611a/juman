"""Central application settings loaded via pydantic-settings."""

from functools import lru_cache
from typing import Annotated, Self

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.config.environments import AppEnvironment


class Settings(BaseSettings):
    """
    Typed configuration for the Juman backend foundation.

    Values are loaded from environment variables and an optional `.env` file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = Field(default="Juman", alias="APP_NAME")
    app_env: AppEnvironment = Field(default=AppEnvironment.DEVELOPMENT, alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    secret_key: str = Field(default="change-me-in-production", alias="SECRET_KEY")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    # CORS
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"],
        alias="CORS_ORIGINS",
    )

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://juman:juman@localhost:5432/juman",
        alias="DATABASE_URL",
    )
    database_echo: bool = Field(default=False, alias="DATABASE_ECHO")
    database_pool_size: int = Field(default=5, alias="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=10, alias="DATABASE_MAX_OVERFLOW")
    database_pool_timeout: int = Field(default=30, alias="DATABASE_POOL_TIMEOUT")

    # JWT
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=60,
        alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    jwt_refresh_token_expire_days: int = Field(default=7, alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS")
    jwt_issuer: str = Field(default="juman", alias="JWT_ISSUER")
    jwt_audience: str = Field(default="juman-desktop", alias="JWT_AUDIENCE")

    # Argon2
    argon2_time_cost: int = Field(default=2, alias="ARGON2_TIME_COST")
    argon2_memory_cost: int = Field(default=65536, alias="ARGON2_MEMORY_COST")
    argon2_parallelism: int = Field(default=2, alias="ARGON2_PARALLELISM")

    # Redis
    redis_url: str | None = Field(default=None, alias="REDIS_URL")
    redis_enabled: bool = Field(default=False, alias="REDIS_ENABLED")

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_json: bool = Field(default=False, alias="LOG_JSON")

    # Locale / currency defaults
    default_currency: str = Field(default="IQD", alias="DEFAULT_CURRENCY")
    default_currency_symbol: str = Field(default="د.ع", alias="DEFAULT_CURRENCY_SYMBOL")
    default_locale: str = Field(default="ar-IQ", alias="DEFAULT_LOCALE")
    default_timezone: str = Field(default="Asia/Baghdad", alias="DEFAULT_TIMEZONE")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        """Accept comma-separated CORS origins from environment strings."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("redis_url", mode="before")
    @classmethod
    def empty_redis_url_to_none(cls, value: object) -> object:
        """Treat blank REDIS_URL as disabled/absent."""
        if value == "":
            return None
        return value

    @model_validator(mode="after")
    def apply_environment_defaults(self) -> Self:
        """Normalize debug/logging defaults per environment profile."""
        if self.app_env == AppEnvironment.PRODUCTION:
            object.__setattr__(self, "app_debug", False)
            if not self.log_json:
                object.__setattr__(self, "log_json", True)
            if self.log_level.upper() == "DEBUG":
                object.__setattr__(self, "log_level", "INFO")
        elif self.app_env == AppEnvironment.TESTING:
            object.__setattr__(self, "app_debug", True)
            object.__setattr__(self, "log_json", False)
        return self

    @property
    def is_development(self) -> bool:
        """Return True when running in development."""
        return self.app_env == AppEnvironment.DEVELOPMENT

    @property
    def is_production(self) -> bool:
        """Return True when running in production."""
        return self.app_env == AppEnvironment.PRODUCTION

    @property
    def is_testing(self) -> bool:
        """Return True when running in testing."""
        return self.app_env == AppEnvironment.TESTING

    @property
    def redis_is_configured(self) -> bool:
        """Return True when Redis is enabled and a URL is present."""
        return bool(self.redis_enabled and self.redis_url)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()

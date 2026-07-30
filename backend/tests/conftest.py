"""Shared pytest fixtures for foundation tests."""

import os

import pytest
from fastapi.testclient import TestClient

# Ensure testing environment before settings are cached.
os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("APP_DEBUG", "true")
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("LOG_JSON", "false")
os.environ.setdefault("REDIS_ENABLED", "false")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-juman-foundation")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://juman:juman@localhost:5432/juman_test",
)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """
    Provide a FastAPI TestClient with Redis disabled and settings cache cleared.
    """
    from app.config.settings import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("REDIS_ENABLED", "false")

    from app.main import create_app

    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    get_settings.cache_clear()

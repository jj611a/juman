"""HTTP smoke tests for foundation endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.exceptions import AuthenticationError
from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient) -> None:
    """Application root returns product identity."""
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Juman"
    assert body["name_ar"] == "جمان"
    assert "api" in body


def test_api_v1_root(client: TestClient) -> None:
    """Versioned API root returns Arabic product message."""
    response = client.get("/api/v1/")
    assert response.status_code == 200
    body = response.json()
    assert body["name_ar"] == "جمان"
    assert "جمان" in body["message"]


def test_version_endpoint(client: TestClient) -> None:
    """Version endpoint returns structured metadata."""
    response = client.get("/api/v1/version")
    assert response.status_code == 200
    body = response.json()
    assert body["api"] == "v1"
    assert body["name"] == "Juman"


def test_health_endpoint_reports_database_status(client: TestClient) -> None:
    """Health endpoint should respond even when the database is unavailable."""
    mock_engine = MagicMock()
    mock_connection = AsyncMock()
    mock_connection.execute = AsyncMock(side_effect=Exception("db down"))
    mock_engine.connect = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_connection),
            __aexit__=AsyncMock(return_value=None),
        )
    )

    with patch("app.api.v1.endpoints.health.get_engine", return_value=mock_engine):
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["database"] == "down"
    assert body["status"] == "down"
    assert body["redis"] == "disabled"
    assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_current_user_requires_bearer_token() -> None:
    """Bearer principal resolution fails closed without a token."""
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.identity.dependencies import get_current_user
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/sessions",
        "headers": [],
        "query_string": b"",
    }
    request = Request(scope)

    with pytest.raises(AuthenticationError):
        await get_current_user(
            request=request,
            token=None,
            db=MagicMock(),
            tokens=MagicMock(),
            sessions=AsyncMock(),
            passwords=AsyncMock(),
        )

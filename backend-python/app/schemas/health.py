"""Health and version response schemas."""

from typing import Literal

from app.schemas.common import APIModel


class HealthResponse(APIModel):
    """Application health probe response."""

    status: Literal["ok", "degraded", "down"]
    app: str
    environment: str
    database: Literal["up", "down"]
    redis: Literal["disabled", "up", "down"]
    version: str


class VersionResponse(APIModel):
    """Application version metadata."""

    name: str
    name_ar: str
    version: str
    api: str
    environment: str

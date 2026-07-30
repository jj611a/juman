"""Version endpoint."""

from fastapi import APIRouter

from app.config import get_settings
from app.core.constants import APP_DISPLAY_NAME, APP_NAME_AR
from app.schemas.health import VersionResponse

router = APIRouter()


@router.get("/version", response_model=VersionResponse, summary="API version")
async def get_version() -> VersionResponse:
    """Return application and API version metadata."""
    settings = get_settings()
    return VersionResponse(
        name=APP_DISPLAY_NAME,
        name_ar=APP_NAME_AR,
        version=settings.app_version,
        api="v1",
        environment=settings.app_env.value,
    )

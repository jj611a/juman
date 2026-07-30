"""Root metadata endpoint under API v1."""

from fastapi import APIRouter

from app.config import get_settings
from app.core.constants import APP_DISPLAY_NAME, APP_NAME_AR

router = APIRouter()


@router.get("/", summary="API root metadata")
async def api_root() -> dict[str, str]:
    """Return basic API identity for clients and operators."""
    settings = get_settings()
    return {
        "name": APP_DISPLAY_NAME,
        "name_ar": APP_NAME_AR,
        "message": "نظام جمان لإدارة نقاط البيع والتأجير",
        "version": settings.app_version,
        "docs": "/docs",
    }

"""Media HTTP API package."""

from fastapi import APIRouter

from app.modules.media.api.files import router as media_router

router = APIRouter()
router.include_router(media_router)

__all__ = ["router"]

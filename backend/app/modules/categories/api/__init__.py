"""Categories HTTP API package."""

from fastapi import APIRouter

from app.modules.categories.api.router import router as categories_router

router = APIRouter()
router.include_router(categories_router)

__all__ = ["router"]

"""Inventory HTTP API package."""

from fastapi import APIRouter

from app.modules.inventory.api.photos import dress_photos_router, dresses_photos_router
from app.modules.inventory.api.router import router as dresses_router

router = APIRouter()
router.include_router(dresses_photos_router)
router.include_router(dress_photos_router)
router.include_router(dresses_router)

__all__ = ["router"]

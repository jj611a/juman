"""Processing API package."""

from fastapi import APIRouter

from app.modules.processing.api.router import router as processing_router

router = APIRouter()
router.include_router(processing_router)

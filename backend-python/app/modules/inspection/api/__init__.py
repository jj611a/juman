"""Inspection API package."""

from fastapi import APIRouter

from app.modules.inspection.api.router import router as inspection_router

router = APIRouter()
router.include_router(inspection_router)

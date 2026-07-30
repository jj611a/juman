"""Audit HTTP API package."""

from fastapi import APIRouter

from app.modules.audit.api.logs import router as logs_router

router = APIRouter(prefix="/audit", tags=["Audit"])
router.include_router(logs_router)

__all__ = ["router"]

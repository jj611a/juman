"""Returns API package."""

from fastapi import APIRouter

from app.modules.returns.api.router import router as returns_router

router = APIRouter()
router.include_router(returns_router)

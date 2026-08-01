"""Settlement API package."""

from fastapi import APIRouter

from app.modules.settlements.api.router import rental_settlement_router, router as settlements_router

router = APIRouter()
router.include_router(settlements_router)
router.include_router(rental_settlement_router)

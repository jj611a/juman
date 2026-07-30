"""Rentals API package."""

from fastapi import APIRouter

from app.modules.rentals.api.router import router as rentals_router

router = APIRouter()
router.include_router(rentals_router)

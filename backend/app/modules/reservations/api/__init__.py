"""Reservations API package."""

from fastapi import APIRouter

from app.modules.reservations.api.router import router as reservations_router

router = APIRouter()
router.include_router(reservations_router)

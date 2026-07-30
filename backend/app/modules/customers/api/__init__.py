"""Customers HTTP API package."""

from fastapi import APIRouter

from app.modules.customers.api.router import router as customers_router

router = APIRouter()
router.include_router(customers_router)

__all__ = ["router"]

"""Rentals services."""

from app.modules.rentals.services.rental import RentalService
from app.modules.rentals.services.rental_number import RentalNumberService

__all__ = ["RentalNumberService", "RentalService"]

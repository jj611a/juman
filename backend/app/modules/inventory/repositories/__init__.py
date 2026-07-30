"""Inventory repositories package."""

from app.modules.inventory.repositories.barcode_counter import BarcodeCounterRepository
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.inventory.repositories.dress_photo import DressPhotoRepository

__all__ = ["BarcodeCounterRepository", "DressRepository", "DressPhotoRepository"]

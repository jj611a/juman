"""Inspection services."""

from app.modules.inspection.services.inspection import InspectionService
from app.modules.inspection.services.inspection_number import InspectionNumberService

__all__ = ["InspectionNumberService", "InspectionService"]

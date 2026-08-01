"""Shared abstract SQLAlchemy models (no concrete business tables)."""

from app.models.base import AuditedSoftDeleteModel

__all__ = ["AuditedSoftDeleteModel"]

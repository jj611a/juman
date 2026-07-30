"""Abstract mapped base classes composed from foundation mixins."""

from app.common.mixins import (
    AuditMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)
from app.database.base import Base


class AuditedSoftDeleteModel(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    AuditMixin,
    SoftDeleteMixin,
    Base,
):
    """
    Abstract base for future business entities.

    Provides UUID primary key, UTC timestamps, audit actor columns, and
    soft-delete columns. Concrete modules inherit this class and define
    ``__tablename__`` plus domain columns.
    """

    __abstract__ = True

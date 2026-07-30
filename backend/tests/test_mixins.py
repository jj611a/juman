"""Tests for shared model mixins and abstract base composition."""

from app.common.mixins import (
    AuditMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)
from app.database.base import Base
from app.models.base import AuditedSoftDeleteModel


def test_audited_soft_delete_model_is_abstract() -> None:
    """Foundation base model must remain abstract with no concrete table."""
    assert AuditedSoftDeleteModel.__abstract__ is True


def test_mixin_columns_present_on_abstract_model() -> None:
    """Concrete subclass of the abstract base must expose required columns."""

    class ProbeModel(AuditedSoftDeleteModel):
        __tablename__ = "zz_foundation_probe_only"

    try:
        columns = set(ProbeModel.__table__.columns.keys())
        expected = {
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
            "deleted_by",
        }
        assert expected.issubset(columns)
    finally:
        Base.metadata.remove(ProbeModel.__table__)


def test_mixin_classes_exist() -> None:
    """Ensure mixin building blocks remain importable for future modules."""
    assert UUIDPrimaryKeyMixin is not None
    assert TimestampMixin is not None
    assert AuditMixin is not None
    assert SoftDeleteMixin is not None

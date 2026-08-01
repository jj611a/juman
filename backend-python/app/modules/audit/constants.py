"""Audit module constants."""

from enum import StrEnum


class AuditPermission(StrEnum):
    """RBAC permission keys for Audit admin APIs."""

    VIEW = "audit.view"


class AuditAction(StrEnum):
    """Canonical audit actions for entity change tracking."""

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    SOFT_DELETE = "soft_delete"
    RESTORE = "restore"
    ACTIVATE = "activate"
    DEACTIVATE = "deactivate"
    LOGIN = "login"
    LOGOUT = "logout"
    EXPORT = "export"
    CUSTOM = "custom"
    BARCODE_GENERATED = "barcode_generated"
    BARCODE_CHANGED = "barcode_changed"
    BARCODE_MANUAL_OVERRIDE = "barcode_manual_override"
    PHOTO_ADDED = "photo_added"
    PHOTO_REMOVED = "photo_removed"
    COVER_CHANGED = "cover_changed"
    GALLERY_REORDERED = "gallery_reordered"
    STATUS_CHANGED = "status_changed"
    CONFIRM = "confirm"
    CANCEL = "cancel"
    EXPIRE = "expire"
    CONVERT = "convert"
    RETURN = "return"
    COMPLETE = "complete"

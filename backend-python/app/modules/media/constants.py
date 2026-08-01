"""Media module constants."""

from enum import StrEnum

from app.modules.settings.constants import SettingKey


class MediaPermission(StrEnum):
    """RBAC permission keys for Media APIs."""

    UPLOAD = "media.upload"
    VIEW = "media.view"
    DELETE = "media.delete"
    MANAGE = "media.manage"


class StorageProviderName(StrEnum):
    """Known storage provider identifiers."""

    LOCAL = "local"
    S3 = "s3"
    MINIO = "minio"
    AZURE = "azure"
    GCS = "gcs"


MEDIA_SETTING_KEYS = (
    SettingKey.MEDIA_STORAGE_PROVIDER,
    SettingKey.MEDIA_STORAGE_ROOT,
    SettingKey.MEDIA_MAX_UPLOAD_BYTES,
    SettingKey.MEDIA_ALLOWED_EXTENSIONS,
    SettingKey.MEDIA_ALLOWED_MIME_TYPES,
)

DEFAULT_ALLOWED_EXTENSIONS = "jpg,jpeg,png,webp,pdf,gif"
DEFAULT_ALLOWED_MIME_TYPES = "image/jpeg,image/png,image/webp,image/gif,application/pdf"
DEFAULT_MAX_UPLOAD_BYTES = 10_485_760
DEFAULT_STORAGE_ROOT = "./storage/media"

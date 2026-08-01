"""Storage provider factory."""

from __future__ import annotations

from app.exceptions import BusinessError
from app.modules.media.constants import StorageProviderName
from app.modules.media.providers.base import StorageProvider
from app.modules.media.providers.local import LocalStorageProvider
from app.modules.media.providers.stubs import (
    AzureBlobStorageProvider,
    GCSStorageProvider,
    MinIOStorageProvider,
    S3StorageProvider,
)


def get_storage_provider(
    name: str,
    *,
    storage_root: str,
) -> StorageProvider:
    """
    Resolve a storage provider by Settings name.

    Only ``local`` is fully implemented; cloud names return stubs that raise
    ``NotImplementedError`` on use.
    """
    normalized = name.strip().lower()
    if normalized == StorageProviderName.LOCAL.value:
        return LocalStorageProvider(storage_root)
    if normalized == StorageProviderName.S3.value:
        return S3StorageProvider()
    if normalized == StorageProviderName.MINIO.value:
        return MinIOStorageProvider()
    if normalized == StorageProviderName.AZURE.value:
        return AzureBlobStorageProvider()
    if normalized == StorageProviderName.GCS.value:
        return GCSStorageProvider()
    raise BusinessError(
        "موفر التخزين غير مدعوم",
        code="unsupported_storage_provider",
        details={"provider": name},
    )

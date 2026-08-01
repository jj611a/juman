"""Cloud storage provider stubs (interface only)."""

from __future__ import annotations

from typing import BinaryIO


class _CloudStubMixin:
    """Shared NotImplementedError behaviour for unimplemented providers."""

    provider_name: str = "cloud"

    def save(self, relative_path: str, data: bytes) -> None:
        raise NotImplementedError(f"{self.provider_name} storage is not implemented")

    def open(self, relative_path: str) -> BinaryIO:
        raise NotImplementedError(f"{self.provider_name} storage is not implemented")

    def delete(self, relative_path: str) -> None:
        raise NotImplementedError(f"{self.provider_name} storage is not implemented")

    def exists(self, relative_path: str) -> bool:
        raise NotImplementedError(f"{self.provider_name} storage is not implemented")


class S3StorageProvider(_CloudStubMixin):
    """Amazon S3 stub — implement when cloud storage is enabled."""

    provider_name = "s3"

    def __init__(self, **_: object) -> None:
        pass


class MinIOStorageProvider(_CloudStubMixin):
    """MinIO stub — implement when object storage is enabled."""

    provider_name = "minio"

    def __init__(self, **_: object) -> None:
        pass


class AzureBlobStorageProvider(_CloudStubMixin):
    """Azure Blob Storage stub."""

    provider_name = "azure"

    def __init__(self, **_: object) -> None:
        pass


class GCSStorageProvider(_CloudStubMixin):
    """Google Cloud Storage stub."""

    provider_name = "gcs"

    def __init__(self, **_: object) -> None:
        pass

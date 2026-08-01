"""Storage provider factory and stub tests."""

import pytest
from app.exceptions import BusinessError
from app.modules.media.providers import get_storage_provider
from app.modules.media.providers.local import LocalStorageProvider
from app.modules.media.providers.stubs import (
    AzureBlobStorageProvider,
    GCSStorageProvider,
    MinIOStorageProvider,
    S3StorageProvider,
)


def test_get_local_provider(tmp_path) -> None:
    provider = get_storage_provider("local", storage_root=str(tmp_path))
    assert isinstance(provider, LocalStorageProvider)


@pytest.mark.parametrize(
    ("name", "cls"),
    [
        ("s3", S3StorageProvider),
        ("minio", MinIOStorageProvider),
        ("azure", AzureBlobStorageProvider),
        ("gcs", GCSStorageProvider),
    ],
)
def test_cloud_stubs_raise(name: str, cls: type, tmp_path) -> None:
    provider = get_storage_provider(name, storage_root=str(tmp_path))
    assert isinstance(provider, cls)
    with pytest.raises(NotImplementedError):
        provider.save("a.bin", b"x")
    with pytest.raises(NotImplementedError):
        provider.open("a.bin")
    with pytest.raises(NotImplementedError):
        provider.delete("a.bin")
    with pytest.raises(NotImplementedError):
        provider.exists("a.bin")


def test_unsupported_provider(tmp_path) -> None:
    with pytest.raises(BusinessError):
        get_storage_provider("ftp", storage_root=str(tmp_path))

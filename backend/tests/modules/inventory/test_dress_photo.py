"""DressPhotoService and API tests."""

from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.services.dress import DressService
from app.modules.inventory.services.dress_photo import DressPhotoService
from app.modules.media.models.stored_file import StoredFile
from app.modules.media.repositories.stored_file import StoredFileRepository
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


async def _make_stored_file(
    session: AsyncSession,
    *,
    mime_type: str = "image/jpeg",
    name: str = "gown.jpg",
) -> StoredFile:
    repo = StoredFileRepository(session)
    return await repo.add(
        StoredFile(
            original_filename=name,
            stored_filename=f"{uuid4()}.jpg",
            extension="jpg",
            mime_type=mime_type,
            size_bytes=1024,
            sha256_hash=uuid4().hex,
            storage_provider="local",
            relative_path=f"2026/07/{uuid4()}.jpg",
            is_public=False,
        )
    )


async def _make_dress(dress_service: DressService, category_id):
    return await dress_service.create_dress(
        category_id=category_id,
        name_ar="فستان صور",
        size="M",
        colour="BLACK",
        purchase_price=1000,
        default_daily_rental_price=100,
        default_sale_price=1500,
    )


@pytest.fixture
async def photo_service(db_session: AsyncSession) -> DressPhotoService:
    from app.modules.settings.services.setting import SettingService
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    return DressPhotoService(
        db_session,
        settings=SettingService(db_session),
        audit=AuditService(db_session),
    )


@pytest.mark.asyncio
async def test_add_list_cover_reorder_remove(
    dress_service: DressService,
    photo_service: DressPhotoService,
    sample_category,
    db_session: AsyncSession,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    f1 = await _make_stored_file(db_session, name="a.jpg")
    f2 = await _make_stored_file(db_session, name="b.jpg")
    f3 = await _make_stored_file(db_session, name="c.jpg")

    p1 = await photo_service.add_photo(
        dress.id,
        stored_file_id=f1.id,
        is_cover=True,
        actor_username="admin",
    )
    assert p1.is_cover is True
    assert p1.display_order == 0

    p2 = await photo_service.add_photo(dress.id, stored_file_id=f2.id)
    p3 = await photo_service.add_photo(dress.id, stored_file_id=f3.id, is_cover=True)
    assert p3.is_cover is True
    refreshed = await photo_service.get_photo(p1.id)
    assert refreshed.is_cover is False

    with pytest.raises(ConflictError):
        await photo_service.add_photo(dress.id, stored_file_id=f1.id)

    items = await photo_service.list_photos(dress.id)
    assert len(items) == 3

    reordered = await photo_service.reorder_photos(
        dress.id,
        photo_ids=[p3.id, p1.id, p2.id],
        actor_username="admin",
    )
    assert [p.id for p in reordered] == [p3.id, p1.id, p2.id]
    assert [p.display_order for p in reordered] == [0, 1, 2]

    with pytest.raises(ValidationError):
        await photo_service.reorder_photos(dress.id, photo_ids=[p1.id, p2.id])

    covered = await photo_service.set_cover(dress.id, photo_id=p2.id, actor_username="admin")
    assert covered.is_cover is True

    await photo_service.remove_photo(p2.id, actor_username="admin")
    remaining = await photo_service.list_photos(dress.id)
    assert len(remaining) == 2
    assert all(not p.is_cover for p in remaining)

    # Stored file still live.
    assert await StoredFileRepository(db_session).get_active(f2.id) is not None

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="inventory", entity_id=str(p1.id))
    actions = {row.action for row in logs}
    assert AuditAction.PHOTO_ADDED.value in actions


@pytest.mark.asyncio
async def test_reject_non_image_and_missing(
    dress_service: DressService,
    photo_service: DressPhotoService,
    sample_category,
    db_session: AsyncSession,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    pdf = await _make_stored_file(db_session, mime_type="application/pdf", name="x.pdf")
    with pytest.raises(ValidationError):
        await photo_service.add_photo(dress.id, stored_file_id=pdf.id)
    with pytest.raises(NotFoundError):
        await photo_service.add_photo(dress.id, stored_file_id=uuid4())
    with pytest.raises(NotFoundError):
        await photo_service.list_photos(uuid4())
    with pytest.raises(NotFoundError):
        await photo_service.get_photo(uuid4())


@pytest.mark.asyncio
async def test_add_validation_and_update_paths(
    dress_service: DressService,
    photo_service: DressPhotoService,
    sample_category,
    db_session: AsyncSession,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    other = await _make_dress(dress_service, sample_category.id)
    f1 = await _make_stored_file(db_session, name="u1.jpg")
    f2 = await _make_stored_file(db_session, name="u2.jpg")

    with pytest.raises(ValidationError):
        await photo_service.add_photo(dress.id, stored_file_id=f1.id, display_order=-1)
    with pytest.raises(ValidationError):
        await photo_service.add_photo(dress.id, stored_file_id=f1.id, caption="x" * 501)

    p1 = await photo_service.add_photo(
        dress.id,
        stored_file_id=f1.id,
        caption="  مرحبا  ",
        display_order=2,
    )
    assert p1.caption == "مرحبا"
    assert p1.display_order == 2
    assert "DressPhoto" in repr(p1)

    p2 = await photo_service.add_photo(dress.id, stored_file_id=f2.id)
    updated = await photo_service.update_photo(
        p1.id,
        caption="جديد",
        display_order=0,
        is_cover=True,
        actor_username="admin",
    )
    assert updated.caption == "جديد"
    assert updated.display_order == 0
    assert updated.is_cover is True

    cleared = await photo_service.update_photo(p1.id, clear_caption=True, is_cover=False)
    assert cleared.caption is None
    assert cleared.is_cover is False

    with pytest.raises(ValidationError):
        await photo_service.update_photo(p1.id, display_order=-3)
    with pytest.raises(ValidationError):
        await photo_service.update_photo(p1.id, caption="y" * 501)

    with pytest.raises(ValidationError):
        await photo_service.reorder_photos(dress.id, photo_ids=[p1.id, p1.id])

    with pytest.raises(ValidationError):
        await photo_service.set_cover(other.id, photo_id=p2.id)

    from app.modules.inventory.repositories.dress_photo import DressPhotoRepository

    assert await DressPhotoRepository(db_session).count_for_dress(dress.id) == 2


@pytest.mark.asyncio
async def test_dependency_factories(db_session: AsyncSession) -> None:
    from app.modules.inventory.dependencies import get_dress_photo_service, get_dress_service
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    dress_svc = await get_dress_service(db_session)
    photo_svc = await get_dress_photo_service(db_session)
    assert isinstance(dress_svc, DressService)
    assert isinstance(photo_svc, DressPhotoService)


@pytest.mark.asyncio
async def test_photos_api_flow(
    admin_client: AsyncClient,
    dress_service: DressService,
    sample_category,
    db_session: AsyncSession,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    f1 = await _make_stored_file(db_session)
    f2 = await _make_stored_file(db_session, name="two.jpg")

    created = await admin_client.post(
        f"/api/v1/dresses/{dress.id}/photos",
        json={"stored_file_id": str(f1.id), "is_cover": True, "caption": "غلاف"},
    )
    assert created.status_code == 201, created.text
    photo_id = created.json()["data"]["id"]
    assert created.json()["data"]["is_cover"] is True
    assert created.json()["data"]["file"]["mime_type"] == "image/jpeg"

    second = await admin_client.post(
        f"/api/v1/dresses/{dress.id}/photos",
        json={"stored_file_id": str(f2.id)},
    )
    assert second.status_code == 201
    photo2_id = second.json()["data"]["id"]

    listed = await admin_client.get(f"/api/v1/dresses/{dress.id}/photos")
    assert listed.status_code == 200
    assert len(listed.json()["data"]) == 2

    reordered = await admin_client.patch(
        f"/api/v1/dresses/{dress.id}/photos/reorder",
        json={"photo_ids": [photo2_id, photo_id]},
    )
    assert reordered.status_code == 200
    assert [p["id"] for p in reordered.json()["data"]] == [photo2_id, photo_id]

    cover = await admin_client.patch(
        f"/api/v1/dresses/{dress.id}/photos/cover",
        json={"photo_id": photo2_id},
    )
    assert cover.status_code == 200
    assert cover.json()["data"]["is_cover"] is True

    patched = await admin_client.patch(
        f"/api/v1/dress-photos/{photo_id}",
        json={"caption": "محدث", "display_order": 5},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["caption"] == "محدث"

    deleted = await admin_client.delete(f"/api/v1/dress-photos/{photo_id}")
    assert deleted.status_code == 200
    assert await StoredFileRepository(db_session).get_active(f1.id) is not None


@pytest.mark.asyncio
async def test_photos_require_auth_and_permission(
    api_client: AsyncClient,
    db_session: AsyncSession,
    dress_service: DressService,
    sample_category,
) -> None:
    dress = await _make_dress(dress_service, sample_category.id)
    unauth = await api_client.get(f"/api/v1/dresses/{dress.id}/photos")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="photo_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    # Laundry has inventory.view — list OK; update forbidden
    listed = await api_client.get(
        f"/api/v1/dresses/{dress.id}/photos",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 200
    created = await api_client.post(
        f"/api/v1/dresses/{dress.id}/photos",
        headers=bearer_headers(pair.access_token),
        json={"stored_file_id": str(uuid4())},
    )
    assert created.status_code == 403

"""CategoryService tests."""

from uuid import uuid4

import pytest
from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.categories.services.category import CategoryService


@pytest.mark.asyncio
async def test_create_list_update_activate_deactivate_delete(
    category_service: CategoryService,
) -> None:
    created = await category_service.create_category(
        name_ar="سهرة",
        name_en="Evening",
        description="فساتين سهرة",
        display_order=2,
        actor_username="admin",
    )
    assert created.name_ar == "سهرة"
    assert created.is_active is True

    await category_service.create_category(
        name_ar="يومي",
        name_en="Casual",
        display_order=1,
    )

    items, total = await category_service.list_categories()
    assert total == 2
    assert items[0].name_ar == "يومي"  # display_order asc

    active, active_total = await category_service.list_categories(active_only=True)
    assert active_total == 2

    searched, searched_total = await category_service.list_categories(q="Evening")
    assert searched_total == 1
    assert searched[0].name_en == "Evening"

    updated = await category_service.update_category(
        created.id,
        description="محدث",
        actor_username="admin",
    )
    assert updated.description == "محدث"

    deactivated = await category_service.deactivate(created.id, actor_username="admin")
    assert deactivated.is_active is False
    _, only_active = await category_service.list_categories(active_only=True)
    assert only_active == 1

    activated = await category_service.activate(created.id, actor_username="admin")
    assert activated.is_active is True

    await category_service.soft_delete(created.id, actor_username="admin")
    with pytest.raises(NotFoundError):
        await category_service.get_category(created.id)

    audit = AuditService(category_service.session)
    logs, log_total = await audit.list_logs(module="categories", entity_id=str(created.id))
    assert log_total >= 5
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.UPDATE.value in actions
    assert AuditAction.ACTIVATE.value in actions
    assert AuditAction.DEACTIVATE.value in actions
    assert AuditAction.SOFT_DELETE.value in actions


@pytest.mark.asyncio
async def test_unique_name_ar(category_service: CategoryService) -> None:
    await category_service.create_category(name_ar="كلاسيك")
    with pytest.raises(ConflictError):
        await category_service.create_category(name_ar="كلاسيك")

    other = await category_service.create_category(name_ar="مودرن")
    with pytest.raises(ConflictError):
        await category_service.update_category(other.id, name_ar="كلاسيك")


@pytest.mark.asyncio
async def test_dress_reference_blocks_delete(
    category_service: CategoryService,
    db_session,
) -> None:
    from app.modules.audit.services.audit_log import AuditService
    from app.modules.inventory.services.dress import DressService
    from app.modules.settings.services.setting import SettingService

    category = await category_service.create_category(name_ar="محجوب")
    dresses = DressService(
        db_session,
        settings=SettingService(db_session),
        audit=AuditService(db_session),
    )
    await dresses.create_dress(
        category_id=category.id,
        name_ar="فستان محجوب",
        size="M",
        colour="BLACK",
        purchase_price=10_000,
        default_daily_rental_price=5_000,
        default_sale_price=12_000,
    )
    with pytest.raises(BusinessError) as exc:
        await category_service.soft_delete(category.id)
    assert exc.value.code == "category_in_use"
    assert exc.value.status_code == 409

    # Still exists.
    assert (await category_service.get_category(category.id)).id == category.id


@pytest.mark.asyncio
async def test_sort_validation(category_service: CategoryService) -> None:
    with pytest.raises(ValidationError):
        await category_service.list_categories(sort_by="nope")
    with pytest.raises(ValidationError):
        await category_service.list_categories(sort_dir="sideways")


@pytest.mark.asyncio
async def test_get_missing(category_service: CategoryService) -> None:
    with pytest.raises(NotFoundError):
        await category_service.get_category(uuid4())


@pytest.mark.asyncio
async def test_create_requires_name(category_service: CategoryService) -> None:
    with pytest.raises(ValidationError):
        await category_service.create_category(name_ar="   ")


@pytest.mark.asyncio
async def test_update_fields_and_empty_name(
    category_service: CategoryService,
) -> None:
    category = await category_service.create_category(
        name_ar="أساسي",
        name_en="Base",
        description="وصف",
    )
    assert "أساسي" in repr(category)

    with pytest.raises(ValidationError):
        await category_service.update_category(category.id, name_ar="  ")

    updated = await category_service.update_category(
        category.id,
        name_en="  ",
        description="  ",
        display_order=5,
        is_active=False,
    )
    assert updated.name_en is None
    assert updated.description is None
    assert updated.display_order == 5
    assert updated.is_active is False

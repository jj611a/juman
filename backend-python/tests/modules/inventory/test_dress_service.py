"""DressService tests (Phase 1–2)."""

from datetime import date
from uuid import uuid4

import pytest
from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.categories.services.category import CategoryService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress import DressService


async def _create_dress(
    dress_service: DressService,
    category_id,
    *,
    name_ar: str = "فستان أحمر",
    barcode: str | None = None,
    **kwargs,
):
    return await dress_service.create_dress(
        category_id=category_id,
        name_ar=name_ar,
        size=kwargs.pop("size", "M"),
        colour=kwargs.pop("colour", "RED"),
        purchase_price=kwargs.pop("purchase_price", 100_000),
        default_daily_rental_price=kwargs.pop("default_daily_rental_price", 25_000),
        default_sale_price=kwargs.pop("default_sale_price", 150_000),
        barcode=barcode,
        **kwargs,
    )


@pytest.mark.asyncio
async def test_create_list_update_activate_deactivate_delete(
    dress_service: DressService,
    sample_category,
) -> None:
    created = await _create_dress(
        dress_service,
        sample_category.id,
        name_ar="سهرة ذهبية",
        name_en="Gold Evening",
        brand="Juman",
        barcode="DR-00000001",
        purchase_date=date(2026, 1, 15),
        actor_username="admin",
    )
    assert created.status == DressStatus.AVAILABLE.value
    assert created.barcode == "DR-00000001"
    assert created.is_active is True

    auto = await _create_dress(
        dress_service,
        sample_category.id,
        name_ar="يومي أزرق",
        brand="Other",
        colour="BLUE",
        size="L",
    )
    assert auto.barcode == "DR-00000002"

    items, total = await dress_service.list_dresses()
    assert total == 2

    searched, searched_total = await dress_service.list_dresses(q="Gold")
    assert searched_total == 1
    assert searched[0].name_en == "Gold Evening"

    by_barcode = await dress_service.get_dress_by_barcode("DR-00000001")
    assert by_barcode.id == created.id

    updated = await dress_service.update_dress(
        created.id,
        brand="Juman Atelier",
        actor_username="admin",
    )
    assert updated.brand == "Juman Atelier"
    assert updated.status == DressStatus.AVAILABLE.value

    deactivated = await dress_service.deactivate(created.id, actor_username="admin")
    assert deactivated.is_active is False
    _, only_active = await dress_service.list_dresses(is_active=True)
    assert only_active == 1

    activated = await dress_service.activate(created.id, actor_username="admin")
    assert activated.is_active is True

    changed = await dress_service.set_barcode(
        created.id,
        barcode="DR-00000099",
        actor_username="admin",
    )
    assert changed.barcode == "DR-00000099"

    regenerated = await dress_service.set_barcode(created.id, actor_username="admin")
    assert regenerated.barcode.startswith("DR-")
    assert regenerated.barcode != "DR-00000099"

    await dress_service.soft_delete(created.id, actor_username="admin")
    with pytest.raises(NotFoundError):
        await dress_service.get_dress(created.id)

    audit = AuditService(dress_service.session)
    logs, log_total = await audit.list_logs(module="inventory", entity_id=str(created.id))
    assert log_total >= 5
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.BARCODE_MANUAL_OVERRIDE.value in actions
    assert AuditAction.SOFT_DELETE.value in actions


@pytest.mark.asyncio
async def test_invalid_category_size_colour_price(
    dress_service: DressService,
    sample_category,
) -> None:
    with pytest.raises(NotFoundError):
        await _create_dress(dress_service, uuid4())

    with pytest.raises(ValidationError):
        await _create_dress(dress_service, sample_category.id, size="HUGE")

    with pytest.raises(ValidationError):
        await _create_dress(dress_service, sample_category.id, colour="NEON")

    with pytest.raises(ValidationError):
        await _create_dress(dress_service, sample_category.id, purchase_price=-1)


@pytest.mark.asyncio
async def test_inactive_category_rejected(
    dress_service: DressService,
    category_service: CategoryService,
) -> None:
    category = await category_service.create_category(name_ar="موقوف")
    await category_service.deactivate(category.id)
    with pytest.raises(ValidationError):
        await _create_dress(dress_service, category.id)


@pytest.mark.asyncio
async def test_barcode_uniqueness_and_format(
    dress_service: DressService,
    sample_category,
) -> None:
    await _create_dress(dress_service, sample_category.id, barcode="DR-00000010")
    with pytest.raises(ConflictError):
        await _create_dress(
            dress_service,
            sample_category.id,
            name_ar="مكرر",
            barcode="DR-00000010",
        )

    with pytest.raises(ValidationError):
        await _create_dress(
            dress_service,
            sample_category.id,
            barcode="XX-00000001",
        )

    with pytest.raises(ValidationError):
        await _create_dress(
            dress_service,
            sample_category.id,
            barcode="DR-01",
        )

    # Soft-deleted barcode cannot be reused (lifetime uniqueness).
    existing = await _create_dress(
        dress_service,
        sample_category.id,
        name_ar="قابل للحذف",
        barcode="DR-00000011",
    )
    await dress_service.soft_delete(existing.id)
    with pytest.raises(ConflictError):
        await _create_dress(
            dress_service,
            sample_category.id,
            name_ar="معاد",
            barcode="DR-00000011",
        )


@pytest.mark.asyncio
async def test_duplicate_names_allowed(
    dress_service: DressService,
    sample_category,
) -> None:
    a = await _create_dress(dress_service, sample_category.id, name_ar="متطابق")
    b = await _create_dress(dress_service, sample_category.id, name_ar="متطابق")
    assert a.id != b.id
    assert a.barcode != b.barcode


@pytest.mark.asyncio
async def test_category_delete_blocked_when_dress_exists(
    dress_service: DressService,
    category_service: CategoryService,
    sample_category,
) -> None:
    await _create_dress(dress_service, sample_category.id)
    with pytest.raises(BusinessError) as exc:
        await category_service.soft_delete(sample_category.id)
    assert exc.value.code == "category_in_use"
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_set_barcode_blocked_when_business_history(
    dress_service: DressService,
    sample_category,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dress = await _create_dress(dress_service, sample_category.id)

    async def _history(_dress_id):
        return True

    monkeypatch.setattr(dress_service, "_has_business_history", _history)
    with pytest.raises(BusinessError) as exc:
        await dress_service.set_barcode(dress.id, barcode="DR-00000055")
    assert exc.value.code == "barcode_locked"


@pytest.mark.asyncio
async def test_sort_validation(dress_service: DressService) -> None:
    with pytest.raises(ValidationError):
        await dress_service.list_dresses(sort_by="nope")
    with pytest.raises(ValidationError):
        await dress_service.list_dresses(sort_dir="sideways")


@pytest.mark.asyncio
async def test_get_missing(dress_service: DressService) -> None:
    with pytest.raises(NotFoundError):
        await dress_service.get_dress(uuid4())
    with pytest.raises(NotFoundError):
        await dress_service.get_dress_by_barcode("DR-99999999")


@pytest.mark.asyncio
async def test_list_filters_and_update_fields(
    dress_service: DressService,
    sample_category,
    category_service: CategoryService,
) -> None:
    other = await category_service.create_category(name_ar="يومي")
    await _create_dress(
        dress_service,
        sample_category.id,
        name_ar="مفلتر",
        brand="Alpha",
        size="S",
        colour="PINK",
        barcode="DR-00000020",
    )
    await _create_dress(
        dress_service,
        other.id,
        name_ar="آخر",
        brand="Beta",
        size="L",
        colour="NAVY",
    )
    items, total = await dress_service.list_dresses(
        category_id=sample_category.id,
        brand="Alph",
        size="S",
        colour="PINK",
        status="AVAILABLE",
        sort_by="name_ar",
        sort_dir="asc",
    )
    assert total == 1
    assert items[0].name_ar == "مفلتر"

    updated = await dress_service.update_dress(
        items[0].id,
        category_id=other.id,
        name_ar="محدث",
        size="XL",
        colour="GOLD",
        purchase_price=9,
        default_daily_rental_price=8,
        default_sale_price=7,
        purchase_date=date(2026, 2, 1),
        is_active=False,
    )
    assert updated.category_id == other.id
    assert updated.size == "XL"
    assert updated.is_active is False

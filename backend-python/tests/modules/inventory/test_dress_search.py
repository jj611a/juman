"""Dress search / filter / sort / pagination tests (Phase 5)."""

from datetime import datetime, timedelta, timezone

import pytest
from app.exceptions import ValidationError
from app.modules.categories.services.category import CategoryService
from app.modules.inventory.constants import DressSortField
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.inventory.services.dress import DressService
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _create(
    dress_service: DressService,
    category_id,
    *,
    name_ar: str = "فستان",
    name_en: str | None = None,
    brand: str | None = None,
    size: str = "M",
    colour: str = "BLACK",
    barcode: str | None = None,
    purchase_price: int = 1000,
    rental: int = 100,
    sale: int = 1500,
    description: str | None = None,
    is_active: bool = True,
):
    return await dress_service.create_dress(
        category_id=category_id,
        name_ar=name_ar,
        name_en=name_en,
        brand=brand,
        size=size,
        colour=colour,
        purchase_price=purchase_price,
        default_daily_rental_price=rental,
        default_sale_price=sale,
        barcode=barcode,
        description=description,
        is_active=is_active,
    )


@pytest.mark.asyncio
async def test_search_q_arabic_english_description_category(
    dress_service: DressService,
    sample_category,
    category_service: CategoryService,
) -> None:
    bridal = await category_service.create_category(name_ar="زفاف", name_en="Bridal")
    await _create(
        dress_service,
        sample_category.id,
        name_ar="سهرة ذهبية",
        name_en="Gold Gala",
        description="تطريز فاخر",
        brand="Maison",
        barcode="DR-00001001",
    )
    await _create(
        dress_service,
        bridal.id,
        name_ar="عروس كلاسيك",
        barcode="DR-00001002",
    )

    by_ar, n = await dress_service.list_dresses(q="ذهبية")
    assert n == 1
    assert by_ar[0].name_ar == "سهرة ذهبية"

    by_en, n = await dress_service.list_dresses(q="gala")
    assert n == 1

    by_desc, n = await dress_service.list_dresses(q="تطريز")
    assert n == 1

    by_cat, n = await dress_service.list_dresses(q="زفاف")
    assert n == 1
    assert by_cat[0].category_id == bridal.id

    by_barcode_partial, n = await dress_service.list_dresses(q="00001001")
    assert n == 1


@pytest.mark.asyncio
async def test_exact_barcode_and_combined_filters(
    dress_service: DressService,
    sample_category,
) -> None:
    a = await _create(
        dress_service,
        sample_category.id,
        name_ar="أ",
        brand="Alpha House",
        size="S",
        colour="PINK",
        barcode="DR-00002001",
        purchase_price=500,
        rental=50,
        sale=700,
    )
    await _create(
        dress_service,
        sample_category.id,
        name_ar="ب",
        brand="Beta",
        size="L",
        colour="NAVY",
        barcode="DR-00002002",
        purchase_price=2000,
        rental=200,
        sale=3000,
        is_active=False,
    )

    exact, n = await dress_service.list_dresses(barcode="DR-00002001")
    assert n == 1
    assert exact[0].id == a.id

    filtered, n = await dress_service.list_dresses(
        brand="Alpha",
        size="S",
        colour="PINK",
        status="AVAILABLE",
        is_active=True,
        purchase_price_min=400,
        purchase_price_max=600,
        rental_price_min=40,
        rental_price_max=60,
        sale_price_min=600,
        sale_price_max=800,
    )
    assert n == 1
    assert filtered[0].id == a.id

    inactive, n = await dress_service.list_dresses(is_active=False)
    assert n == 1
    assert inactive[0].barcode == "DR-00002002"


@pytest.mark.asyncio
async def test_price_and_date_range_validation(dress_service: DressService) -> None:
    with pytest.raises(ValidationError):
        await dress_service.list_dresses(purchase_price_min=10, purchase_price_max=5)
    with pytest.raises(ValidationError):
        await dress_service.list_dresses(rental_price_min=-1)
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        await dress_service.list_dresses(
            created_from=now,
            created_to=now - timedelta(days=1),
        )


@pytest.mark.asyncio
async def test_sorting_and_pagination(
    dress_service: DressService,
    sample_category,
) -> None:
    await _create(
        dress_service,
        sample_category.id,
        name_ar="ج",
        barcode="DR-00003003",
        purchase_price=300,
        sale=300,
    )
    await _create(
        dress_service,
        sample_category.id,
        name_ar="أ",
        barcode="DR-00003001",
        purchase_price=100,
        sale=100,
    )
    await _create(
        dress_service,
        sample_category.id,
        name_ar="ب",
        barcode="DR-00003002",
        purchase_price=200,
        sale=200,
    )

    by_name, total = await dress_service.list_dresses(
        sort_by=DressSortField.NAME_AR,
        sort_dir="asc",
        page=1,
        page_size=2,
    )
    assert total == 3
    assert [d.name_ar for d in by_name] == ["أ", "ب"]

    page2, total2 = await dress_service.list_dresses(
        sort_by=DressSortField.NAME_AR,
        sort_dir="asc",
        page=2,
        page_size=2,
    )
    assert total2 == 3
    assert [d.name_ar for d in page2] == ["ج"]

    by_price, _ = await dress_service.list_dresses(
        sort_by=DressSortField.PURCHASE_PRICE,
        sort_dir="desc",
        page_size=10,
    )
    assert [d.purchase_price for d in by_price] == [300, 200, 100]

    by_barcode, _ = await dress_service.list_dresses(
        sort_by=DressSortField.BARCODE,
        sort_dir="asc",
        page_size=10,
    )
    assert [d.barcode for d in by_barcode] == [
        "DR-00003001",
        "DR-00003002",
        "DR-00003003",
    ]

    with pytest.raises(ValidationError):
        await dress_service.list_dresses(page=0)
    with pytest.raises(ValidationError):
        await dress_service.list_dresses(page_size=201)


@pytest.mark.asyncio
async def test_sort_by_category(
    dress_service: DressService,
    category_service: CategoryService,
) -> None:
    cat_a = await category_service.create_category(name_ar="ألف")
    cat_b = await category_service.create_category(name_ar="باء")
    await _create(dress_service, cat_b.id, name_ar="واحد", barcode="DR-00004001")
    await _create(dress_service, cat_a.id, name_ar="اثنان", barcode="DR-00004002")
    items, total = await dress_service.list_dresses(
        sort_by=DressSortField.CATEGORY,
        sort_dir="asc",
    )
    assert total == 2
    assert items[0].category_id == cat_a.id
    assert items[1].category_id == cat_b.id


@pytest.mark.asyncio
async def test_build_search_stmt_composable(
    dress_service: DressService,
    sample_category,
    db_session: AsyncSession,
) -> None:
    await _create(dress_service, sample_category.id, barcode="DR-00005001", brand="Zed")
    repo = DressRepository(db_session)
    stmt, _ = repo.build_search_stmt(brand="Zed", status="AVAILABLE")
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": False}))
    assert "dresses" in compiled.lower()
    # Ensure filters compose without exploding into N queries — single statement.
    assert "WHERE" in compiled.upper() or "where" in compiled


@pytest.mark.asyncio
async def test_search_api_meta(
    admin_client: AsyncClient,
    dress_service: DressService,
    sample_category,
) -> None:
    for i in range(3):
        await _create(
            dress_service,
            sample_category.id,
            name_ar=f"فستان {i}",
            barcode=f"DR-0000600{i}",
        )

    response = await admin_client.get(
        "/api/v1/dresses",
        params={"page": 1, "page_size": 2, "sort_by": "barcode", "sort_dir": "asc"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["meta"]["page"] == 1
    assert body["meta"]["page_size"] == 2
    assert body["meta"]["total"] == 3
    assert body["meta"]["pages"] == 2
    assert len(body["data"]) == 2

    filtered = await admin_client.get(
        "/api/v1/dresses",
        params={"q": "فستان 1", "is_active": True},
    )
    assert filtered.status_code == 200
    assert filtered.json()["meta"]["total"] >= 1

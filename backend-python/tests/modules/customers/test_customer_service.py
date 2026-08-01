"""CustomerService tests (v2)."""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.customers.services.customer import CustomerService
from app.utils.datetime import utc_now


@pytest.mark.asyncio
async def test_create_list_update_activate_deactivate_delete(
    customer_service: CustomerService,
) -> None:
    created = await customer_service.create_customer(
        full_name="أحمد علي",
        phone="+9647701112233",
        alternative_phone="+9647700001111",
        address="بغداد",
        national_id="12345678",
        notes="عميل دائم",
        gender="MALE",
        birth_date=date(1990, 5, 1),
        actor_username="admin",
    )
    assert created.full_name == "أحمد علي"
    assert created.customer_number == "CUS-00000001"
    assert created.gender == "MALE"
    assert created.is_active is True
    assert "CUS-00000001" in repr(created)

    second = await customer_service.create_customer(
        full_name="زينب محمد",
        phone="+9647709998877",
        national_id="87654321",
    )
    assert second.customer_number == "CUS-00000002"

    items, total = await customer_service.list_customers()
    assert total == 2
    assert items[0].full_name == "أحمد علي"

    by_name, n = await customer_service.list_customers(q="زينب")
    assert n == 1
    by_phone, p = await customer_service.list_customers(q="770111")
    assert p == 1
    by_nid, nid_total = await customer_service.list_customers(q="8765")
    assert nid_total == 1
    by_number, num_total = await customer_service.list_customers(q="CUS-00000001")
    assert num_total == 1

    looked_up = await customer_service.get_customer_by_number("CUS-00000001")
    assert looked_up.id == created.id

    sorted_items, _ = await customer_service.list_customers(
        sort_by="customer_number",
        sort_dir="desc",
    )
    assert sorted_items[0].customer_number == "CUS-00000002"

    updated = await customer_service.update_customer(
        created.id,
        address="أربيل",
        notes="  ",
        alternative_phone="  ",
        gender="FEMALE",
        clear_birth_date=True,
        actor_username="admin",
    )
    assert updated.address == "أربيل"
    assert updated.notes is None
    assert updated.alternative_phone is None
    assert updated.gender == "FEMALE"
    assert updated.birth_date is None
    assert updated.customer_number == "CUS-00000001"

    deactivated = await customer_service.deactivate(created.id, actor_username="admin")
    assert deactivated.is_active is False
    _, only_active = await customer_service.list_customers(active_only=True)
    assert only_active == 1

    activated = await customer_service.activate(created.id, actor_username="admin")
    assert activated.is_active is True

    await customer_service.soft_delete(created.id, actor_username="admin")
    with pytest.raises(NotFoundError):
        await customer_service.get_customer(created.id)
    with pytest.raises(NotFoundError):
        await customer_service.get_customer_by_number("CUS-00000001")

    # Soft-deleted number is not reused.
    third = await customer_service.create_customer(
        full_name="ثالث",
        phone="+9647703332211",
    )
    assert third.customer_number == "CUS-00000003"

    audit = AuditService(customer_service.session)
    logs, log_total = await audit.list_logs(
        module="customers",
        entity_id=str(created.id),
    )
    assert log_total >= 5
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.UPDATE.value in actions
    assert AuditAction.ACTIVATE.value in actions
    assert AuditAction.DEACTIVATE.value in actions
    assert AuditAction.SOFT_DELETE.value in actions


@pytest.mark.asyncio
async def test_duplicate_phones_allowed(customer_service: CustomerService) -> None:
    phone = "+9647705554433"
    a = await customer_service.create_customer(full_name="أ", phone=phone)
    b = await customer_service.create_customer(full_name="ب", phone=phone)
    assert a.id != b.id
    assert a.phone == b.phone
    assert a.customer_number != b.customer_number


@pytest.mark.asyncio
async def test_validation_errors(customer_service: CustomerService) -> None:
    with pytest.raises(ValidationError):
        await customer_service.create_customer(full_name="  ", phone="+9647701112233")
    with pytest.raises(ValidationError):
        await customer_service.create_customer(full_name="اسم", phone="bad")
    with pytest.raises(ValidationError):
        await customer_service.create_customer(full_name="اسم", phone="   ")
    with pytest.raises(ValidationError):
        await customer_service.create_customer(
            full_name="اسم",
            phone="+9647701112233",
            national_id="ABC",
        )
    with pytest.raises(ValidationError):
        await customer_service.create_customer(
            full_name="اسم",
            phone="+9647701112233",
            gender="UNKNOWN",
        )
    with pytest.raises(ValidationError):
        await customer_service.create_customer(
            full_name="اسم",
            phone="+9647701112233",
            birth_date=utc_now().date() + timedelta(days=1),
        )


@pytest.mark.asyncio
async def test_sort_validation(customer_service: CustomerService) -> None:
    with pytest.raises(ValidationError):
        await customer_service.list_customers(sort_by="nope")
    with pytest.raises(ValidationError):
        await customer_service.list_customers(sort_dir="sideways")


@pytest.mark.asyncio
async def test_get_missing(customer_service: CustomerService) -> None:
    with pytest.raises(NotFoundError):
        await customer_service.get_customer(uuid4())
    with pytest.raises(NotFoundError):
        await customer_service.get_customer_by_number("CUS-99999999")


@pytest.mark.asyncio
async def test_update_phone_and_name(customer_service: CustomerService) -> None:
    customer = await customer_service.create_customer(
        full_name="قديم",
        phone="+9647701112233",
    )
    updated = await customer_service.update_customer(
        customer.id,
        full_name="جديد",
        phone="+9647702223344",
        national_id="11223344",
        birth_date=date(2000, 1, 1),
        is_active=False,
    )
    assert updated.full_name == "جديد"
    assert updated.phone == "+9647702223344"
    assert updated.national_id == "11223344"
    assert updated.birth_date == date(2000, 1, 1)
    assert updated.is_active is False


@pytest.mark.asyncio
async def test_optional_phone_and_empty_number_lookup(
    customer_service: CustomerService,
) -> None:
    with pytest.raises(ValidationError):
        await customer_service.create_customer(
            full_name="اسم",
            phone="+9647701112233",
            alternative_phone="not-a-phone",
        )
    with pytest.raises(ValidationError):
        await customer_service.get_customer_by_number("   ")

"""Calendar API tests."""

from uuid import uuid4

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.calendar.conftest import utc


@pytest.mark.asyncio
async def test_calendar_api_flow(
    admin_client: AsyncClient,
    sample_dress,
) -> None:
    created = await admin_client.post(
        "/api/v1/calendar/block",
        json={
            "dress_id": str(sample_dress.id),
            "block_type": "RESERVATION",
            "start_at": utc(2026, 8, 10, 10).isoformat(),
            "end_at": utc(2026, 8, 10, 14).isoformat(),
            "notes": "حجز",
        },
    )
    assert created.status_code == 201, created.text
    block_id = created.json()["data"]["id"]

    timeline = await admin_client.get(f"/api/v1/calendar/dress/{sample_dress.id}")
    assert timeline.status_code == 200
    assert len(timeline.json()["data"]) == 1

    windowed = await admin_client.get(
        f"/api/v1/calendar/dress/{sample_dress.id}",
        params={
            "from": utc(2026, 8, 10, 9).isoformat(),
            "to": utc(2026, 8, 10, 15).isoformat(),
        },
    )
    assert windowed.status_code == 200
    assert len(windowed.json()["data"]) == 1

    avail = await admin_client.get(
        f"/api/v1/calendar/dress/{sample_dress.id}/availability",
        params={
            "start_at": utc(2026, 8, 10, 15).isoformat(),
            "end_at": utc(2026, 8, 10, 16).isoformat(),
        },
    )
    assert avail.status_code == 200
    assert avail.json()["data"]["available"] is True

    busy = await admin_client.get(
        f"/api/v1/calendar/dress/{sample_dress.id}/availability",
        params={
            "start_at": utc(2026, 8, 10, 11).isoformat(),
            "end_at": utc(2026, 8, 10, 12).isoformat(),
        },
    )
    assert busy.json()["data"]["available"] is False

    conflicts = await admin_client.get(
        f"/api/v1/calendar/dress/{sample_dress.id}/conflicts",
        params={
            "start_at": utc(2026, 8, 10, 11).isoformat(),
            "end_at": utc(2026, 8, 10, 12).isoformat(),
        },
    )
    assert conflicts.status_code == 200
    assert len(conflicts.json()["data"]["conflicts"]) == 1

    nxt = await admin_client.get(
        f"/api/v1/calendar/dress/{sample_dress.id}/availability/next",
        params={
            "after": utc(2026, 8, 10, 9).isoformat(),
            "duration_seconds": 3600,
        },
    )
    assert nxt.status_code == 200
    assert nxt.json()["data"]["next_available_start"] is not None

    patched = await admin_client.patch(
        f"/api/v1/calendar/block/{block_id}",
        json={
            "start_at": utc(2026, 8, 11, 10).isoformat(),
            "end_at": utc(2026, 8, 11, 14).isoformat(),
            "block_type": "rental",
            "notes": "  محدّث  ",
        },
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["block_type"] == "RENTAL"
    assert patched.json()["data"]["notes"] == "محدّث"

    cleared = await admin_client.patch(
        f"/api/v1/calendar/block/{block_id}",
        json={"clear_notes": True},
    )
    assert cleared.status_code == 200
    assert cleared.json()["data"]["notes"] is None

    deleted = await admin_client.delete(f"/api/v1/calendar/block/{block_id}")
    assert deleted.status_code == 200
    empty = await admin_client.get(f"/api/v1/calendar/dress/{sample_dress.id}")
    assert empty.json()["data"] == []


@pytest.mark.asyncio
async def test_calendar_authz(
    api_client: AsyncClient,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get(f"/api/v1/calendar/dress/{sample_dress.id}")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="cal_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    # Laundry has no calendar.view / manage
    listed = await api_client.get(
        f"/api/v1/calendar/dress/{sample_dress.id}",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 403

    create = await api_client.post(
        "/api/v1/calendar/block",
        headers=bearer_headers(pair.access_token),
        json={
            "dress_id": str(sample_dress.id),
            "block_type": "RENTAL",
            "start_at": utc(2026, 8, 20).isoformat(),
            "end_at": utc(2026, 8, 21).isoformat(),
        },
    )
    assert create.status_code == 403


@pytest.mark.asyncio
async def test_create_overlap_via_api(
    admin_client: AsyncClient,
    sample_dress,
) -> None:
    first = await admin_client.post(
        "/api/v1/calendar/block",
        json={
            "dress_id": str(sample_dress.id),
            "block_type": "RENTAL",
            "start_at": utc(2026, 8, 15, 10).isoformat(),
            "end_at": utc(2026, 8, 15, 18).isoformat(),
        },
    )
    assert first.status_code == 201
    second = await admin_client.post(
        "/api/v1/calendar/block",
        json={
            "dress_id": str(uuid4()),
            "block_type": "RENTAL",
            "start_at": utc(2026, 8, 15, 12).isoformat(),
            "end_at": utc(2026, 8, 15, 13).isoformat(),
        },
    )
    # Missing dress → 404
    assert second.status_code == 404

    overlap = await admin_client.post(
        "/api/v1/calendar/block",
        json={
            "dress_id": str(sample_dress.id),
            "block_type": "RESERVATION",
            "start_at": utc(2026, 8, 15, 12).isoformat(),
            "end_at": utc(2026, 8, 15, 13).isoformat(),
        },
    )
    assert overlap.status_code == 409

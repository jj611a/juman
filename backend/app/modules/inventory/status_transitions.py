"""Dress status transition graph (Phase 4 Status Engine + Inspection).

Source of truth for operational transitions. ``RETURNED`` remains in
``DressStatus`` for schema continuity but is excluded from this graph.
``RUINED_PENDING_SALE`` is set by Inspection; Sales completes to ``SOLD``/``RUINED``.
"""

from __future__ import annotations

from app.modules.inventory.constants import DressStatus

ALLOWED_TRANSITIONS: dict[DressStatus, frozenset[DressStatus]] = {
    DressStatus.AVAILABLE: frozenset(
        {
            DressStatus.RESERVED,
            DressStatus.RENTED,
            DressStatus.SOLD,
        }
    ),
    DressStatus.RESERVED: frozenset(
        {
            DressStatus.AVAILABLE,
            DressStatus.RENTED,
        }
    ),
    DressStatus.RENTED: frozenset({DressStatus.INSPECTION}),
    DressStatus.INSPECTION: frozenset(
        {
            DressStatus.PROCESSING,
            DressStatus.AVAILABLE,
            DressStatus.RUINED_PENDING_SALE,
        }
    ),
    DressStatus.PROCESSING: frozenset({DressStatus.AVAILABLE}),
    DressStatus.RUINED_PENDING_SALE: frozenset(
        {
            DressStatus.SOLD,
            DressStatus.RUINED,
        }
    ),
    DressStatus.SOLD: frozenset(),
    DressStatus.RUINED: frozenset(),
    # Not in Phase 4 graph — any transition involving RETURNED is rejected.
    DressStatus.RETURNED: frozenset(),
}

TERMINAL_STATUSES: frozenset[DressStatus] = frozenset(
    {DressStatus.SOLD, DressStatus.RUINED}
)

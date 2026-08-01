"""Drop rentals.remaining_balance; rename FIXED → FIXED_AMOUNT.

Revision ID: 20260728_0022_rentals_align
Revises: 20260727_0021_rentals
Create Date: 2026-07-28 00:40:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_0022_rentals_align"
down_revision: str | None = "20260727_0021_rentals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("rentals", "remaining_balance")
    op.execute(
        sa.text(
            "UPDATE rentals SET initial_payment_type = 'FIXED_AMOUNT' "
            "WHERE initial_payment_type = 'FIXED'"
        )
    )


def downgrade() -> None:
    op.add_column(
        "rentals",
        sa.Column("remaining_balance", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.execute(
        sa.text(
            "UPDATE rentals SET remaining_balance = estimated_total - initial_payment_value"
        )
    )
    op.alter_column("rentals", "remaining_balance", server_default=None)
    op.execute(
        sa.text(
            "UPDATE rentals SET initial_payment_type = 'FIXED' "
            "WHERE initial_payment_type = 'FIXED_AMOUNT'"
        )
    )

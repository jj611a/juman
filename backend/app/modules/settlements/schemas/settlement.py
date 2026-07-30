"""Settlement request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.settlements.constants import PaymentMethod
from app.modules.settlements.models.adjustment import RentalSettlementAdjustment
from app.modules.settlements.models.charge import RentalSettlementCharge
from app.modules.settlements.models.payment import RentalSettlementPayment
from app.modules.settlements.models.settlement import RentalSettlement
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class SettlementCreateRequest(APIModel):
    """Create a settlement for a RETURN_PENDING rental after inspection."""

    rental_id: UUID
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class SettlementPaymentRequest(APIModel):
    """Record a payment against an open settlement."""

    amount: int = Field(gt=0)
    payment_method: PaymentMethod
    reference_number: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)
    received_at: datetime | None = None

    @field_validator("reference_number", "notes", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class SettlementAdjustmentRequest(APIModel):
    """Record a signed manual adjustment."""

    amount: int
    reason: str = Field(min_length=3, max_length=500)

    @field_validator("reason", mode="before")
    @classmethod
    def _strip_reason(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("amount")
    @classmethod
    def _nonzero_amount(cls, value: int) -> int:
        if value == 0:
            raise ValueError("مبلغ التعديل يجب ألا يكون صفراً")
        return value


class SettlementChargeResponse(APIModel):
    id: UUID
    settlement_id: UUID
    charge_type: str
    amount: int
    rental_item_id: UUID | None = None
    inspection_item_id: UUID | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, charge: RentalSettlementCharge) -> SettlementChargeResponse:
        return cls(
            id=charge.id,
            settlement_id=charge.settlement_id,
            charge_type=charge.charge_type,
            amount=charge.amount,
            rental_item_id=charge.rental_item_id,
            inspection_item_id=charge.inspection_item_id,
            description=charge.description,
            created_at=ensure_utc(charge.created_at),
            updated_at=ensure_utc(charge.updated_at),
        )


class SettlementPaymentResponse(APIModel):
    id: UUID
    settlement_id: UUID
    amount: int
    payment_method: str
    received_at: datetime
    received_by: UUID | None = None
    reference_number: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, payment: RentalSettlementPayment) -> SettlementPaymentResponse:
        return cls(
            id=payment.id,
            settlement_id=payment.settlement_id,
            amount=payment.amount,
            payment_method=payment.payment_method,
            received_at=ensure_utc(payment.received_at),
            received_by=payment.received_by,
            reference_number=payment.reference_number,
            notes=payment.notes,
            created_at=ensure_utc(payment.created_at),
            updated_at=ensure_utc(payment.updated_at),
        )


class SettlementAdjustmentResponse(APIModel):
    id: UUID
    settlement_id: UUID
    amount: int
    reason: str
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None

    @classmethod
    def from_model(
        cls,
        adjustment: RentalSettlementAdjustment,
    ) -> SettlementAdjustmentResponse:
        return cls(
            id=adjustment.id,
            settlement_id=adjustment.settlement_id,
            amount=adjustment.amount,
            reason=adjustment.reason,
            created_at=ensure_utc(adjustment.created_at),
            updated_at=ensure_utc(adjustment.updated_at),
            created_by=adjustment.created_by,
        )


class SettlementResponse(APIModel):
    id: UUID
    settlement_number: str
    rental_id: UUID
    return_id: UUID
    status: str
    rental_charge_amount: int
    initial_payment_credit: int
    late_penalty_amount: int
    minor_damage_penalty_amount: int
    manual_adjustment_amount: int
    gross_total: int
    total_due: int
    total_paid: int
    remaining_balance: int
    settled_at: datetime | None = None
    settled_by: UUID | None = None
    notes: str | None = None
    charges: list[SettlementChargeResponse]
    payments: list[SettlementPaymentResponse]
    adjustments: list[SettlementAdjustmentResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, record: RentalSettlement) -> SettlementResponse:
        charges = sorted(record.charges or [], key=lambda c: c.created_at)
        payments = sorted(record.payments or [], key=lambda p: p.created_at)
        adjustments = sorted(record.adjustments or [], key=lambda a: a.created_at)
        return cls(
            id=record.id,
            settlement_number=record.settlement_number,
            rental_id=record.rental_id,
            return_id=record.return_id,
            status=record.status,
            rental_charge_amount=record.rental_charge_amount,
            initial_payment_credit=record.initial_payment_credit,
            late_penalty_amount=record.late_penalty_amount,
            minor_damage_penalty_amount=record.minor_damage_penalty_amount,
            manual_adjustment_amount=record.manual_adjustment_amount,
            gross_total=record.gross_total,
            total_due=record.total_due,
            total_paid=record.total_paid,
            remaining_balance=record.remaining_balance,
            settled_at=ensure_utc(record.settled_at) if record.settled_at else None,
            settled_by=record.settled_by,
            notes=record.notes,
            charges=[SettlementChargeResponse.from_model(c) for c in charges],
            payments=[SettlementPaymentResponse.from_model(p) for p in payments],
            adjustments=[SettlementAdjustmentResponse.from_model(a) for a in adjustments],
            created_at=ensure_utc(record.created_at),
            updated_at=ensure_utc(record.updated_at),
        )


class SettlementListResponse(APIModel):
    success: bool = True
    data: list[SettlementResponse]
    meta: PaginationMeta


class SettlementItemEnvelope(APIModel):
    success: bool = True
    data: SettlementResponse

"""DressStatusService — sole authority for dress status transitions."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.inventory.status_transitions import ALLOWED_TRANSITIONS
from app.modules.inventory.validators import validate_status
from app.services.base import BaseService
from app.utils.datetime import utc_now


@dataclass(frozen=True, slots=True)
class StatusChangeResult:
    """Result of an accepted status transition."""

    dress_id: UUID
    previous_status: str
    new_status: str
    allowed_transitions: list[str]
    reason: str | None = None


class DressStatusService(BaseService):
    """Enforce the Phase 4 dress status state machine.

    Future modules (reservations, rentals, etc.) must call this service.
    They must never write ``Dress.status`` directly.
    """

    def __init__(
        self,
        session: AsyncSession,
        *,
        dresses: DressRepository | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.dresses = dresses or DressRepository(session)
        self.audit = audit or AuditService(session)

    async def _require_dress(self, dress_id: UUID):
        dress = await self.dresses.get_by_id(dress_id)
        if dress is None:
            raise NotFoundError("الفستان غير موجود")
        return dress

    def _as_status(self, value: str | DressStatus) -> DressStatus:
        if isinstance(value, DressStatus):
            return value
        return DressStatus(validate_status(value))

    def get_allowed_transitions_for_status(
        self,
        status: str | DressStatus,
    ) -> list[str]:
        """Return allowed target status codes for a status value."""
        current = self._as_status(status)
        return sorted(s.value for s in ALLOWED_TRANSITIONS.get(current, frozenset()))

    def validate_transition(
        self,
        from_status: str | DressStatus,
        to_status: str | DressStatus,
    ) -> tuple[DressStatus, DressStatus]:
        """Validate a transition; return normalized (from, to) or raise."""
        current = self._as_status(from_status)
        target = self._as_status(to_status)

        if current == DressStatus.RETURNED or target == DressStatus.RETURNED:
            raise ValidationError(
                "حالة RETURNED غير مدعومة في محرك الحالة الحالي",
                details={
                    "field": "new_status",
                    "from": current.value,
                    "to": target.value,
                },
            )

        if current == target:
            raise ValidationError(
                "الحالة الجديدة مطابقة للحالة الحالية",
                details={
                    "field": "new_status",
                    "from": current.value,
                    "to": target.value,
                },
            )

        allowed = ALLOWED_TRANSITIONS.get(current, frozenset())
        if target not in allowed:
            raise ValidationError(
                "انتقال الحالة غير مسموح",
                details={
                    "field": "new_status",
                    "from": current.value,
                    "to": target.value,
                    "allowed": sorted(s.value for s in allowed),
                },
            )
        return current, target

    async def get_current_status(self, dress_id: UUID) -> str:
        """Return the live dress status code."""
        dress = await self._require_dress(dress_id)
        return dress.status

    async def get_allowed_transitions(self, dress_id: UUID) -> list[str]:
        """Return allowed next statuses for a live dress."""
        dress = await self._require_dress(dress_id)
        return self.get_allowed_transitions_for_status(dress.status)

    async def change_status(
        self,
        dress_id: UUID,
        new_status: str | DressStatus,
        *,
        reason: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> StatusChangeResult:
        """Apply an allowed status transition and record audit."""
        dress = await self._require_dress(dress_id)
        previous = self._as_status(dress.status)
        _, target = self.validate_transition(previous, new_status)

        reason_value: str | None = None
        if reason is not None:
            stripped = reason.strip()
            reason_value = stripped or None
            if reason_value is not None and len(reason_value) > 500:
                raise ValidationError(
                    "سبب التغيير أطول من الحد المسموح",
                    details={"field": "reason"},
                )

        dress = await self.dresses.update_fields(
            dress,
            status=target.value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        allowed = self.get_allowed_transitions_for_status(dress.status)
        await self.audit.record(
            module="inventory",
            entity_type="Dress",
            entity_id=dress.id,
            action=AuditAction.STATUS_CHANGED,
            old_values={"status": previous.value},
            new_values={"status": target.value},
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            metadata={"reason": reason_value} if reason_value else None,
        )
        return StatusChangeResult(
            dress_id=dress.id,
            previous_status=previous.value,
            new_status=target.value,
            allowed_transitions=allowed,
            reason=reason_value,
        )

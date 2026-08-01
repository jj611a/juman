"""Maintenance task protocol and result types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class MaintenanceResult:
    """Outcome of a maintenance dry-run or execute call."""

    task_id: str
    success: bool
    message: str
    details: dict[str, Any] = field(default_factory=dict)
    objects_checked: int = 0
    objects_modified: int = 0
    warnings: list[str] = field(default_factory=list)


class MaintenanceTask(Protocol):
    """Contract for maintenance tasks."""

    @property
    def id(self) -> str: ...

    @property
    def title(self) -> str: ...

    @property
    def description(self) -> str: ...

    @property
    def phase(self) -> str: ...

    @property
    def category(self) -> str: ...

    @property
    def requires_confirmation(self) -> bool: ...

    async def dry_run(self) -> MaintenanceResult: ...

    async def execute(self) -> MaintenanceResult: ...


class BaseMaintenanceTask:
    """Shared metadata helper for concrete tasks."""

    def __init__(
        self,
        *,
        task_id: str,
        title: str,
        description: str,
        category: str,
        requires_confirmation: bool,
        phase: str = "current",
    ) -> None:
        self._id = task_id
        self._title = title
        self._description = description
        self._category = category
        self._requires_confirmation = requires_confirmation
        self._phase = phase

    @property
    def id(self) -> str:
        return self._id

    @property
    def title(self) -> str:
        return self._title

    @property
    def description(self) -> str:
        return self._description

    @property
    def phase(self) -> str:
        return self._phase

    @property
    def category(self) -> str:
        return self._category

    @property
    def requires_confirmation(self) -> bool:
        return self._requires_confirmation

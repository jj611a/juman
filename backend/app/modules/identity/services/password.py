"""PasswordService — password policy, history, change, and admin reset."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AppException, AuthenticationError, NotFoundError, ValidationError
from app.modules.identity.constants import (
    DEFAULT_PASSWORD_EXPIRE_DAYS,
    DEFAULT_PASSWORD_HISTORY_COUNT,
    DEFAULT_PASSWORD_MAX_LENGTH,
    DEFAULT_PASSWORD_MIN_LENGTH,
    DEFAULT_PASSWORD_REQUIRE_COMPLEXITY,
)
from app.modules.identity.models.password_history import PasswordHistory
from app.modules.identity.models.user import User
from app.modules.identity.repositories.password_history import PasswordHistoryRepository
from app.modules.identity.repositories.user import UserRepository
from app.modules.identity.services.login_history import LoginHistoryService
from app.modules.identity.services.session import SessionService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.security.password import hash_password, verify_password
from app.utils.datetime import ensure_utc, utc_now


@dataclass(frozen=True, slots=True)
class PasswordPolicy:
    """Password strength, history, and expiry policy from Settings."""

    min_length: int
    require_complexity: bool
    history_count: int
    expire_days: int
    max_length: int = DEFAULT_PASSWORD_MAX_LENGTH


class PasswordService:
    """Central password lifecycle operations."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        users: UserRepository | None = None,
        history: PasswordHistoryRepository | None = None,
        settings: SettingService | None = None,
        sessions: SessionService | None = None,
        login_history: LoginHistoryService | None = None,
    ) -> None:
        self.session = session
        self.users = users or UserRepository(session)
        self.history = history or PasswordHistoryRepository(session)
        self.settings = settings or SettingService(session)
        self.sessions = sessions or SessionService(session, settings=self.settings)
        self.login_history = login_history or LoginHistoryService(session)

    async def load_policy(self) -> PasswordPolicy:
        """Read password policy settings with safe defaults."""
        return PasswordPolicy(
            min_length=max(
                8,
                await self._setting_int(
                    SettingKey.PASSWORD_MIN_LENGTH.value,
                    DEFAULT_PASSWORD_MIN_LENGTH,
                ),
            ),
            require_complexity=await self._setting_bool(
                SettingKey.PASSWORD_REQUIRE_COMPLEXITY.value,
                DEFAULT_PASSWORD_REQUIRE_COMPLEXITY,
            ),
            history_count=max(
                0,
                await self._setting_int(
                    SettingKey.PASSWORD_HISTORY_COUNT.value,
                    DEFAULT_PASSWORD_HISTORY_COUNT,
                ),
            ),
            expire_days=max(
                0,
                await self._setting_int(
                    SettingKey.PASSWORD_EXPIRE_DAYS.value,
                    DEFAULT_PASSWORD_EXPIRE_DAYS,
                ),
            ),
        )

    def validate_new_password(
        self,
        password: str,
        *,
        username: str,
        policy: PasswordPolicy,
    ) -> None:
        """Raise ValidationError if password fails strength rules."""
        if not password:
            raise ValidationError(
                "كلمة المرور مطلوبة",
                details={"field": "password"},
            )
        if len(password) < policy.min_length:
            raise ValidationError(
                "كلمة المرور قصيرة جداً",
                details={"field": "password", "min_length": policy.min_length},
            )
        if len(password) > policy.max_length:
            raise ValidationError(
                "كلمة المرور طويلة جداً",
                details={"field": "password", "max_length": policy.max_length},
            )
        if username and username.lower() in password.lower():
            raise ValidationError(
                "كلمة المرور لا يجوز أن تحتوي على اسم المستخدم",
                details={"field": "password", "reason": "contains_username"},
            )
        if policy.require_complexity and not self._meets_complexity(password):
            raise ValidationError(
                "كلمة المرور يجب أن تحتوي على ثلاثة أنواع على الأقل من: أحرف كبيرة وصغيرة وأرقام ورموز",
                details={"field": "password", "reason": "complexity"},
            )

    async def assert_not_reused(self, user: User, password: str, *, policy: PasswordPolicy) -> None:
        """Reject password if it matches current or recent history hashes."""
        if verify_password(user.password_hash, password):
            raise ValidationError(
                "لا يمكن إعادة استخدام كلمة المرور الحالية أو السابقة",
                details={"field": "password", "reason": "reuse"},
            )
        if policy.history_count <= 0:
            return
        rows = await self.history.list_for_user(user.id, limit=policy.history_count)
        for row in rows:
            if verify_password(row.password_hash, password):
                raise ValidationError(
                    "لا يمكن إعادة استخدام كلمة المرور الحالية أو السابقة",
                    details={"field": "password", "reason": "reuse"},
                )

    async def record_history(self, user_id: UUID, password_hash: str) -> PasswordHistory:
        """Append a history row and prune beyond policy depth."""
        policy = await self.load_policy()
        row = await self.history.add(
            PasswordHistory(
                user_id=user_id,
                password_hash=password_hash,
                created_at=utc_now(),
            )
        )
        # Keep current + history_count prior? Plan: prune beyond history_count.
        # After change we store the OLD hash; depth N means last N hashes.
        await self.history.prune_for_user(user_id, keep=max(1, policy.history_count))
        return row

    def is_password_expired(self, user: User, policy: PasswordPolicy) -> bool:
        """Return True when expire_days > 0 and password_changed_at is too old."""
        if policy.expire_days <= 0:
            return False
        if user.password_changed_at is None:
            return True
        deadline = ensure_utc(user.password_changed_at) + timedelta(days=policy.expire_days)
        return deadline <= utc_now()

    async def requires_password_change(self, user: User) -> bool:
        """True when must_change_password is set or password is expired."""
        if user.must_change_password:
            return True
        policy = await self.load_policy()
        return self.is_password_expired(user, policy)

    async def change_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
        *,
        current_session_id: UUID,
    ) -> User:
        """Self-service password change; keeps the current session."""
        if not verify_password(user.password_hash, current_password):
            raise AuthenticationError(
                "كلمة المرور الحالية غير صحيحة",
                details={"field": "current_password"},
            )
        policy = await self.load_policy()
        self.validate_new_password(new_password, username=user.username, policy=policy)
        await self.assert_not_reused(user, new_password, policy=policy)

        old_hash = user.password_hash
        await self.record_history(user.id, old_hash)

        now = utc_now()
        user = await self.users.update_fields(
            user,
            password_hash=hash_password(new_password),
            must_change_password=False,
            password_changed_at=now,
            failed_login_attempts=0,
            updated_at=now,
            updated_by=user.id,
        )
        await self.sessions.logout_all_except(
            user.id,
            keep_session_id=current_session_id,
            actor_id=user.id,
        )
        return user

    async def admin_reset_password(
        self,
        user_id: UUID,
        new_password: str,
        *,
        actor_id: UUID | None = None,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> User:
        """Admin reset: force change, revoke all sessions, record login history."""
        user = await self.users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("المستخدم غير موجود", details={"user_id": str(user_id)})

        policy = await self.load_policy()
        self.validate_new_password(new_password, username=user.username, policy=policy)
        await self.assert_not_reused(user, new_password, policy=policy)

        old_hash = user.password_hash
        await self.record_history(user.id, old_hash)

        now = utc_now()
        user = await self.users.update_fields(
            user,
            password_hash=hash_password(new_password),
            must_change_password=True,
            password_changed_at=now,
            failed_login_attempts=0,
            is_locked=False,
            locked_until=None,
            updated_by=actor_id,
            updated_at=now,
        )
        await self.sessions.logout_all(user.id, actor_id=actor_id or user.id)
        await self.login_history.record_password_reset(
            username_attempted=user.username,
            user_id=user.id,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )
        return user

    @staticmethod
    def _meets_complexity(password: str) -> bool:
        classes = 0
        if re.search(r"[A-Z]", password):
            classes += 1
        if re.search(r"[a-z]", password):
            classes += 1
        if re.search(r"[0-9]", password):
            classes += 1
        if re.search(r"[^A-Za-z0-9]", password):
            classes += 1
        return classes >= 3

    async def _setting_int(self, key: str, default: int) -> int:
        try:
            return await self.settings.get_int(key)
        except AppException:
            return default

    async def _setting_bool(self, key: str, default: bool) -> bool:
        try:
            return await self.settings.get_bool(key)
        except AppException:
            return default

"""AuthenticationService — password verification and lockout engine (no tokens)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AppException
from app.modules.identity.constants import (
    DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES,
    DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
    DEFAULT_PASSWORD_HISTORY_COUNT,
    DEFAULT_PASSWORD_MIN_LENGTH,
    DEFAULT_PASSWORD_REQUIRE_COMPLEXITY,
    AuthenticationFailureReason,
)
from app.modules.identity.models.user import User
from app.modules.identity.repositories.user import UserRepository
from app.modules.identity.schemas.auth_result import AuthenticationResult
from app.modules.identity.services.login_history import LoginHistoryService
from app.modules.identity.validators import normalize_username
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.security.password import verify_password as argon2_verify
from app.utils.datetime import ensure_utc, utc_now


@dataclass(frozen=True, slots=True)
class SecurityPolicy:
    """Lockout and password policy loaded from Settings."""

    max_failed_login_attempts: int
    account_lock_duration_minutes: int
    password_min_length: int
    password_require_complexity: bool
    password_history_count: int


class AuthenticationService:
    """
    Authenticate staff users against stored Argon2 hashes.

    Records failed attempts / lock events to LoginHistory. Successful login
    with session_id is recorded by SessionService.create_session.
    """

    def __init__(
        self,
        session: AsyncSession,
        *,
        user_repository: UserRepository | None = None,
        settings: SettingService | None = None,
        login_history: LoginHistoryService | None = None,
    ) -> None:
        self.session = session
        self.users = user_repository or UserRepository(session)
        self.settings = settings or SettingService(session)
        self.login_history = login_history or LoginHistoryService(session)

    async def load_security_policy(self) -> SecurityPolicy:
        """Read lockout and password policy settings (with safe defaults)."""
        return SecurityPolicy(
            max_failed_login_attempts=await self._setting_int(
                SettingKey.MAX_FAILED_LOGIN_ATTEMPTS.value,
                DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
            ),
            account_lock_duration_minutes=await self._setting_int(
                SettingKey.ACCOUNT_LOCK_DURATION_MINUTES.value,
                DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES,
            ),
            password_min_length=await self._setting_int(
                SettingKey.PASSWORD_MIN_LENGTH.value,
                DEFAULT_PASSWORD_MIN_LENGTH,
            ),
            password_require_complexity=await self._setting_bool(
                SettingKey.PASSWORD_REQUIRE_COMPLEXITY.value,
                DEFAULT_PASSWORD_REQUIRE_COMPLEXITY,
            ),
            password_history_count=await self._setting_int(
                SettingKey.PASSWORD_HISTORY_COUNT.value,
                DEFAULT_PASSWORD_HISTORY_COUNT,
            ),
        )

    async def authenticate(
        self,
        username: str,
        password: str,
        *,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> AuthenticationResult:
        """
        Authenticate by username + password.

        Returns ``AuthenticationResult`` with success flag, optional failure
        reason, and the user on success (never tokens). Failures and locks
        are written to login history.
        """
        normalized = normalize_username(username)
        meta = {
            "ip_address": ip_address,
            "device_name": device_name,
            "user_agent": user_agent,
        }
        user = await self.users.get_by_username(normalized, include_deleted=True)
        if user is None:
            await self.login_history.record_login_failure(
                username_attempted=normalized,
                failure_reason=AuthenticationFailureReason.USER_NOT_FOUND,
                **meta,
            )
            return AuthenticationResult.fail(AuthenticationFailureReason.USER_NOT_FOUND)
        if user.is_deleted:
            await self.login_history.record_login_failure(
                username_attempted=normalized,
                failure_reason=AuthenticationFailureReason.DELETED,
                user_id=user.id,
                **meta,
            )
            return AuthenticationResult.fail(
                AuthenticationFailureReason.DELETED,
                user=user,
            )
        if not user.is_active:
            await self.login_history.record_login_failure(
                username_attempted=normalized,
                failure_reason=AuthenticationFailureReason.INACTIVE,
                user_id=user.id,
                **meta,
            )
            return AuthenticationResult.fail(
                AuthenticationFailureReason.INACTIVE,
                user=user,
            )

        if await self._is_currently_locked(user):
            await self.login_history.record_login_failure(
                username_attempted=normalized,
                failure_reason=AuthenticationFailureReason.LOCKED,
                user_id=user.id,
                **meta,
            )
            return AuthenticationResult.fail(
                AuthenticationFailureReason.LOCKED,
                user=user,
            )

        if not self.verify_password(user.password_hash, password):
            await self.record_failed_attempt(user)
            await self.lock_account_if_needed(
                user,
                ip_address=ip_address,
                device_name=device_name,
                user_agent=user_agent,
            )
            reason = (
                AuthenticationFailureReason.LOCKED
                if user.is_locked
                else AuthenticationFailureReason.BAD_PASSWORD
            )
            await self.login_history.record_login_failure(
                username_attempted=normalized,
                failure_reason=reason,
                user_id=user.id,
                **meta,
            )
            return AuthenticationResult.fail(reason, user=user)

        await self.reset_failed_attempts(user)
        user.last_login_at = utc_now()
        await self.session.flush()
        await self.session.refresh(user)
        return AuthenticationResult.ok(user)

    def verify_password(self, password_hash: str, password: str) -> bool:
        """Verify plaintext password against an Argon2 hash."""
        return argon2_verify(password_hash, password)

    async def record_failed_attempt(self, user: User) -> User:
        """Increment ``failed_login_attempts`` for a user."""
        user.failed_login_attempts = int(user.failed_login_attempts or 0) + 1
        user.updated_at = utc_now()
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def reset_failed_attempts(self, user: User) -> User:
        """Clear failed attempts and unlock markers after a successful login."""
        user.failed_login_attempts = 0
        user.is_locked = False
        user.locked_until = None
        user.updated_at = utc_now()
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def lock_account_if_needed(
        self,
        user: User,
        *,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> User:
        """
        Lock the account when failed attempts reach the configured maximum.

        ``account_lock_duration_minutes == 0`` means lock until an admin unlocks
        (``locked_until`` left unset). Positive values set an expiry timestamp.
        """
        policy = await self.load_security_policy()
        max_attempts = max(1, policy.max_failed_login_attempts)
        if user.failed_login_attempts < max_attempts:
            return user

        already_locked = user.is_locked
        user.is_locked = True
        duration = max(0, policy.account_lock_duration_minutes)
        if duration > 0:
            user.locked_until = utc_now() + timedelta(minutes=duration)
        else:
            user.locked_until = None
        user.updated_at = utc_now()
        await self.session.flush()
        await self.session.refresh(user)
        if not already_locked:
            await self.login_history.record_account_locked(
                username_attempted=user.username,
                user_id=user.id,
                ip_address=ip_address,
                device_name=device_name,
                user_agent=user_agent,
            )
        return user

    async def _is_currently_locked(self, user: User) -> bool:
        if not user.is_locked:
            return False
        if user.locked_until is None:
            return True
        if ensure_utc(user.locked_until) > utc_now():
            return True
        # Timed lock expired — clear and allow authentication to continue.
        user.is_locked = False
        user.locked_until = None
        user.failed_login_attempts = 0
        user.updated_at = utc_now()
        await self.session.flush()
        await self.session.refresh(user)
        return False

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

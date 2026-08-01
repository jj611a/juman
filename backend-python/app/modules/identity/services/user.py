"""User service — admin user lifecycle."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError, ConflictError, NotFoundError
from app.modules.identity.models.user import User
from app.modules.identity.repositories.user import UserRepository
from app.modules.identity.services.login_history import LoginHistoryService
from app.modules.identity.services.password import PasswordService
from app.modules.identity.services.session import SessionService
from app.modules.identity.validators import (
    validate_full_name,
    validate_optional_email,
    validate_optional_phone,
    validate_username,
)
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.repositories.role import RoleRepository
from app.security.password import hash_password
from app.utils.datetime import utc_now


class UserService:
    """Admin user lifecycle without public registration."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        user_repository: UserRepository | None = None,
        role_repository: RoleRepository | None = None,
        login_history: LoginHistoryService | None = None,
        sessions: SessionService | None = None,
        passwords: PasswordService | None = None,
    ) -> None:
        self.session = session
        self.users = user_repository or UserRepository(session)
        self.roles = role_repository or RoleRepository(session)
        self.login_history = login_history or LoginHistoryService(session)
        self._sessions = sessions
        self._passwords = passwords

    def _password_service(self) -> PasswordService:
        if self._passwords is not None:
            return self._passwords
        return PasswordService(
            self.session,
            users=self.users,
            sessions=self._sessions or SessionService(self.session),
            login_history=self.login_history,
        )

    async def create_user(
        self,
        *,
        username: str,
        password: str,
        full_name: str,
        role_id: UUID,
        phone: str | None = None,
        email: str | None = None,
        must_change_password: bool = True,
        created_by: UUID | None = None,
    ) -> User:
        """Create a user (no public registration)."""
        normalized = validate_username(username)
        name = validate_full_name(full_name)
        phone_value = validate_optional_phone(phone)
        email_value = validate_optional_email(email)

        passwords = self._password_service()
        policy = await passwords.load_policy()
        passwords.validate_new_password(password, username=normalized, policy=policy)

        existing = await self.users.get_by_username(normalized)
        if existing is not None:
            raise ConflictError(
                "اسم المستخدم مستخدم بالفعل",
                details={"username": normalized},
            )

        await self._require_active_role(role_id)

        now = utc_now()
        password_hash = hash_password(password)
        user = User(
            username=normalized,
            password_hash=password_hash,
            full_name=name,
            phone=phone_value,
            email=email_value,
            role_id=role_id,
            is_active=True,
            is_locked=False,
            must_change_password=must_change_password,
            failed_login_attempts=0,
            password_changed_at=now,
            created_by=created_by,
            updated_by=created_by,
        )
        user = await self.users.add(user)
        await passwords.record_history(user.id, password_hash)
        return user

    async def get_user(self, user_id: UUID) -> User:
        """Return an active (non-deleted) user."""
        user = await self.users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("المستخدم غير موجود", details={"user_id": str(user_id)})
        return user

    async def list_users(
        self,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[User], int]:
        """List non-deleted users."""
        items = await self.users.list(offset=offset, limit=limit)
        total = await self.users.count()
        return items, total

    async def update_user(
        self,
        user_id: UUID,
        *,
        full_name: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        role_id: UUID | None = None,
        updated_by: UUID | None = None,
    ) -> User:
        """Update mutable profile fields (username is immutable)."""
        user = await self.get_user(user_id)
        fields: dict[str, object] = {"updated_by": updated_by, "updated_at": utc_now()}
        if full_name is not None:
            fields["full_name"] = validate_full_name(full_name)
        if phone is not None:
            fields["phone"] = validate_optional_phone(phone)
        if email is not None:
            fields["email"] = validate_optional_email(email)
        if role_id is not None:
            await self._require_active_role(role_id)
            await self._assert_not_last_admin(user, new_role_id=role_id)
            fields["role_id"] = role_id
        return await self.users.update_fields(user, **fields)

    async def deactivate_user(
        self,
        user_id: UUID,
        *,
        updated_by: UUID | None = None,
    ) -> User:
        """Set is_active=false."""
        user = await self.get_user(user_id)
        await self._assert_not_last_admin(user, deactivating=True)
        return await self.users.update_fields(
            user,
            is_active=False,
            updated_by=updated_by,
            updated_at=utc_now(),
        )

    async def activate_user(
        self,
        user_id: UUID,
        *,
        updated_by: UUID | None = None,
    ) -> User:
        """Set is_active=true."""
        user = await self.get_user(user_id)
        return await self.users.update_fields(
            user,
            is_active=True,
            updated_by=updated_by,
            updated_at=utc_now(),
        )

    async def soft_delete_user(
        self,
        user_id: UUID,
        *,
        deleted_by: UUID | None = None,
    ) -> None:
        """Soft-delete a user."""
        user = await self.get_user(user_id)
        await self._assert_not_last_admin(user, deactivating=True)
        await self.users.delete(user, deleted_by=deleted_by)

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
        """Delegate to PasswordService (Phase 6)."""
        return await self._password_service().admin_reset_password(
            user_id,
            new_password,
            actor_id=actor_id,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )

    async def _require_active_role(self, role_id: UUID) -> None:
        role = await self.roles.get_by_id(role_id)
        if role is None or not role.is_active:
            raise NotFoundError("الدور غير موجود", details={"role_id": str(role_id)})

    async def _assert_not_last_admin(
        self,
        user: User,
        *,
        new_role_id: UUID | None = None,
        deactivating: bool = False,
    ) -> None:
        admin = await self.roles.get_by_name(SystemRoleName.ADMIN.value)
        if admin is None:
            return
        if user.role_id != admin.id:
            return
        if new_role_id is not None and new_role_id == admin.id and not deactivating:
            return
        if new_role_id is not None and new_role_id == admin.id:
            return
        losing_admin = deactivating or (new_role_id is not None and new_role_id != admin.id)
        if not losing_admin:
            return
        remaining = await self.users.count_active_admins(
            admin_role_id=admin.id,
            exclude_user_id=user.id,
        )
        if remaining < 1:
            raise BusinessError(
                "لا يمكن إزالة أو تعطيل آخر مسؤول نشط",
                code="last_admin_protected",
            )

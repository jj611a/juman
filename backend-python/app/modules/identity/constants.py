"""Identity constants for User domain and authentication engine."""

from enum import StrEnum

from app.modules.settings.constants import SettingKey


class IdentityPermission(StrEnum):
    """RBAC permission keys reserved for Users admin APIs (wired in auth phase)."""

    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DELETE = "users.delete"
    USERS_MANAGE = "users.manage"
    USERS_UNLOCK = "users.unlock"
    USERS_VIEW_LOGIN_HISTORY = "users.view_login_history"


class LoginHistoryEventType(StrEnum):
    """Append-only login history event categories."""

    LOGIN = "login"
    LOGOUT = "logout"
    ACCOUNT_LOCKED = "account_locked"
    PASSWORD_RESET = "password_reset"


class AuthenticationFailureReason(StrEnum):
    """Machine-readable authentication failure codes (no tokens)."""

    USER_NOT_FOUND = "user_not_found"
    INACTIVE = "inactive"
    LOCKED = "locked"
    BAD_PASSWORD = "bad_password"
    DELETED = "deleted"


USERNAME_PATTERN = r"^[a-z0-9._-]{3,100}$"
PHONE_PATTERN = r"^\+?[0-9][0-9\s\-()]{6,20}$"

IDENTITY_SECURITY_SETTING_KEYS = (
    SettingKey.MAX_FAILED_LOGIN_ATTEMPTS,
    SettingKey.ACCOUNT_LOCK_DURATION_MINUTES,
    SettingKey.PASSWORD_MIN_LENGTH,
    SettingKey.PASSWORD_REQUIRE_COMPLEXITY,
    SettingKey.PASSWORD_HISTORY_COUNT,
    SettingKey.PASSWORD_EXPIRE_DAYS,
)

IDENTITY_TOKEN_SETTING_KEYS = (
    SettingKey.ACCESS_TOKEN_EXPIRE_MINUTES,
    SettingKey.REFRESH_TOKEN_EXPIRE_DAYS,
    SettingKey.REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS,
)

DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5
DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES = 0
DEFAULT_PASSWORD_MIN_LENGTH = 10
DEFAULT_PASSWORD_REQUIRE_COMPLEXITY = True
DEFAULT_PASSWORD_HISTORY_COUNT = 5
DEFAULT_PASSWORD_EXPIRE_DAYS = 0
DEFAULT_PASSWORD_MAX_LENGTH = 128
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 60
DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS = 7
DEFAULT_REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS = 30

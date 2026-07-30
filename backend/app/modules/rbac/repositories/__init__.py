"""RBAC repository exports."""

from app.modules.rbac.repositories.permission import PermissionRepository
from app.modules.rbac.repositories.role import RoleRepository
from app.modules.rbac.repositories.role_permission import RolePermissionRepository

__all__ = ["PermissionRepository", "RolePermissionRepository", "RoleRepository"]

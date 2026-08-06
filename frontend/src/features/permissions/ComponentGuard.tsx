import type { ReactNode } from 'react'
import { usePermission } from './PermissionProvider'
import type { PermissionKey } from '@/shared/constants/permissions'

interface ComponentGuardProps {
  children: ReactNode
  permission?: PermissionKey
  permissions?: readonly PermissionKey[]
  any?: boolean
  fallback?: ReactNode
}

export function ComponentGuard({
  children,
  permission,
  permissions,
  any = false,
  fallback = null
}: ComponentGuardProps) {
  const { can, canAny, canAll } = usePermission()

  if (permission) {
    if (!can(permission)) return fallback
  }

  if (permissions && permissions.length > 0) {
    const isAllowed = any ? canAny(permissions) : canAll(permissions)
    if (!isAllowed) return fallback
  }

  return children
}

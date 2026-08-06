import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { usePermission } from './PermissionProvider'
import type { PermissionKey } from '@/shared/constants/permissions'
import { ROUTES } from '@/shared/constants/routes'

interface RouteGuardProps {
  children: ReactNode
  permission?: PermissionKey
}

export function RouteGuard({ children, permission }: RouteGuardProps) {
  const { can } = usePermission()

  if (permission && !can(permission)) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return children
}

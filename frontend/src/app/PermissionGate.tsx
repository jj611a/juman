import type { ReactNode } from 'react'
import { PermissionGuard } from '@/components/ui/business/permission-guard'

interface Props {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}

/** Fail-closed UI gate — never the authorization authority. Thin wrap of PermissionGuard. */
export function PermissionGate({ permission, children, fallback = null }: Props): ReactNode {
  return (
    <PermissionGuard permission={permission} mode="hide" fallback={fallback}>
      {children}
    </PermissionGuard>
  )
}

import * as React from 'react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

export type PermissionGuardMode = 'hide' | 'disable'

export interface PermissionGuardProps {
  /** Single permission key. */
  permission?: string
  /** Allowed if any permission matches. */
  anyOf?: string[]
  /** Allowed if all permissions match. */
  allOf?: string[]
  mode?: PermissionGuardMode
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
}

function useAllowed(props: Pick<PermissionGuardProps, 'permission' | 'anyOf' | 'allOf'>): boolean {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission)
  const hasAllPermission = useAuthStore((s) => s.hasAllPermission)

  if (props.allOf && props.allOf.length > 0) return hasAllPermission(props.allOf)
  if (props.anyOf && props.anyOf.length > 0) return hasAnyPermission(props.anyOf)
  if (props.permission) return hasPermission(props.permission)
  return false
}

/** Fail-closed UX guard — never the authorization authority. */
export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  mode = 'hide',
  children,
  fallback = null,
  className
}: PermissionGuardProps): React.ReactElement | null {
  const allowed = useAllowed({ permission, anyOf, allOf })

  if (allowed) {
    return <>{children}</>
  }

  if (mode === 'hide') {
    return <>{fallback}</>
  }

  return (
    <div
      className={cn('pointer-events-none opacity-[var(--disabled-opacity)]', className)}
      aria-disabled="true"
      data-permission-guard="disabled"
    >
      {children}
    </div>
  )
}

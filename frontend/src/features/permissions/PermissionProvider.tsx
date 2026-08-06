import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import {
  hasPermission,
  isUnrestricted,
  type PermissionKey
} from '@/shared/constants/permissions'

interface PermissionContextValue {
  permissions: readonly string[]
  roles: readonly string[]
  unrestricted: boolean
  can: (permission: PermissionKey) => boolean
  canAny: (permissions: readonly PermissionKey[]) => boolean
  canAll: (permissions: readonly PermissionKey[]) => boolean
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()

  const permissions = useMemo(() => {
    return session?.user?.permissions ?? []
  }, [session])

  const roles = useMemo(() => {
    return session?.user?.roles ?? []
  }, [session])

  const unrestricted = useMemo(() => {
    return isUnrestricted(permissions, roles)
  }, [permissions, roles])

  const value = useMemo<PermissionContextValue>(() => {
    return {
      permissions,
      roles,
      unrestricted,
      can: (permission: PermissionKey) => {
        if (unrestricted) return true
        return hasPermission(permissions, permission)
      },
      canAny: (perms: readonly PermissionKey[]) => {
        if (unrestricted) return true
        return perms.some((p) => hasPermission(permissions, p))
      },
      canAll: (perms: readonly PermissionKey[]) => {
        if (unrestricted) return true
        return perms.every((p) => hasPermission(permissions, p))
      }
    }
  }, [permissions, roles, unrestricted])

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermission(): PermissionContextValue {
  const ctx = useContext(PermissionContext)
  if (!ctx) throw new Error('usePermission must be used within a PermissionProvider')
  return ctx
}

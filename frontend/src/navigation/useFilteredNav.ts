import { useMemo } from 'react'
import { usePermission } from '@/features/permissions/PermissionProvider'
import {
  NAV_GROUPS,
  NAV_ITEMS,
  type NavGroup,
  type NavItem,
} from '@/navigation/nav.config'
import type { PermissionKey } from '@/shared/constants/permissions'

export function useFilteredNav(): {
  groups: readonly NavGroup[]
  itemsByGroup: ReadonlyMap<NavGroup['id'], readonly NavItem[]>
  allVisible: readonly NavItem[]
} {
  const { can } = usePermission()

  return useMemo(() => {
    const visible = NAV_ITEMS.filter((item) => {
      if (!item.permission) return true
      if (Array.isArray(item.permission)) {
        return item.permission.some((p) => can(p as PermissionKey))
      }
      return can(item.permission as PermissionKey)
    })
    const map = new Map<NavGroup['id'], NavItem[]>()
    for (const g of NAV_GROUPS) map.set(g.id, [])
    for (const item of visible) {
      map.get(item.group)?.push(item)
    }
    return {
      groups: NAV_GROUPS.filter((g) => (map.get(g.id)?.length ?? 0) > 0),
      itemsByGroup: map,
      allVisible: visible,
    }
  }, [can])
}

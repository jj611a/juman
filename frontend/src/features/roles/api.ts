import { apiClient } from '@/services/apiClient'
import type {
  ItemEnvelope,
  PermissionDto,
  RoleCreateBody,
  RoleDto,
  RolePermissionsAssignBody,
  RoleUpdateBody
} from '@/services/domainTypes'

type RoleItemResponse = ItemEnvelope<RoleDto> | { success: boolean; item: RoleDto }

function unwrapRoleItem(res: RoleItemResponse): RoleDto {
  if ('data' in res && res.data) return res.data
  if ('item' in res && res.item) return res.item
  throw new Error('استجابة دور غير صالحة')
}

export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: (params?: { active_only?: boolean }) => [...roleKeys.lists(), params ?? {}] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  permissions: (id: string) => [...roleKeys.detail(id), 'permissions'] as const
}

export const permissionKeys = {
  all: ['permissions'] as const,
  list: (params?: { module?: string }) => [...permissionKeys.all, 'list', params ?? {}] as const
}

export const rolesApi = {
  list: async (params?: { active_only?: boolean }) => {
    const res = await apiClient.roles.list(params)
    return { items: res.items, total: res.total }
  },
  get: async (id: string) => {
    const res = await apiClient.roles.get(id)
    return { data: unwrapRoleItem(res) }
  },
  create: async (body: RoleCreateBody) => {
    const res = await apiClient.roles.create(body)
    return { data: unwrapRoleItem(res) }
  },
  update: async (id: string, body: RoleUpdateBody) => {
    const res = await apiClient.roles.update(id, body)
    return { data: unwrapRoleItem(res) }
  },
  remove: (id: string) => apiClient.roles.remove(id),
  listPermissions: async (id: string) => {
    const res = await apiClient.roles.listPermissions(id)
    return res.items
  },
  assignPermissions: (id: string, body: RolePermissionsAssignBody) =>
    apiClient.roles.assignPermissions(id, body),
  removePermission: (id: string, permissionId: string) =>
    apiClient.roles.removePermission(id, permissionId)
}

export const permissionsApi = {
  list: async (params?: { module?: string }) => {
    const res = await apiClient.permissions.list(params)
    return { items: res.items, total: res.total }
  }
}

export function groupPermissionsByModule(items: PermissionDto[]): Map<string, PermissionDto[]> {
  const map = new Map<string, PermissionDto[]>()
  for (const perm of items) {
    const moduleKey = perm.module?.trim() || 'عام'
    const bucket = map.get(moduleKey)
    if (bucket) bucket.push(perm)
    else map.set(moduleKey, [perm])
  }
  return map
}

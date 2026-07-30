import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { RoleCreateBody, RolePermissionsAssignBody, RoleUpdateBody } from '@/services/domainTypes'
import { permissionKeys, permissionsApi, roleKeys, rolesApi } from './api'

export function useRolesList(params?: { active_only?: boolean }) {
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: () => rolesApi.list(params)
  })
}

export function useRole(id: string | undefined) {
  return useQuery({
    queryKey: roleKeys.detail(id ?? ''),
    queryFn: () => rolesApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useRolePermissions(id: string | undefined) {
  return useQuery({
    queryKey: roleKeys.permissions(id ?? ''),
    queryFn: () => rolesApi.listPermissions(id!),
    enabled: Boolean(id)
  })
}

export function usePermissionsCatalog(params?: { module?: string }) {
  return useQuery({
    queryKey: permissionKeys.list(params),
    queryFn: () => permissionsApi.list(params)
  })
}

function invalidateRoles(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: roleKeys.lists() })
  if (id) {
    void qc.invalidateQueries({ queryKey: roleKeys.detail(id) })
    void qc.invalidateQueries({ queryKey: roleKeys.permissions(id) })
  }
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RoleCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rolesApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء الدور')
      invalidateRoles(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء الدور')
  })
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RoleUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rolesApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث الدور')
      invalidateRoles(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الدور')
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rolesApi.remove(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم حذف الدور')
      invalidateRoles(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل حذف الدور')
  })
}

export function useAssignRolePermissions(roleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RolePermissionsAssignBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rolesApi.assignPermissions(roleId, body)
    },
    onSuccess: () => {
      toast.success('تم تعيين الصلاحية')
      invalidateRoles(qc, roleId)
    },
    onError: (e) => toastAppError(e, 'فشل تعيين الصلاحية')
  })
}

export function useRemoveRolePermission(roleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (permissionId: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rolesApi.removePermission(roleId, permissionId)
    },
    onSuccess: () => {
      toast.success('تم إزالة الصلاحية')
      invalidateRoles(qc, roleId)
    },
    onError: (e) => toastAppError(e, 'فشل إزالة الصلاحية')
  })
}

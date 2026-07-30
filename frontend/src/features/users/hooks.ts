import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  AdminResetPasswordBody,
  LoginHistoryListParams,
  UserCreateBody,
  UserListParams,
  UserUpdateBody
} from '@/services/domainTypes'
import { userKeys, usersApi } from './api'

export function useUsersList(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params)
  })
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => usersApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useUserLoginHistory(
  userId: string | undefined,
  params: LoginHistoryListParams,
  enabled: boolean
) {
  return useQuery({
    queryKey: userKeys.loginHistory(userId ?? '', params),
    queryFn: () => usersApi.userLoginHistory(userId!, params),
    enabled: Boolean(userId) && enabled,
    retry: false
  })
}

function invalidateUsers(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: userKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: userKeys.detail(id) })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UserCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return usersApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء المستخدم')
      invalidateUsers(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء المستخدم')
  })
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UserUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return usersApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث المستخدم')
      invalidateUsers(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث المستخدم')
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return usersApi.remove(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم حذف المستخدم')
      invalidateUsers(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل حذف المستخدم')
  })
}

export function useActivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return usersApi.activate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم تفعيل المستخدم')
      invalidateUsers(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return usersApi.deactivate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم إلغاء تفعيل المستخدم')
      invalidateUsers(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (body: AdminResetPasswordBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return usersApi.resetPassword(body)
    },
    onSuccess: () => toast.success('تم إعادة تعيين كلمة المرور'),
    onError: (e) => toastAppError(e, 'فشل إعادة تعيين كلمة المرور')
  })
}

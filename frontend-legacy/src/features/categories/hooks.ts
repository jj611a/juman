import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { CategoryCreateBody, CategoryListParams, CategoryUpdateBody } from '@/services/domainTypes'
import { categoriesApi, categoryKeys } from './api'

export function useCategoriesList(params: CategoryListParams) {
  return useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(params)
  })
}

export function useCategory(id: string | null) {
  return useQuery({
    queryKey: categoryKeys.detail(id ?? ''),
    queryFn: () => categoriesApi.get(id!),
    enabled: Boolean(id)
  })
}

function invalidateCategories(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: categoryKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: categoryKeys.detail(id) })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CategoryCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return categoriesApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء الفئة')
      invalidateCategories(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء الفئة')
  })
}

export function useUpdateCategory(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CategoryUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return categoriesApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث الفئة')
      invalidateCategories(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الفئة')
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return categoriesApi.remove(id)
    },
    onSuccess: (_data, id) => {
      toast.success('تم حذف الفئة')
      invalidateCategories(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل حذف الفئة')
  })
}

export function useActivateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return categoriesApi.activate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم تفعيل الفئة')
      invalidateCategories(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

export function useDeactivateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return categoriesApi.deactivate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم إلغاء تفعيل الفئة')
      invalidateCategories(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

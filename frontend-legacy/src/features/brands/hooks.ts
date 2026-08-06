import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { BrandCreateBody, BrandListParams, BrandUpdateBody } from '@/services/domainTypes'
import { brandKeys, brandsApi } from './api'

export function useBrandsList(params: BrandListParams) {
  return useQuery({
    queryKey: brandKeys.list(params),
    queryFn: () => brandsApi.list(params)
  })
}

function invalidateBrands(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: brandKeys.lists() })
}

export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BrandCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return brandsApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء العلامة')
      invalidateBrands(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء العلامة')
  })
}

export function useUpdateBrand(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BrandUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return brandsApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث العلامة')
      invalidateBrands(qc)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث العلامة')
  })
}

export function useDeleteBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return brandsApi.remove(id)
    },
    onSuccess: () => {
      toast.success('تم حذف العلامة')
      invalidateBrands(qc)
    },
    onError: (e) => toastAppError(e, 'فشل حذف العلامة')
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { SizeCreateBody, SizeListParams, SizeUpdateBody } from '@/services/domainTypes'
import { sizeKeys, sizesApi } from './api'

export function useSizesList(params: SizeListParams) {
  return useQuery({
    queryKey: sizeKeys.list(params),
    queryFn: () => sizesApi.list(params)
  })
}

function invalidateSizes(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: sizeKeys.lists() })
}

export function useCreateSize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SizeCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return sizesApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء المقاس')
      invalidateSizes(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء المقاس')
  })
}

export function useUpdateSize(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SizeUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return sizesApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث المقاس')
      invalidateSizes(qc)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث المقاس')
  })
}

export function useDeleteSize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return sizesApi.remove(id)
    },
    onSuccess: () => {
      toast.success('تم حذف المقاس')
      invalidateSizes(qc)
    },
    onError: (e) => toastAppError(e, 'فشل حذف المقاس')
  })
}

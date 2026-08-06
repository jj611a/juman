import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { ColorCreateBody, ColorListParams, ColorUpdateBody } from '@/services/domainTypes'
import { colorKeys, colorsApi } from './api'

export function useColorsList(params: ColorListParams) {
  return useQuery({
    queryKey: colorKeys.list(params),
    queryFn: () => colorsApi.list(params)
  })
}

function invalidateColors(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: colorKeys.lists() })
}

export function useCreateColor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ColorCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return colorsApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء اللون')
      invalidateColors(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء اللون')
  })
}

export function useUpdateColor(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ColorUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return colorsApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث اللون')
      invalidateColors(qc)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث اللون')
  })
}

export function useDeleteColor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return colorsApi.remove(id)
    },
    onSuccess: () => {
      toast.success('تم حذف اللون')
      invalidateColors(qc)
    },
    onError: (e) => toastAppError(e, 'فشل حذف اللون')
  })
}

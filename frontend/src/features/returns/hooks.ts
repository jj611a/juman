import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { ReturnCreateBody, ReturnListParams } from '@/services/domainTypes'
import { returnKeys, returnsApi } from './api'

export function useReturnsList(params: ReturnListParams) {
  return useQuery({
    queryKey: returnKeys.list(params),
    queryFn: () => returnsApi.list(params)
  })
}

export function useReturn(id: string | undefined) {
  return useQuery({
    queryKey: returnKeys.detail(id ?? ''),
    queryFn: () => returnsApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useReturnAudit(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: returnKeys.audit(id ?? ''),
    queryFn: () => returnsApi.audit(id!),
    enabled: Boolean(id) && enabled,
    retry: false
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: returnKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: returnKeys.detail(id) })
  void qc.invalidateQueries({ queryKey: ['rentals'] })
  void qc.invalidateQueries({ queryKey: ['inspections'] })
}

export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReturnCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return returnsApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم تسجيل المرتجع')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل تسجيل المرتجع')
  })
}
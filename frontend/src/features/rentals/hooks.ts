import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { RentalCreateBody, RentalListParams, RentalUpdateBody } from '@/services/domainTypes'
import { rentalKeys, rentalsApi } from './api'

export function useRentalsList(params: RentalListParams) {
  return useQuery({
    queryKey: rentalKeys.list(params),
    queryFn: () => rentalsApi.list(params)
  })
}

export function useRental(id: string | undefined) {
  return useQuery({
    queryKey: rentalKeys.detail(id ?? ''),
    queryFn: () => rentalsApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useRentalAudit(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: rentalKeys.audit(id ?? ''),
    queryFn: () => rentalsApi.audit(id!),
    enabled: Boolean(id) && enabled,
    retry: false
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: rentalKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: rentalKeys.detail(id) })
  void qc.invalidateQueries({ queryKey: ['reservations'] })
  void qc.invalidateQueries({ queryKey: ['calendar'] })
}

export function useCreateRental() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RentalCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rentalsApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء التأجير')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء التأجير')
  })
}

export function useUpdateRental(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RentalUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rentalsApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث الملاحظات')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل التحديث')
  })
}

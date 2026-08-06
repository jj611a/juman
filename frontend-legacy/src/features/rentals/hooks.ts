import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { RentalCreateBody, RentalListParams, RentalUpdateBody } from '@/services/domainTypes'
import { rentalKeys, rentalsApi, type RentalActionBody } from './api'

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
  if (id) {
    void qc.invalidateQueries({ queryKey: rentalKeys.detail(id) })
    void qc.invalidateQueries({ queryKey: rentalKeys.audit(id) })
  }
  void qc.invalidateQueries({ queryKey: ['reservations'] })
  void qc.invalidateQueries({ queryKey: ['settlements'] })
  void qc.invalidateQueries({ queryKey: ['inventory'] })
}

export function useCreateRental() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RentalCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rentalsApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء مسودة التأجير')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء التأجير')
  })
}

export function useCheckoutRental() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: RentalActionBody }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rentalsApi.checkout(id, body)
    },
    onSuccess: (_d, vars) => {
      toast.success('تم تسليم التأجير')
      invalidate(qc, vars.id)
    },
    onError: (e) => toastAppError(e, 'فشل التسليم')
  })
}

export function useReturnRental() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rentalsApi.return(id, { reason })
    },
    onSuccess: (_d, vars) => {
      toast.success('تم تسجيل الإرجاع')
      invalidate(qc, vars.id)
    },
    onError: (e) => toastAppError(e, 'فشل الإرجاع')
  })
}

export function useCompleteRental() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rentalsApi.complete(id, { reason })
    },
    onSuccess: (_d, vars) => {
      toast.success('تم إكمال التأجير')
      invalidate(qc, vars.id)
    },
    onError: (e) => toastAppError(e, 'فشل الإكمال')
  })
}

export function useCancelRental() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return rentalsApi.cancel(id, { reason })
    },
    onSuccess: (_d, vars) => {
      toast.success('تم إلغاء التأجير')
      invalidate(qc, vars.id)
    },
    onError: (e) => toastAppError(e, 'فشل الإلغاء')
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

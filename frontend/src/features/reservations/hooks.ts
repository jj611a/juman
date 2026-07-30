import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  ReservationCreateBody,
  ReservationListParams,
  ReservationUpdateBody
} from '@/services/domainTypes'
import { reservationKeys, reservationsApi } from './api'

export function useReservationsList(params: ReservationListParams) {
  return useQuery({
    queryKey: reservationKeys.list(params),
    queryFn: () => reservationsApi.list(params)
  })
}

export function useReservation(id: string | undefined) {
  return useQuery({
    queryKey: reservationKeys.detail(id ?? ''),
    queryFn: () => reservationsApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useReservationAudit(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: reservationKeys.audit(id ?? ''),
    queryFn: () => reservationsApi.audit(id!),
    enabled: Boolean(id) && enabled,
    retry: false
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: reservationKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: reservationKeys.detail(id) })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReservationCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return reservationsApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء مسودة الحجز')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء الحجز')
  })
}

export function useUpdateReservation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReservationUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return reservationsApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث الحجز')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الحجز')
  })
}

export function useConfirmReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return reservationsApi.confirm(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم تأكيد الحجز')
      invalidate(qc, id)
      void qc.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: (e) => toastAppError(e, 'فشل تأكيد الحجز')
  })
}

export function useCancelReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return reservationsApi.cancel(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم إلغاء الحجز')
      invalidate(qc, id)
      void qc.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: (e) => toastAppError(e, 'فشل إلغاء الحجز')
  })
}

export function useExpireReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return reservationsApi.expire(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم إنهاء الحجز')
      invalidate(qc, id)
      void qc.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: (e) => toastAppError(e, 'فشل إنهاء الحجز')
  })
}

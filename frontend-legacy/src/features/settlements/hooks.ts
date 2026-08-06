import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  SettlementAdjustmentCreateBody,
  SettlementCreateBody,
  SettlementListParams,
  SettlementPaymentCreateBody
} from '@/services/domainTypes'
import { rentalKeys } from '@/features/rentals/api'
import { settlementKeys, settlementsApi } from './api'

export function useSettlementsList(
  params: SettlementListParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: settlementKeys.list(params),
    queryFn: () => settlementsApi.list(params),
    enabled: options?.enabled ?? true
  })
}

export function useSettlement(id: string | undefined) {
  return useQuery({
    queryKey: settlementKeys.detail(id ?? ''),
    queryFn: () => settlementsApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useSettlementByRental(rentalId: string | undefined) {
  return useQuery({
    queryKey: settlementKeys.byRental(rentalId ?? ''),
    queryFn: () => settlementsApi.getByRental(rentalId!),
    enabled: Boolean(rentalId),
    retry: false
  })
}

export function useSettlementAudit(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: settlementKeys.audit(id ?? ''),
    queryFn: () => settlementsApi.audit(id!),
    enabled: Boolean(id) && enabled,
    retry: false
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string, rentalId?: string): void {
  void qc.invalidateQueries({ queryKey: settlementKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: settlementKeys.detail(id) })
  if (rentalId) void qc.invalidateQueries({ queryKey: settlementKeys.byRental(rentalId) })
  void qc.invalidateQueries({ queryKey: rentalKeys.lists() })
  if (rentalId) void qc.invalidateQueries({ queryKey: rentalKeys.detail(rentalId) })
}

export function useCreateSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SettlementCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.create(body)
    },
    onSuccess: (res) => {
      toast.success('تم إنشاء التسوية')
      invalidate(qc, res.data.id, res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء التسوية')
  })
}

export function useCollectSettlementPayment(id: string, rentalId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SettlementPaymentCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.collectPayment(id, body)
    },
    onSuccess: (res) => {
      toast.success('تم تسجيل الدفعة')
      invalidate(qc, id, rentalId ?? res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل تسجيل الدفعة')
  })
}

export function useAdjustSettlement(id: string, rentalId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SettlementAdjustmentCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.adjust(id, body)
    },
    onSuccess: (res) => {
      toast.success('تم تسجيل التعديل')
      invalidate(qc, id, rentalId ?? res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل تسجيل التعديل')
  })
}

export function useRefundSettlement(id: string, rentalId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { amountFils: number; reason: string }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.refund(id, body)
    },
    onSuccess: (res) => {
      toast.success('تم تسجيل الاسترداد')
      invalidate(qc, id, rentalId ?? res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل الاسترداد')
  })
}

export function useDiscountSettlement(id: string, rentalId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.discount(id, body)
    },
    onSuccess: (res) => {
      toast.success('تم تطبيق الخصم')
      invalidate(qc, id, rentalId ?? res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل الخصم')
  })
}

export function useLateFeeSettlement(id: string, rentalId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.lateFee(id, body)
    },
    onSuccess: (res) => {
      toast.success('تم احتساب غرامة التأخير')
      invalidate(qc, id, rentalId ?? res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل غرامة التأخير')
  })
}

export function useCloseSettlement(id: string, rentalId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: { reason?: string }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.close(id, body)
    },
    onSuccess: (res) => {
      toast.success('تم إغلاق التسوية')
      invalidate(qc, id, rentalId ?? res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل إغلاق التسوية')
  })
}

export function useCancelSettlement(id: string, rentalId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: { reason?: string }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settlementsApi.cancel(id, body)
    },
    onSuccess: (res) => {
      toast.success('تم إلغاء التسوية')
      invalidate(qc, id, rentalId ?? res.data.rental_id)
    },
    onError: (e) => toastAppError(e, 'فشل إلغاء التسوية')
  })
}

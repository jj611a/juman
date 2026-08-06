import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  BarcodeGenerateBody,
  BarcodeListParams,
  BarcodeReserveBody,
  BarcodeValidateBody,
  BarcodeValueBody
} from '@/services/domainTypes'
import { barcodeKeys, barcodesApi } from './api'

export function useBarcodesList(params: BarcodeListParams) {
  return useQuery({
    queryKey: barcodeKeys.list(params),
    queryFn: () => barcodesApi.list(params)
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: barcodeKeys.lists() })
}

export function useGenerateBarcode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: BarcodeGenerateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return barcodesApi.generate(body)
    },
    onSuccess: () => {
      toast.success('تم توليد باركود')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل التوليد')
  })
}

export function useReserveBarcode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: BarcodeReserveBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return barcodesApi.reserve(body)
    },
    onSuccess: () => {
      toast.success('تم حجز باركود')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل الحجز')
  })
}

export function useValidateBarcode() {
  return useMutation({
    mutationFn: (body: BarcodeValidateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return barcodesApi.validate(body)
    },
    onSuccess: (result) => {
      const ok = result.ok === true || result.valid === true
      if (ok) toast.success('الباركود صالح')
      else toast.error(String(result.reason ?? 'الباركود غير صالح'))
    },
    onError: (e) => toastAppError(e, 'فشل التحقق')
  })
}

export function useReleaseBarcode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BarcodeValueBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return barcodesApi.release(body)
    },
    onSuccess: () => {
      toast.success('تم تحرير الباركود')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل التحرير')
  })
}

export function useRetireBarcode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BarcodeValueBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return barcodesApi.retire(body)
    },
    onSuccess: () => {
      toast.success('تم إخراج الباركود')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل الإخراج')
  })
}

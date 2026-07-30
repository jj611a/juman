import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { SaleCreateBody, SaleListParams } from '@/services/domainTypes'
import { saleKeys, salesApi } from './api'

export function useSalesList(params: SaleListParams) {
  return useQuery({
    queryKey: saleKeys.list(params),
    queryFn: () => salesApi.list(params)
  })
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: saleKeys.detail(id ?? ''),
    queryFn: () => salesApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useSaleAudit(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: saleKeys.audit(id ?? ''),
    queryFn: () => salesApi.audit(id!),
    enabled: Boolean(id) && enabled,
    retry: false
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: saleKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: saleKeys.detail(id) })
  void qc.invalidateQueries({ queryKey: ['inventory'] })
  void qc.invalidateQueries({ queryKey: ['inspections'] })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SaleCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return salesApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء البيع')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء البيع')
  })
}

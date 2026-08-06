import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  CustomerCreateBody,
  CustomerListParams,
  CustomerUpdateBody
} from '@/services/domainTypes'
import {
  customerAuditApi,
  customerKeys,
  customerMediaApi,
  customersApi
} from './api'

export function useCustomersList(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => customersApi.list(params)
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: () => customersApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useCustomerMedia(customerId: string | undefined) {
  return useQuery({
    queryKey: customerKeys.media(customerId ?? ''),
    queryFn: async () => {
      const refs = await customerMediaApi.listReferences(customerId!)
      const withSrc = await Promise.all(
        refs.data.map(async (ref) => {
          try {
            const binary = await customerMediaApi.downloadDataUrl(ref.stored_file_id)
            return { ...ref, dataUrl: binary.dataUrl, mimeType: binary.mimeType }
          } catch {
            return { ...ref, dataUrl: undefined as string | undefined, mimeType: undefined as string | undefined }
          }
        })
      )
      return withSrc
    },
    enabled: Boolean(customerId)
  })
}

export function useCustomerAudit(customerId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: customerKeys.audit(customerId ?? ''),
    queryFn: () => customerAuditApi.list(customerId!),
    enabled: Boolean(customerId) && enabled,
    retry: false
  })
}

function invalidateCustomers(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: customerKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: customerKeys.detail(id) })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CustomerCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return customersApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء العميل')
      invalidateCustomers(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء العميل')
  })
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CustomerUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return customersApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث العميل')
      invalidateCustomers(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث العميل')
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return customersApi.remove(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم حذف العميل')
      invalidateCustomers(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل حذف العميل')
  })
}

export function useActivateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return customersApi.activate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم تفعيل العميل')
      invalidateCustomers(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

export function useDeactivateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return customersApi.deactivate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم إلغاء تفعيل العميل')
      invalidateCustomers(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

export function useUploadCustomerProfile(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      const uploaded = await customerMediaApi.upload(file)
      return customerMediaApi.createReference({
        stored_file_id: uploaded.data.id,
        module_name: 'customers',
        entity_type: 'customer',
        entity_id: customerId,
        purpose: 'profile',
        is_primary: true,
        display_order: 0
      })
    },
    onSuccess: () => {
      toast.success('تم رفع صورة الملف الشخصي')
      void qc.invalidateQueries({ queryKey: customerKeys.media(customerId) })
    },
    onError: (e) => toastAppError(e, 'فشل رفع الصورة')
  })
}

export function useUploadCustomerGallery(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      const uploaded = await customerMediaApi.upload(file)
      return customerMediaApi.createReference({
        stored_file_id: uploaded.data.id,
        module_name: 'customers',
        entity_type: 'customer',
        entity_id: customerId,
        purpose: 'gallery',
        is_primary: false
      })
    },
    onSuccess: () => {
      toast.success('تمت إضافة صورة للمعرض')
      void qc.invalidateQueries({ queryKey: customerKeys.media(customerId) })
    },
    onError: (e) => toastAppError(e, 'فشل رفع الصورة')
  })
}

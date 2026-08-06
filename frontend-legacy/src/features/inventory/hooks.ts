import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  DressCreateBody,
  DressListParams,
  DressStatusChangeBody,
  DressUpdateBody
} from '@/services/domainTypes'
import { apiClient } from '@/services/apiClient'
import { inventoryApi, inventoryKeys } from './api'

export function useDressesList(params: DressListParams) {
  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => inventoryApi.list(params)
  })
}

export function useDress(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.detail(id ?? ''),
    queryFn: () => inventoryApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useDressPhotos(dressId: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.photos(dressId ?? ''),
    queryFn: async () => {
      const photos = await inventoryApi.listPhotos(dressId!)
      const withSrc = await Promise.all(
        photos.data.map(async (p) => {
          try {
            const binary = await apiClient.media.downloadDataUrl(p.stored_file_id)
            return { ...p, dataUrl: binary.dataUrl as string | undefined }
          } catch {
            return { ...p, dataUrl: undefined as string | undefined }
          }
        })
      )
      return withSrc
    },
    enabled: Boolean(dressId)
  })
}

export function useDressAudit(dressId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: inventoryKeys.audit(dressId ?? ''),
    queryFn: () => inventoryApi.audit(dressId!),
    enabled: Boolean(dressId) && enabled,
    retry: false
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: inventoryKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: inventoryKeys.detail(id) })
}

export function useCreateDress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DressCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء الفستان')
      invalidate(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء الفستان')
  })
}

export function useUpdateDress(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DressUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث الفستان')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الفستان')
  })
}

export function useDeleteDress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.remove(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم حذف الفستان')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل حذف الفستان')
  })
}

export function useActivateDress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.activate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم تفعيل الفستان')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

export function useDeactivateDress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.deactivate(id)
    },
    onSuccess: (_d, id) => {
      toast.success('تم إلغاء تفعيل الفستان')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e)
  })
}

export function useChangeDressStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DressStatusChangeBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.changeStatus(id, body)
    },
    onSuccess: () => {
      toast.success('تم تغيير الحالة')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تغيير الحالة')
  })
}

export function useUploadDressPhoto(dressId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      const uploaded = await apiClient.media.upload(file)
      return inventoryApi.addPhoto(dressId, uploaded.data.id)
    },
    onSuccess: () => {
      toast.success('تمت إضافة الصورة')
      void qc.invalidateQueries({ queryKey: inventoryKeys.photos(dressId) })
    },
    onError: (e) => toastAppError(e, 'فشل رفع الصورة')
  })
}


export function useUpdateDressBarcode(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (barcode?: string | null) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.updateBarcode(id, barcode)
    },
    onSuccess: () => {
      toast.success('تم تحديث الباركود')
      invalidate(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الباركود')
  })
}

export function useSetDressCover(dressId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (photoId: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.setCover(dressId, photoId)
    },
    onSuccess: () => {
      toast.success('تم تعيين صورة الغلاف')
      void qc.invalidateQueries({ queryKey: inventoryKeys.photos(dressId) })
    },
    onError: (e) => toastAppError(e)
  })
}

export function useRemoveDressPhoto(dressId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (photoId: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inventoryApi.removePhoto(photoId)
    },
    onSuccess: () => {
      toast.success('تم حذف الصورة')
      void qc.invalidateQueries({ queryKey: inventoryKeys.photos(dressId) })
    },
    onError: (e) => toastAppError(e, 'فشل حذف الصورة')
  })
}

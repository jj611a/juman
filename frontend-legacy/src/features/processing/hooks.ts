import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  InspectionCreateBody,
  InspectionListParams,
  InspectionUpdateBody,
  ProcessingCreateBody,
  ProcessingListParams,
  ProcessingStartBody,
  ProcessingUpdateBody
} from '@/services/domainTypes'
import { inspectionKeys, inspectionsApi, processingApi, processingKeys } from './api'

export function useInspectionsList(params: InspectionListParams) {
  return useQuery({
    queryKey: inspectionKeys.list(params),
    queryFn: () => inspectionsApi.list(params)
  })
}

export function useInspection(id: string | undefined) {
  return useQuery({
    queryKey: inspectionKeys.detail(id ?? ''),
    queryFn: () => inspectionsApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useInspectionAudit(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: inspectionKeys.audit(id ?? ''),
    queryFn: () => inspectionsApi.audit(id!),
    enabled: Boolean(id) && enabled,
    retry: false
  })
}

export function useProcessingList(params: ProcessingListParams) {
  return useQuery({
    queryKey: processingKeys.list(params),
    queryFn: () => processingApi.list(params)
  })
}

export function useProcessingBatch(id: string | undefined) {
  return useQuery({
    queryKey: processingKeys.detail(id ?? ''),
    queryFn: () => processingApi.get(id!),
    enabled: Boolean(id)
  })
}

export function useProcessingAudit(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: processingKeys.audit(id ?? ''),
    queryFn: () => processingApi.audit(id!),
    enabled: Boolean(id) && enabled,
    retry: false
  })
}

function invalidateInspections(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: inspectionKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: inspectionKeys.detail(id) })
  void qc.invalidateQueries({ queryKey: ['returns'] })
  void qc.invalidateQueries({ queryKey: ['inventory'] })
  void qc.invalidateQueries({ queryKey: ['calendar'] })
}

function invalidateProcessing(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: processingKeys.lists() })
  if (id) void qc.invalidateQueries({ queryKey: processingKeys.detail(id) })
  void qc.invalidateQueries({ queryKey: ['inspections'] })
  void qc.invalidateQueries({ queryKey: ['returns'] })
  void qc.invalidateQueries({ queryKey: ['inventory'] })
  void qc.invalidateQueries({ queryKey: ['calendar'] })
}

export function useCreateInspection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: InspectionCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inspectionsApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء الفحص')
      invalidateInspections(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء الفحص')
  })
}

export function useUpdateInspection(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: InspectionUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return inspectionsApi.update(id, body)
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.complete ? 'تم إكمال الفحص' : 'تم حفظ المسودة')
      invalidateInspections(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الفحص')
  })
}

export function useCreateProcessingBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProcessingCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return processingApi.create(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء دفعة المعالجة')
      invalidateProcessing(qc)
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء دفعة المعالجة')
  })
}

export function useUpdateProcessingBatch(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProcessingUpdateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return processingApi.update(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث الدفعة')
      invalidateProcessing(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الدفعة')
  })
}

export function useStartProcessingBatch(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: ProcessingStartBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return processingApi.start(id, body)
    },
    onSuccess: () => {
      toast.success('تم بدء المعالجة')
      invalidateProcessing(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل بدء المعالجة')
  })
}

export function useAddProcessingOptionalDay(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return processingApi.addOptionalDay(id)
    },
    onSuccess: () => {
      toast.success('تمت إضافة اليوم الاختياري')
      invalidateProcessing(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل إضافة اليوم الاختياري')
  })
}

export function useCompleteProcessingBatch(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return processingApi.complete(id)
    },
    onSuccess: () => {
      toast.success('تم إكمال المعالجة')
      invalidateProcessing(qc, id)
    },
    onError: (e) => toastAppError(e, 'فشل إكمال المعالجة')
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { CalendarBlockCreateBody, CalendarBlockUpdateBody } from '@/services/domainTypes'
import { calendarApi, calendarKeys } from './api'

export function useDressTimeline(dressId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: calendarKeys.timeline(dressId ?? '', from, to),
    queryFn: () => calendarApi.timeline(dressId!, from, to),
    enabled: Boolean(dressId && from && to)
  })
}

export function useCreateMaintenanceBlock(dressId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<CalendarBlockCreateBody, 'dress_id' | 'block_type'>) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return calendarApi.createBlock({
        dress_id: dressId,
        block_type: 'MAINTENANCE',
        ...body
      })
    },
    onSuccess: () => {
      toast.success('تم إنشاء كتلة صيانة')
      void qc.invalidateQueries({ queryKey: calendarKeys.all })
    },
    onError: (e) => toastAppError(e, 'فشل إنشاء الكتلة')
  })
}

export function useUpdateCalendarBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CalendarBlockUpdateBody }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return calendarApi.updateBlock(id, body)
    },
    onSuccess: () => {
      toast.success('تم تحديث الكتلة')
      void qc.invalidateQueries({ queryKey: calendarKeys.all })
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الكتلة')
  })
}

export function useDeleteCalendarBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return calendarApi.deleteBlock(id)
    },
    onSuccess: () => {
      toast.success('تم حذف الكتلة')
      void qc.invalidateQueries({ queryKey: calendarKeys.all })
    },
    onError: (e) => toastAppError(e, 'فشل حذف الكتلة')
  })
}

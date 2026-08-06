import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type { SettingCategory } from '@/services/domainTypes'
import { settingKeys, settingsApi } from './api'

export function useSettingsList(category?: SettingCategory | string) {
  return useQuery({
    queryKey: settingKeys.list(category),
    queryFn: () => settingsApi.list(category ? { category } : undefined)
  })
}

export function useSetting(key: string | undefined) {
  return useQuery({
    queryKey: settingKeys.detail(key ?? ''),
    queryFn: () => settingsApi.get(key!),
    enabled: Boolean(key)
  })
}

function invalidateSettings(qc: ReturnType<typeof useQueryClient>, category?: string): void {
  void qc.invalidateQueries({ queryKey: settingKeys.lists() })
  if (category) void qc.invalidateQueries({ queryKey: settingKeys.list(category) })
}

export function usePatchSettingValue(category?: SettingCategory | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settingsApi.patchValue(key, { value })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: settingKeys.detail(vars.key) })
      invalidateSettings(qc, category)
    },
    onError: (e) => toastAppError(e, 'فشل حفظ الإعداد')
  })
}

export function useUpdateSetting(category?: SettingCategory | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      key,
      value,
      description
    }: {
      key: string
      value: string
      description?: string | null
    }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return settingsApi.update(key, { value, description })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: settingKeys.detail(vars.key) })
      invalidateSettings(qc, category)
    },
    onError: (e) => toastAppError(e, 'فشل تحديث الإعداد')
  })
}

export function useSaveSettingValues(category?: SettingCategory | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entries: { key: string; value: string }[]) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      if (entries.length === 0) return []
      return Promise.all(entries.map((entry) => settingsApi.patchValue(entry.key, { value: entry.value })))
    },
    onSuccess: (_data, entries) => {
      if (entries.length === 0) return
      toast.success(entries.length === 1 ? 'تم حفظ الإعداد' : 'تم حفظ الإعدادات')
      for (const entry of entries) {
        void qc.invalidateQueries({ queryKey: settingKeys.detail(entry.key) })
      }
      invalidateSettings(qc, category)
    },
    onError: (e) => toastAppError(e, 'فشل حفظ الإعدادات')
  })
}

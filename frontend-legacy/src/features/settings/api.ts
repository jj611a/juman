import { apiClient } from '@/services/apiClient'
import type {
  SettingCategory,
  SettingDto,
  SettingUpdateBody,
  SettingValueBody
} from '@/services/domainTypes'

export interface SettingsListResult {
  items: SettingDto[]
  total: number
}

function normalizeList(raw: unknown): SettingsListResult {
  const envelope = raw as Partial<SettingsListResult> & { data?: SettingDto[] }
  const items = envelope.items ?? envelope.data ?? []
  const total = typeof envelope.total === 'number' ? envelope.total : items.length
  return { items, total }
}

function normalizeItem(raw: unknown): SettingDto {
  const envelope = raw as Partial<{ data: SettingDto; item: SettingDto }>
  if (envelope.data && typeof envelope.data === 'object') return envelope.data
  if (envelope.item && typeof envelope.item === 'object') return envelope.item
  return raw as SettingDto
}

export const settingKeys = {
  all: ['settings'] as const,
  lists: () => [...settingKeys.all, 'list'] as const,
  list: (category?: SettingCategory | string) =>
    [...settingKeys.lists(), category ?? 'all'] as const,
  details: () => [...settingKeys.all, 'detail'] as const,
  detail: (key: string) => [...settingKeys.details(), key] as const
}

export const settingsApi = {
  list: async (params?: { category?: SettingCategory | string }): Promise<SettingsListResult> =>
    normalizeList(await apiClient.settings.list(params)),

  get: async (key: string): Promise<SettingDto> =>
    normalizeItem(await apiClient.settings.get(key)),

  update: async (key: string, body: SettingUpdateBody): Promise<SettingDto> =>
    normalizeItem(await apiClient.settings.update(key, body)),

  patchValue: async (key: string, body: SettingValueBody): Promise<SettingDto> =>
    normalizeItem(await apiClient.settings.patchValue(key, body))
}

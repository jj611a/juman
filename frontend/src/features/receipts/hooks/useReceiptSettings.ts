import { useCallback, useMemo, useState } from 'react'
import type { ReceiptSettings } from '../types/receipt'
import { DEFAULT_RECEIPT_SETTINGS } from '../types/receipt'

/**
 * Receipt settings persistence.
 *
 * Nest exposes NO settings endpoint (backend frozen) and there is no official
 * desktop config surface yet — so settings live in localStorage only and are
 * clearly documented as non-server-persisted. All toggles/values are strictly
 * presentation configuration; nothing financial is stored here.
 */
const STORAGE_KEY = 'juman.receipt.settings.v1'

export interface UseReceiptSettingsResult {
  settings: ReceiptSettings
  update: (patch: Partial<ReceiptSettings>) => void
  reset: () => void
  /** True when any field differs from defaults. */
  isModified: boolean
}

function load(): ReceiptSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_RECEIPT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ReceiptSettings>
    return { ...DEFAULT_RECEIPT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_RECEIPT_SETTINGS
  }
}

export function useReceiptSettings(): UseReceiptSettingsResult {
  const [settings, setSettings] = useState<ReceiptSettings>(() => load())

  const update = useCallback((patch: Partial<ReceiptSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* storage full/unavailable — keep in-memory value */
      }
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setSettings(DEFAULT_RECEIPT_SETTINGS)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const isModified = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(DEFAULT_RECEIPT_SETTINGS),
    [settings],
  )

  return { settings, update, reset, isModified }
}

import { useCallback, useState } from 'react'
import type { ReceiptData, ReceiptSettings } from '../types/receipt'
import { renderReceiptHtml } from '../utils/render'

export interface UseReceiptPrintResult {
  printing: boolean
  lastResult: { success: boolean; cancelled?: boolean } | null
  error: string | null
  print: (data: ReceiptData, settings: ReceiptSettings) => Promise<boolean>
}

/**
 * Print boundary: renderer builds self-contained HTML and hands it to the
 * Main process via receipt:print. The renderer never accesses native printer
 * APIs. Hardware support (USB/Bluetooth) is an integration boundary — see the
 * Phase 9.6 report; this path uses Electron's system print dialog.
 */
export function useReceiptPrint(): UseReceiptPrintResult {
  const [printing, setPrinting] = useState(false)
  const [lastResult, setLastResult] = useState<{ success: boolean; cancelled?: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const print = useCallback(async (data: ReceiptData, settings: ReceiptSettings) => {
    setPrinting(true)
    setError(null)
    try {
      const html = await renderReceiptHtml(data, settings)
      const result = await window.juman.receipt.print({
        html,
        paperWidthMm: settings.paperWidth,
      })
      setLastResult(result)
      return result.success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل الطباعة'
      setError(message)
      return false
    } finally {
      setPrinting(false)
    }
  }, [])

  return { printing, lastResult, error, print }
}

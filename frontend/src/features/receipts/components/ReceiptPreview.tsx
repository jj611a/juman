import { forwardRef } from 'react'
import type { ReceiptData, ReceiptSettings } from '../types/receipt'
import { DefaultReceiptTemplate } from '../templates/DefaultReceiptTemplate'

interface ReceiptPreviewProps {
  data: ReceiptData
  settings: ReceiptSettings
  /** When true, render on a neutral card surface suitable for the app. */
  onSurface?: boolean
}

/**
 * React live preview of a receipt. Wraps the shared template so the settings
 * screen and any inline preview share one rendering path.
 */
export const ReceiptPreview = forwardRef<HTMLDivElement, ReceiptPreviewProps>(
  function ReceiptPreview({ data, settings, onSurface = true }, ref) {
    if (onSurface) {
      return (
        <div
          ref={ref}
          className="overflow-hidden rounded-box border border-base-content/10 bg-white p-3 shadow-inner"
        >
          <DefaultReceiptTemplate data={data} settings={settings} />
        </div>
      )
    }
    return (
      <div ref={ref}>
        <DefaultReceiptTemplate data={data} settings={settings} />
      </div>
    )
  },
)

import type { HardwareStationConfig, LabelPreview, PrintStatus } from '../../../shared/hardware'
import { buildBarcodeLabel, buildLabelPreviewSvg } from './escpos'
import { sendRaw } from './printService'

export function previewLabel(barcode: string, title?: string | null): LabelPreview {
  const payload = buildBarcodeLabel(barcode, title)
  return {
    barcode,
    title: title ?? null,
    svg: buildLabelPreviewSvg(barcode, title),
    payloadBytes: payload.length
  }
}

export async function printLabel(
  config: HardwareStationConfig,
  barcode: string,
  title?: string | null
): Promise<PrintStatus> {
  const data = buildBarcodeLabel(barcode, title, {
    encoding: config.textEncoding,
    paperWidthChars: config.paperWidthChars
  })
  return sendRaw(config, 'label', data)
}

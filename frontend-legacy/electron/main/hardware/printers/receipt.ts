import type { HardwareStationConfig, PrintStatus } from '../../../shared/hardware'
import { buildTestReceipt } from './escpos'
import { sendRaw } from './printService'

export async function printReceiptRaw(
  config: HardwareStationConfig,
  data: Buffer
): Promise<PrintStatus> {
  return sendRaw(config, 'receipt', data)
}

export async function testReceiptPrint(config: HardwareStationConfig): Promise<PrintStatus> {
  return printReceiptRaw(
    config,
    buildTestReceipt('Juman', {
      encoding: config.textEncoding,
      paperWidthChars: config.paperWidthChars
    })
  )
}

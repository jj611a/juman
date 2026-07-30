import type { HardwareStationConfig, PrintStatus } from '../../shared/hardware'
import { buildDrawerOpen } from './printers/escpos'
import { printReceiptRaw } from './printers/receipt'

/** Cash drawer opens through the configured receipt printer kick pulse. */
export async function openCashDrawer(config: HardwareStationConfig): Promise<PrintStatus> {
  return printReceiptRaw(config, buildDrawerOpen(config.drawerOpenCode))
}
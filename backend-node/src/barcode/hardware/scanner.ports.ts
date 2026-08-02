/**
 * Future hardware ports ? design only. No implementations in Phase 3.5.
 * Inventory/Electron will inject adapters later.
 */

export interface UsbScannerPort {
  readonly kind: 'usb_scanner';
  open(): Promise<void>;
  close(): Promise<void>;
  onScan(handler: (payload: { value: string; raw?: string }) => void): void;
}

export interface KeyboardWedgeScannerPort {
  readonly kind: 'keyboard_wedge';
  /** Accumulate key events until terminator (Enter). */
  pushKey(key: string): string | null;
}

export interface CameraScannerPort {
  readonly kind: 'camera_scanner';
  scanFrame(imageBytes: Uint8Array): Promise<{ value: string; typeHint?: string } | null>;
}

export interface ThermalLabelPrinterPort {
  readonly kind: 'thermal_label_printer';
  printBarcode(input: {
    value: string;
    type: string;
    labelTemplateId?: string;
  }): Promise<void>;
}

export type BarcodeHardwarePort =
  | UsbScannerPort
  | KeyboardWedgeScannerPort
  | CameraScannerPort
  | ThermalLabelPrinterPort;

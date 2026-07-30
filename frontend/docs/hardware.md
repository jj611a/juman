# Hardware integration (Phase 6.1 — complete)

Station-local desktop hardware for Juman Electron. **No vendor SDKs.** Backend owns barcode strings and media storage only. Renderer never opens sockets.

## Architecture

| Concern | Owner |
|---------|--------|
| HID keyboard-wedge scan detection | Main (`before-input-event` + gap detector) + `BarcodeScannerField` focus |
| ESC/POS receipt / label / drawer | Main `PrintService` → USB spool or TCP :9100 |
| Network ESC/POS | TCP raw send + probe; saved network targets in station config |
| Camera preview / capture | Renderer `getUserMedia` (honors `cameraDeviceId`); Main grants `media` |
| Printer selection | `userData/hardware-station.json` (not backend settings) |

## Supported connection methods

- **USB** — Windows Win32 printer spool (`copy /b` RAW)
- **Network** — TCP/IP ESC/POS (default port **9100**), connect timeout, probe, test print
- Multiple **saved network targets** + active/default selection
- Paper width `32|42|48` and text encoding `utf8|windows-1256`

## IPC (`window.juman.hardware`)

- `getConfig` / `setConfig`
- `listPrinters` / `probePrinter` / `diagnostics`
- `testReceipt` / `previewLabel` / `printLabel` / `openDrawer`
- `cameraCapabilities`
- `onScan(listener)` — HID wedge events
- `backendStatus` / `startBackend` / `openLogs` — diagnose `JumanApi` service only

## UI

- **الأجهزة** — `/hardware` (`settings.view` / `settings.update` to mutate)
- **تشخيص الأجهزة** — `/hardware/diagnostics` (`settings.view`; run tests without save)
- `BarcodeScannerField` — auto-focus + scan events + manual Enter
- `BarcodeDisplay` — optional `printable` → preview → print label
- `CameraCapture` — dress/customer photos; deviceId from station config

## Error codes (Main)

`CONNECTION_TIMEOUT`, `CONNECTION_REFUSED`, `PRINTER_OFFLINE`, `PRINTER_UNAVAILABLE`, `UNKNOWN_DEVICE`, `HOST_NOT_CONFIGURED`, `PRINTER_NOT_SELECTED`

## Tests

- `tests/unit/hardware-escpos-scan.test.ts` — gap detector, ESC/POS, TCP mocks, PrintService routing, config migration
- `tests/unit/hardware-page.test.tsx` — settings + diagnostics UI
- CI does not require physical USB/Ethernet devices

## Known limitations

- USB printing is **Windows-only**
- No vendor SDKs / fiscal layouts / POS ticket templates
- Paper-end / firmware model only when OS enumeration exposes status — not invented
- Cloud auto-update remains intentionally unimplemented (out of hardware scope)
- Label jobs use an explicit USB label printer when set; otherwise follow receipt transport

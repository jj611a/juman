/** ESC/POS command builders — vendor-agnostic raw bytes. */

import iconv from 'iconv-lite'
import type { PaperWidthChars, TextEncoding } from '../../../shared/hardware'

const ESC = 0x1b
const GS = 0x1d

export type EscposTextOptions = {
  encoding?: TextEncoding
  paperWidthChars?: PaperWidthChars
}

export function escposInit(): Buffer {
  return Buffer.from([ESC, 0x40])
}

export function escposAlign(center: boolean): Buffer {
  return Buffer.from([ESC, 0x61, center ? 1 : 0])
}

export function wrapEscposLines(text: string, width: PaperWidthChars): string[] {
  const w = width
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }
    let rest = paragraph
    while (rest.length > w) {
      lines.push(rest.slice(0, w))
      rest = rest.slice(w)
    }
    lines.push(rest)
  }
  return lines
}

export function encodeEscposText(text: string, encoding: TextEncoding = 'utf8'): Buffer {
  if (encoding === 'windows-1256') {
    return iconv.encode(`${text}\n`, 'windows-1256')
  }
  return Buffer.from(`${text}\n`, 'utf8')
}

export function escposText(text: string, options: EscposTextOptions = {}): Buffer {
  const encoding = options.encoding ?? 'utf8'
  const width = options.paperWidthChars
  if (width) {
    const chunks = wrapEscposLines(text, width).map((line) => encodeEscposText(line, encoding))
    return Buffer.concat(chunks)
  }
  return encodeEscposText(text, encoding)
}

export function escposFeed(lines = 2): Buffer {
  return Buffer.from([ESC, 0x64, Math.max(0, Math.min(255, lines))])
}

export function escposCut(): Buffer {
  return Buffer.from([GS, 0x56, 0x00])
}

export function escposDrawerPulse(pin: 'pulse2' | 'pulse5' = 'pulse2'): Buffer {
  const m = pin === 'pulse5' ? 1 : 0
  return Buffer.from([ESC, 0x70, m, 0x19, 0xfa])
}

export function escposBarcodeCode128(data: string): Buffer {
  const body = Buffer.from(data, 'ascii')
  const header = Buffer.from([GS, 0x6b, 0x49, body.length + 2, 0x7b, 0x42])
  return Buffer.concat([header, body, Buffer.from([0x00])])
}

export function escposSetBarcodeHeight(dots = 80): Buffer {
  return Buffer.from([GS, 0x68, Math.max(1, Math.min(255, dots))])
}

export function escposSetBarcodeWidth(width = 2): Buffer {
  return Buffer.from([GS, 0x77, Math.max(2, Math.min(6, width))])
}

export function escposHriPosition(below = true): Buffer {
  return Buffer.from([GS, 0x48, below ? 2 : 0])
}

export function buildTestReceipt(
  stationName = 'Juman',
  options: EscposTextOptions = {}
): Buffer {
  const textOpts = {
    encoding: options.encoding ?? 'utf8',
    paperWidthChars: options.paperWidthChars ?? 42
  } satisfies EscposTextOptions
  return Buffer.concat([
    escposInit(),
    escposAlign(true),
    escposText(stationName, textOpts),
    escposText('Receipt printer test', textOpts),
    escposText(new Date().toISOString(), textOpts),
    escposFeed(3),
    escposCut()
  ])
}

export function buildBarcodeLabel(
  barcode: string,
  title?: string | null,
  options: EscposTextOptions = {}
): Buffer {
  const textOpts = {
    encoding: options.encoding ?? 'utf8',
    paperWidthChars: options.paperWidthChars ?? 42
  } satisfies EscposTextOptions
  const parts: Buffer[] = [escposInit(), escposAlign(true)]
  if (title) parts.push(escposText(title, textOpts))
  parts.push(
    escposSetBarcodeHeight(80),
    escposSetBarcodeWidth(2),
    escposHriPosition(true),
    escposBarcodeCode128(barcode),
    escposFeed(2),
    escposText(barcode, textOpts),
    escposFeed(2),
    escposCut()
  )
  return Buffer.concat(parts)
}

export function buildDrawerOpen(pin: 'pulse2' | 'pulse5' = 'pulse2'): Buffer {
  return Buffer.concat([escposInit(), escposDrawerPulse(pin)])
}

export function buildLabelPreviewSvg(barcode: string, title?: string | null): string {
  const safe = barcode.replace(/[<>&"]/g, '')
  const titleLine = title
    ? `<text x="160" y="28" text-anchor="middle" font-size="14" fill="#e8e4dc">${title.replace(/[<>&"]/g, '')}</text>`
    : ''
  const bars = Array.from(safe)
    .map((ch, i) => {
      const w = 1 + (ch.charCodeAt(0) % 3)
      return `<rect x="${40 + i * 6}" y="40" width="${w}" height="60" fill="#111"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140" viewBox="0 0 320 140"><rect width="320" height="140" fill="#f7f4ee"/>${titleLine}${bars}<text x="160" y="125" text-anchor="middle" font-size="12" font-family="monospace" fill="#111">${safe}</text></svg>`
}

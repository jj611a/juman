/**
 * Timing-based HID keyboard-wedge scan detector (pure; unit-testable).
 */

export type ScanDetectorOptions = {
  maxGapMs: number
  minLength: number
}

export class ScanGapDetector {
  private buffer = ''
  private lastAt = 0

  constructor(private options: ScanDetectorOptions) {}

  reset(): void {
    this.buffer = ''
    this.lastAt = 0
  }

  setOptions(options: Partial<ScanDetectorOptions>): void {
    this.options = { ...this.options, ...options }
  }

  push(key: string, now = Date.now()): string | null {
    const isTerminator = key === 'Enter' || key === '\n' || key === '\r'
    if (isTerminator) {
      const value = this.buffer
      this.reset()
      if (value.length >= this.options.minLength) return value
      return null
    }

    if (key.length !== 1) return null

    if (this.lastAt && now - this.lastAt > this.options.maxGapMs) {
      this.buffer = ''
    }
    this.buffer += key
    this.lastAt = now
    return null
  }
}
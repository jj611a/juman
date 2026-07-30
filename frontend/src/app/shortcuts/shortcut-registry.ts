export type ShortcutHandler = (event: KeyboardEvent) => void

export interface ShortcutBinding {
  id: string
  /** e.g. 'Control+b' or 'Meta+k' — matched case-insensitively on key */
  combo: string
  handler: ShortcutHandler
  enabled?: boolean
}

function normalizeCombo(combo: string): string {
  return combo
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .sort()
    .join('+')
}

function eventCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push(e.metaKey ? 'meta' : 'control')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.key.toLowerCase())
  return parts.sort().join('+')
}

export class ShortcutRegistry {
  private bindings = new Map<string, ShortcutBinding>()

  register(binding: ShortcutBinding): () => void {
    this.bindings.set(binding.id, binding)
    return () => this.bindings.delete(binding.id)
  }

  handle(event: KeyboardEvent): void {
    const combo = eventCombo(event)
    for (const binding of this.bindings.values()) {
      if (binding.enabled === false) continue
      const target = normalizeCombo(binding.combo.replace(/ctrl/gi, 'control').replace(/cmd/gi, 'meta'))
      // Allow Control+b to match Meta+b on mac by registering both or matching control/meta interchangeably
      const alt = normalizeCombo(
        binding.combo
          .replace(/ctrl/gi, 'control')
          .replace(/cmd/gi, 'meta')
          .replace(/control/gi, 'meta')
      )
      if (combo === target || combo === alt || this.looseMatch(combo, binding.combo)) {
        event.preventDefault()
        binding.handler(event)
        return
      }
    }
  }

  private looseMatch(eventComboStr: string, bindingCombo: string): boolean {
    const want = bindingCombo.toLowerCase().split('+').map((s) => s.trim())
    const hasMod = want.some((w) => w === 'control' || w === 'ctrl' || w === 'meta' || w === 'cmd')
    const key = want.find((w) => !['control', 'ctrl', 'meta', 'cmd', 'alt', 'shift'].includes(w))
    if (!key) return false
    const parts = eventComboStr.split('+')
    const keyOk = parts.includes(key)
    const modOk = !hasMod || parts.includes('control') || parts.includes('meta')
    return keyOk && modOk
  }
}

export const shortcutRegistry = new ShortcutRegistry()

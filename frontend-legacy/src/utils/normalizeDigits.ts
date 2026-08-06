/** Western Arabic digits 0-9 mapped from Arabic-Indic digits. */
const ARABIC_INDIC = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"
const EASTERN_ARABIC = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"

/**
 * Normalize editable numeric input for storage/validation:
 * - Arabic-Indic / Eastern Arabic-Indic digits -> Western 0-9
 * - Arabic decimal separator (U+066B) and comma -> "."
 * Does not add thousands separators (display-only concern).
 */
export function normalizeDigits(raw: string): string {
  let out = ""
  for (const ch of raw) {
    const ai = ARABIC_INDIC.indexOf(ch)
    if (ai >= 0) {
      out += String(ai)
      continue
    }
    const ea = EASTERN_ARABIC.indexOf(ch)
    if (ea >= 0) {
      out += String(ea)
      continue
    }
    if (ch === "," || ch === "\u066B") {
      out += "."
      continue
    }
    out += ch
  }
  return out
}

/** Strip to a safe numeric editable string (optional leading -, digits, one decimal). */
export function sanitizeNumericInput(raw: string): string {
  const n = normalizeDigits(raw)
  let result = ""
  let seenDot = false
  let seenSign = false
  for (const ch of n) {
    if (ch === "-" && !seenSign && result.length === 0) {
      result += ch
      seenSign = true
      continue
    }
    if (ch >= "0" && ch <= "9") {
      result += ch
      seenSign = true
      continue
    }
    if (ch === "." && !seenDot) {
      result += ch
      seenDot = true
      seenSign = true
    }
  }
  return result
}

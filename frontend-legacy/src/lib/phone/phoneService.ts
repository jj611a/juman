/** Iraqi mobile prefixes after country code (without leading 0). */
const IQ_MOBILE_PREFIXES = ['770', '771', '772', '773', '774', '775', '776', '777', '778', '779', '780', '781', '782', '783', '784', '785', '786', '787', '788', '789'] as const

export type PhoneNormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; error: string }

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Normalize user input to canonical E.164 (+964…).
 * Accepts 07…, 7…, 964…, +964…
 */
export function normalize(raw: string): PhoneNormalizeResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'empty' }

  let digits = digitsOnly(trimmed)
  if (digits.startsWith('00964')) digits = digits.slice(5)
  else if (digits.startsWith('964')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)

  // Expect 10-digit national mobile: 7xxxxxxxxx
  if (digits.length !== 10) {
    return { ok: false, error: 'invalid_length' }
  }
  if (!digits.startsWith('7')) {
    return { ok: false, error: 'not_mobile' }
  }
  const prefix = digits.slice(0, 3)
  if (!(IQ_MOBILE_PREFIXES as readonly string[]).includes(prefix)) {
    return { ok: false, error: 'invalid_prefix' }
  }
  return { ok: true, e164: `+964${digits}` }
}

export function validate(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined || raw.trim() === '') return false
  return normalize(raw).ok
}

/** Format E.164 for friendly editing display: +964 770 123 4567 */
export function format(e164: string | null | undefined): string {
  if (!e164) return ''
  const result = normalize(e164)
  if (!result.ok) return e164
  const national = result.e164.slice(4) // drop +964
  return `+964 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
}

export const PhoneService = { normalize, format, validate }

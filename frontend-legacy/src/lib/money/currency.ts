export interface CurrencyMeta {
  code: string
  /** Minor units per major unit (IQD: 1000 fils = 1 IQD). */
  minorUnits: number
  /** Display decimals for major unit. */
  decimals: number
  symbol: string
}

export const IQD: CurrencyMeta = {
  code: 'IQD',
  minorUnits: 1000,
  decimals: 3,
  symbol: 'د.ع'
}

/** Convert integer minor units (fils) to editable major-unit display string. */
export function filsToDisplay(fils: number | null | undefined, meta: CurrencyMeta = IQD): string {
  if (fils === null || fils === undefined || Number.isNaN(fils)) return ''
  const sign = fils < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(fils))
  const major = Math.floor(abs / meta.minorUnits)
  const frac = abs % meta.minorUnits
  const fracStr = String(frac).padStart(meta.decimals, '0')
  return `${sign}${major}.${fracStr}`
}

/**
 * Parse a major-unit display string into integer fils.
 * Uses integer arithmetic only after digit normalization.
 */
export function displayToFils(raw: string, meta: CurrencyMeta = IQD): number | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '-' || trimmed === '.') return null
  const negative = trimmed.startsWith('-')
  const body = negative ? trimmed.slice(1) : trimmed
  const [wholePart = '0', fracPart = ''] = body.split('.')
  const whole = wholePart.replace(/\D/g, '') || '0'
  const fracPadded = (fracPart.replace(/\D/g, '') + '0'.repeat(meta.decimals)).slice(0, meta.decimals)
  const major = BigInt(whole)
  const frac = BigInt(fracPadded || '0')
  const scale = BigInt(meta.minorUnits)
  let fils = major * scale + frac
  if (negative) fils = -fils
  const asNumber = Number(fils)
  if (!Number.isSafeInteger(asNumber)) {
    throw new RangeError('Amount exceeds safe integer range')
  }
  return asNumber
}

/** Format fils for display with currency code (not for editing). */
export function formatMoney(fils: number, meta: CurrencyMeta = IQD): string {
  return `${filsToDisplay(fils, meta)} ${meta.symbol}`
}

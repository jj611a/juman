import { describe, expect, it } from 'vitest'
import { PhoneService } from '@/lib/phone/phoneService'

describe('PhoneService', () => {
  it('normalizes common Iraqi mobile inputs to E.164', () => {
    expect(PhoneService.normalize('07701234567')).toEqual({ ok: true, e164: '+9647701234567' })
    expect(PhoneService.normalize('7701234567')).toEqual({ ok: true, e164: '+9647701234567' })
    expect(PhoneService.normalize('+9647701234567')).toEqual({ ok: true, e164: '+9647701234567' })
    expect(PhoneService.normalize('+964 770 123 4567')).toEqual({ ok: true, e164: '+9647701234567' })
  })

  it('rejects invalid lengths and landlines', () => {
    expect(PhoneService.normalize('01').ok).toBe(false)
    expect(PhoneService.normalize('0123456789').ok).toBe(false)
  })

  it('formats for display', () => {
    expect(PhoneService.format('+9647701234567')).toBe('+964 770 123 4567')
  })
})

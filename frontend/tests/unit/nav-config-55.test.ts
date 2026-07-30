import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config reservations/rentals', () => {
  it('enables reservations and rentals with correct permission keys', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    const reservations = main!.items.find((i) => i.id === 'reservations')
    const rentals = main!.items.find((i) => i.id === 'rentals')
    expect(reservations?.href).toBe('/reservations')
    expect(reservations?.permission).toBe('reservation.view')
    expect(reservations?.disabled).toBeFalsy()
    expect(rentals?.href).toBe('/rentals')
    expect(rentals?.permission).toBe('rental.view')
    expect(rentals?.disabled).toBeFalsy()
  })
})

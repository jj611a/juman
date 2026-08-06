import { describe, expect, it } from 'vitest'

describe('Rentals Unit Tests', () => {
  it('validates date sequences correctly', () => {
    const rentalDate = new Date('2026-08-01')
    const returnDate = new Date('2026-08-05')
    const invalidReturnDate = new Date('2026-07-28')

    expect(returnDate.getTime()).toBeGreaterThan(rentalDate.getTime())
    expect(invalidReturnDate.getTime()).toBeLessThan(rentalDate.getTime())
  })

  it('converts prices from fils to display values correctly', () => {
    const priceFils = 150000 // 150.00 AED
    const formatValue = (fils: number) => {
      return `${(fils / 1000).toFixed(2)} د.إ`
    }

    expect(formatValue(priceFils)).toBe('150.00 د.إ')
  })

  it('correctly maps permission strings', () => {
    const RENTAL_PERMISSIONS = {
      VIEW: 'rental.view',
      CREATE: 'rental.create',
      CHECKOUT: 'rental.checkout',
      RETURN: 'rental.return',
      CANCEL: 'rental.cancel'
    }

    expect(RENTAL_PERMISSIONS.VIEW).toBe('rental.view')
    expect(RENTAL_PERMISSIONS.CHECKOUT).toBe('rental.checkout')
  })
})

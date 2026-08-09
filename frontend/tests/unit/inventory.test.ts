import { describe, expect, it } from 'vitest'
import {
  STATUS_LABELS,
  CONDITION_LABELS,
  LIFECYCLE_LABELS,
  LIFECYCLE_TRANSITIONS,
  LIFECYCLE_BADGE,
  STATUS_BADGE,
  CONDITION_BADGE,
  formatFils,
  formatDate,
  formatDateTime,
} from '@/features/inventory/constants/inventory'
import {
  ITEM_LIFECYCLE_VALUES,
  ITEM_STATUS_VALUES,
  ITEM_CONDITION_VALUES,
} from '@/features/inventory/api/api'

describe('Inventory Catalog Module', () => {
  describe('Enum label maps', () => {
    it('STATUS_LABELS covers every backend status value', () => {
      for (const v of ITEM_STATUS_VALUES) {
        expect(STATUS_LABELS[v]).toBeTruthy()
        expect(STATUS_BADGE[v]).toBeTruthy()
      }
    })

    it('CONDITION_LABELS covers every backend condition value', () => {
      for (const v of ITEM_CONDITION_VALUES) {
        expect(CONDITION_LABELS[v]).toBeTruthy()
        expect(CONDITION_BADGE[v]).toBeTruthy()
      }
    })

    it('LIFECYCLE_LABELS covers every backend lifecycle value', () => {
      for (const v of ITEM_LIFECYCLE_VALUES) {
        expect(LIFECYCLE_LABELS[v]).toBeTruthy()
        expect(LIFECYCLE_BADGE[v]).toBeTruthy()
      }
    })
  })

  describe('Lifecycle transition map (mirrors backend ITEM_LIFECYCLE_TRANSITIONS)', () => {
    const expected: Record<string, string[]> = {
      available: ['reserved', 'for_sale', 'maintenance', 'retired', 'lost', 'damaged'],
      reserved: ['available', 'rented', 'lost', 'damaged'],
      rented: ['return_pending', 'lost', 'damaged'],
      return_pending: ['inspection', 'lost', 'damaged'],
      inspection: ['cleaning', 'maintenance', 'available', 'damaged', 'retired'],
      cleaning: ['available', 'maintenance'],
      maintenance: ['available', 'retired', 'damaged'],
      for_sale: ['available', 'sold', 'retired', 'lost', 'damaged'],
      sold: ['retired'],
      retired: [],
      lost: ['available', 'retired'],
      damaged: ['maintenance', 'retired'],
    }

    it('contains exactly the allowed targets per source state', () => {
      for (const [from, targets] of Object.entries(expected)) {
        expect([...(LIFECYCLE_TRANSITIONS[from as keyof typeof LIFECYCLE_TRANSITIONS] ?? [])]).toEqual(
          expect.arrayContaining(targets),
        )
        expect(LIFECYCLE_TRANSITIONS[from as keyof typeof LIFECYCLE_TRANSITIONS]?.length).toBe(targets.length)
      }
    })

    it('retired is a terminal state with no allowed targets', () => {
      expect(LIFECYCLE_TRANSITIONS.retired).toEqual([])
    })

    it('defines a map for every lifecycle value', () => {
      for (const v of ITEM_LIFECYCLE_VALUES) {
        expect(Array.isArray(LIFECYCLE_TRANSITIONS[v])).toBe(true)
      }
    })
  })

  describe('formatFils (integer fils → AED)', () => {
    it('formats positive values as AED with 2 decimals', () => {
      expect(formatFils(123450)).toBe('123.45 د.إ')
    })

    it('renders em-dash for null/undefined', () => {
      expect(formatFils(null)).toBe('—')
      expect(formatFils(undefined)).toBe('—')
    })

    it('handles zero', () => {
      expect(formatFils(0)).toBe('0 د.إ')
    })
  })

  describe('Date formatting', () => {
    it('formatDate returns em-dash for missing/empty input', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate('')).toBe('—')
    })

    it('formatDateTime returns em-dash for invalid input', () => {
      expect(formatDateTime('not-a-date')).toBe('—')
    })

    it('formatDateTime renders a valid ISO string', () => {
      expect(formatDateTime('2026-08-08T10:30:00.000Z')).not.toBe('—')
    })
  })

  describe('Form validation logic', () => {
    const validatePrice = (price: string) => {
      const num = Number(price)
      if (price.trim() && (isNaN(num) || num < 0)) return 'السعر غير صالح'
      return null
    }

    it('rejects negative and non-numeric prices', () => {
      expect(validatePrice('-100')).toBe('السعر غير صالح')
      expect(validatePrice('abc')).toBe('السعر غير صالح')
    })

    it('accepts valid decimals', () => {
      expect(validatePrice('450.50')).toBeNull()
      expect(validatePrice('')).toBeNull()
    })

    it('validates displayName is not empty', () => {
      const validateDisplayName = (name: string) => name.trim().length > 0
      expect(validateDisplayName('')).toBe(false)
      expect(validateDisplayName(' فستان عروس ملكي ')).toBe(true)
    })
  })
})

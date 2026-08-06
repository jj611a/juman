import { describe, expect, it } from 'vitest'
import { mapDressStatusToTransition } from '@/services/v2/legacyBridge'

describe('mapDressStatusToTransition Nest lowercase', () => {
  it('maps legacy and Nest UI codes to ITEM_LIFECYCLE tokens', () => {
    expect(mapDressStatusToTransition('AVAILABLE')).toBe('available')
    expect(mapDressStatusToTransition('RETURN_PENDING')).toBe('return_pending')
    expect(mapDressStatusToTransition('FOR_SALE')).toBe('for_sale')
    expect(mapDressStatusToTransition('CLEANING')).toBe('cleaning')
    expect(mapDressStatusToTransition('MAINTENANCE')).toBe('maintenance')
    expect(mapDressStatusToTransition('DAMAGED')).toBe('damaged')
  })
})

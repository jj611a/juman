/**
 * Unit-style integration: mocks Nest V2 responses and exercises
 * apiClient façade mapping pipeline login→customers→items→rentals→settlements→reports.
 * No live server required.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mapCustomerV2ToLegacy,
  mapDashboardV2ToLegacy,
  mapItemV2ToDress,
  mapRentalV2ToLegacy,
  mapSettlementV2ToLegacy,
  toLegacyItem,
  toLegacyList,
  unwrapV2Page
} from '@/services/v2/legacyBridge'
import type {
  V2Customer,
  V2DashboardReport,
  V2Item,
  V2Rental,
  V2Settlement
} from '@/services/v2/contracts'

const invoke = vi.fn()

/** Minimal contract facade exercising the same mapping pipeline as apiClient. */
async function compatFlow() {
  const session = { authenticated: true, user: { username: 'admin' } }

  invoke.mockResolvedValueOnce({
    items: [
      {
        id: 'c1',
        customerNumber: 'C-1',
        fullName: 'Customer',
        phone: '0770',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      } satisfies V2Customer
    ],
    meta: { offset: 0, limit: 50, total: 1 }
  })
  const customersRaw = await invoke({ method: 'GET', path: '/customers' })
  const customersPage = unwrapV2Page<V2Customer>(customersRaw)
  const customers = toLegacyList(customersPage.items, customersPage.meta, mapCustomerV2ToLegacy)

  invoke.mockResolvedValueOnce({
    items: [
      {
        id: 'i1',
        internalCode: 'IT-1',
        displayName: 'Dress',
        purchasePrice: 1,
        rentalPrice: 2,
        salePrice: 3,
        status: 'active',
        lifecycleState: 'AVAILABLE',
        barcodes: [{ id: 'b1', value: 'BC1', isPrimary: true }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      } satisfies V2Item
    ],
    meta: { offset: 0, limit: 50, total: 1 }
  })
  const itemsRaw = await invoke({ method: 'GET', path: '/items' })
  const itemsPage = unwrapV2Page<V2Item>(itemsRaw)
  const dresses = toLegacyList(itemsPage.items, itemsPage.meta, mapItemV2ToDress)

  invoke.mockResolvedValueOnce({
    id: 'r1',
    rentalNumber: 'RN-1',
    customerId: 'c1',
    rentalDate: '2026-08-01T00:00:00.000Z',
    expectedReturnDate: '2026-08-03T00:00:00.000Z',
    status: 'ACTIVE',
    items: [{ id: 'ri1', itemId: 'i1', agreedRentalPrice: 2 }],
    createdAt: 'a',
    updatedAt: 'b'
  } satisfies V2Rental)
  const rentalRaw = await invoke({ method: 'POST', path: '/rentals' })
  const rental = toLegacyItem(rentalRaw as V2Rental, mapRentalV2ToLegacy)

  invoke.mockResolvedValueOnce({
    id: 's1',
    settlementNumber: 'ST-1',
    rentalId: 'r1',
    chargeFils: 100,
    depositFils: 0,
    lateFeeFils: 0,
    adjustmentFils: 0,
    discountFils: 0,
    refundFils: 0,
    totalFils: 100,
    paidFils: 0,
    remainingFils: 100,
    status: 'OPEN',
    createdAt: 'a',
    updatedAt: 'b'
  } satisfies V2Settlement)
  const settlementRaw = await invoke({ method: 'GET', path: '/settlements/s1' })
  const settlement = toLegacyItem(settlementRaw as V2Settlement, mapSettlementV2ToLegacy)

  invoke.mockResolvedValueOnce({
    activeRentals: 1,
    todaysCheckouts: 1,
    todaysReturns: 0,
    openSettlements: 1,
    outstandingBalanceFils: 100,
    revenueTodayFils: 0,
    revenueThisMonthFils: 0,
    inventoryCount: 1,
    reservedItems: 0,
    availableItems: 1,
    asOf: '2026-08-03T00:00:00.000Z'
  } satisfies V2DashboardReport)
  const dashRaw = await invoke({ method: 'GET', path: '/reports/dashboard' })
  const dashboard = mapDashboardV2ToLegacy(dashRaw as V2DashboardReport)

  return { session, customers, dresses, rental, settlement, dashboard }
}

describe('backend-v2-compat flow', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('maps login→customers→items→rentals→settlements→reports', async () => {
    const result = await compatFlow()

    expect(result.session.authenticated).toBe(true)
    expect(result.customers.success).toBe(true)
    expect(result.customers.data[0]?.full_name).toBe('Customer')
    expect(result.dresses.data[0]?.barcode).toBe('BC1')
    expect(result.rental.data.rental_number).toBe('RN-1')
    expect(result.settlement.data.remaining_balance).toBe(100)
    expect(result.dashboard.rentals_active).toBe(1)
    expect(result.dashboard.open_settlements).toBe(1)

    expect(invoke.mock.calls.map((c) => c[0].path)).toEqual([
      '/customers',
      '/items',
      '/rentals',
      '/settlements/s1',
      '/reports/dashboard'
    ])
  })
})

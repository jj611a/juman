import { describe, expect, it } from 'vitest'
import {
  bridgeListQuery,
  bridgeTaxonomyListQuery,
  dressListQuery,
  mapCategoryV2ToLegacy,
  mapCustomerBodyToV2,
  mapCustomerV2ToLegacy,
  mapDashboardV2ToLegacy,
  mapDressBodyToItemV2,
  mapDressStatusToTransition,
  mapFinancialV2ToLegacy,
  mapItemV2ToDress,
  mapRentalBodyToV2,
  mapRentalV2ToLegacy,
  mapReservationBodyToV2,
  mapReservationV2ToLegacy,
  mapSettlementPaymentBodyToV2,
  mapSettlementV2ToLegacy,
  toLegacyItem,
  toLegacyList,
  toLegacyMessage,
  unwrapV2Page
} from '@/services/v2/legacyBridge'
import { v2Unsupported } from '@/services/v2/unsupported'
import type { V2Customer, V2Item, V2Settlement } from '@/services/v2/contracts'

describe('v2 legacyBridge envelopes', () => {
  it('toLegacyList / toLegacyItem / toLegacyMessage', () => {
    const list = toLegacyList([1, 2], { offset: 0, limit: 10, total: 2 }, (n) => n * 2)
    expect(list).toEqual({
      success: true,
      data: [2, 4],
      meta: { offset: 0, limit: 10, total: 2 }
    })
    expect(toLegacyItem({ a: 1 }, (x) => x.a)).toEqual({ success: true, data: 1 })
    expect(toLegacyMessage()).toEqual({ success: true, message: 'ok' })
  })

  it('bridgeListQuery maps active_only / sort keys to Nest camelCase', () => {
    expect(bridgeListQuery({ active_only: true, sort_by: 'full_name', sort_dir: 'asc', q: 'x' })).toEqual({
      status: 'active',
      sortBy: 'fullName',
      sortDir: 'asc',
      q: 'x'
    })
  })

  it('bridgeListQuery converts page/page_size to offset/limit', () => {
    expect(bridgeListQuery({ page: 2, page_size: 25, sort_by: 'created_at' })).toEqual({
      offset: 25,
      limit: 25,
      sortBy: 'createdAt'
    })
  })

  it('bridgeTaxonomyListQuery strips status and sort', () => {
    expect(
      bridgeTaxonomyListQuery({
        q: 'a',
        active_only: true,
        sort_by: 'display_order',
        sort_dir: 'asc',
        offset: 0,
        limit: 20
      })
    ).toEqual({ q: 'a', offset: 0, limit: 20 })
  })

  it('dressListQuery converts page to offset/limit', () => {
    expect(dressListQuery({ page: 2, page_size: 25, q: 'dress' })).toEqual({
      q: 'dress',
      offset: 25,
      limit: 25
    })
  })
})

describe('v2 domain mappers', () => {
  it('maps customer V2 → legacy snake_case', () => {
    const c: V2Customer = {
      id: 'c1',
      customerNumber: 'C-001',
      fullName: 'Ali',
      phone: '0770',
      secondaryPhone: '0780',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    }
    expect(mapCustomerV2ToLegacy(c)).toMatchObject({
      customer_number: 'C-001',
      full_name: 'Ali',
      alternative_phone: '0780',
      is_active: true
    })
  })

  it('maps customer create body accepting snake or camel', () => {
    expect(mapCustomerBodyToV2({ full_name: 'Sara', phone: '1', alternative_phone: '2' })).toEqual({
      fullName: 'Sara',
      phone: '1',
      secondaryPhone: '2'
    })
    expect(mapCustomerBodyToV2({ fullName: 'Sara', phone: '1', is_active: false })).toMatchObject({
      fullName: 'Sara',
      status: 'inactive'
    })
  })

  it('maps category name → name_ar', () => {
    expect(
      mapCategoryV2ToLegacy({
        id: 'cat1',
        name: 'فساتين',
        nameEn: 'Dresses',
        sortOrder: 3,
        isActive: true,
        createdAt: 'a',
        updatedAt: 'b'
      })
    ).toMatchObject({ name_ar: 'فساتين', name_en: 'Dresses', display_order: 3 })
  })

  it('maps item → DressDto-ish fields', () => {
    const item: V2Item = {
      id: 'i1',
      internalCode: 'IT-1',
      displayName: 'فستان أحمر',
      purchasePrice: 1000,
      rentalPrice: 50,
      salePrice: 800,
      status: 'active',
      lifecycleState: 'AVAILABLE',
      category: { id: 'c1', name: 'Evening' },
      brand: { id: 'b1', name: 'BrandX' },
      color: { id: 'col1', name: 'Red' },
      size: { id: 's1', name: 'M' },
      barcodes: [{ id: 'bc1', value: 'BC123', isPrimary: true }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    const dress = mapItemV2ToDress(item)
    expect(dress).toMatchObject({
      barcode: 'BC123',
      name_ar: 'فستان أحمر',
      category_id: 'c1',
      brand: 'BrandX',
      colour: 'Red',
      size: 'M',
      default_daily_rental_price: 50,
      status: 'AVAILABLE',
      is_active: true
    })
  })

  it('maps dress body and status transition', () => {
    expect(
      mapDressBodyToItemV2({
        category_id: 'c1',
        name_ar: 'X',
        size: 'M',
        colour: 'Red',
        purchase_price: 1,
        default_daily_rental_price: 2,
        default_sale_price: 3
      })
    ).toMatchObject({
      displayName: 'X',
      categoryId: 'c1',
      rentalPrice: 2,
      salePrice: 3
    })
    expect(mapDressBodyToItemV2({ name_ar: 'Y', barcode: '' })).toMatchObject({
      displayName: 'Y',
      generateBarcode: true
    })
    expect(mapDressBodyToItemV2({ name_ar: 'Y', barcode: null })).toMatchObject({
      displayName: 'Y',
      generateBarcode: true
    })
    expect(mapDressStatusToTransition('RENTED')).toBe('rented')
    expect(mapDressStatusToTransition('INSPECTION')).toBe('inspection')
    expect(mapDressStatusToTransition('PROCESSING')).toBe('cleaning')
    expect(mapDressStatusToTransition('RUINED')).toBe('retired')
  })

  it('maps reservation / rental bodies and entities', () => {
    const resBody = mapReservationBodyToV2({
      customer_id: 'c1',
      rental_start_at: '2026-08-01',
      expected_return_at: '2026-08-03',
      items: [{ dress_id: 'i1', reserved_daily_rental_price: 10 }]
    })
    expect(resBody).toMatchObject({
      customerId: 'c1',
      expectedCheckoutDate: '2026-08-01',
      expectedReturnDate: '2026-08-03',
      items: [{ itemId: 'i1', agreedRentalPrice: 10 }]
    })

    const legacyRes = mapReservationV2ToLegacy({
      id: 'r1',
      reservationNumber: 'RSV-1',
      customerId: 'c1',
      startDate: '2026-08-01T00:00:00.000Z',
      expectedCheckoutDate: '2026-08-01T00:00:00.000Z',
      expectedReturnDate: '2026-08-03T00:00:00.000Z',
      status: 'CONFIRMED',
      items: [{ id: 'ri1', itemId: 'i1', agreedRentalPrice: 10 }],
      createdAt: 'a',
      updatedAt: 'b'
    })
    expect(legacyRes.items[0]?.dress_id).toBe('i1')

    expect(
      mapRentalBodyToV2({
        customer_id: 'c1',
        expected_return_at: '2026-08-05',
        initial_payment_type: 'FIXED_AMOUNT',
        items: [{ dress_id: 'i1' }]
      })
    ).toMatchObject({
      customerId: 'c1',
      items: [{ itemId: 'i1' }]
    })

    expect(
      mapRentalV2ToLegacy({
        id: 'rent1',
        rentalNumber: 'RN-1',
        customerId: 'c1',
        rentalDate: '2026-08-01T00:00:00.000Z',
        expectedReturnDate: '2026-08-05T00:00:00.000Z',
        status: 'ACTIVE',
        items: [{ id: 'li1', itemId: 'i1', agreedRentalPrice: 20 }],
        createdAt: 'a',
        updatedAt: 'b'
      }).items[0]?.dress_id
    ).toBe('i1')
  })

  it('maps settlement money fields and payment body', () => {
    const s: V2Settlement = {
      id: 's1',
      settlementNumber: 'ST-1',
      rentalId: 'rent1',
      chargeFils: 1000,
      depositFils: 100,
      lateFeeFils: 50,
      adjustmentFils: 0,
      discountFils: 0,
      refundFils: 0,
      totalFils: 950,
      paidFils: 200,
      remainingFils: 750,
      status: 'OPEN',
      adjustments: [{ id: 'a1', amountFils: 10, reason: 'x', createdAt: 't' }],
      createdAt: 'a',
      updatedAt: 'b'
    }
    const legacy = mapSettlementV2ToLegacy(s)
    expect(legacy).toMatchObject({
      settlement_number: 'ST-1',
      rental_charge_amount: 1000,
      total_due: 950,
      remaining_balance: 750
    })
    expect(mapSettlementPaymentBodyToV2({ amount: 100, payment_method: 'CASH' })).toEqual({
      amountFils: 100,
      method: 'CASH',
      notes: undefined,
      idempotencyKey: undefined
    })
    expect(mapSettlementV2ToLegacy({ ...s, status: 'open' }).status).toBe('OPEN')
    expect(mapSettlementV2ToLegacy({ ...s, status: 'partially_paid' }).status).toBe(
      'PARTIALLY_PAID'
    )
    expect(mapSettlementV2ToLegacy({ ...s, status: 'cancelled' }).status).toBe('VOIDED')
    expect(mapSettlementV2ToLegacy({ ...s, status: 'closed' }).status).toBe('PAID')
  })

  it('normalizes rental/reservation status case for StatusChip maps', () => {
    const reservation = mapReservationV2ToLegacy({
      id: 'r1',
      reservationNumber: 'RSV-1',
      customerId: 'c1',
      startDate: '2026-01-01',
      expectedCheckoutDate: '2026-01-02',
      expectedReturnDate: '2026-01-05',
      status: 'confirmed',
      items: [],
      createdAt: 'a',
      updatedAt: 'b'
    })
    expect(reservation.status).toBe('CONFIRMED')
    expect(
      mapReservationV2ToLegacy({
        ...{
          id: 'r1',
          reservationNumber: 'RSV-1',
          customerId: 'c1',
          startDate: '2026-01-01',
          expectedCheckoutDate: '2026-01-02',
          expectedReturnDate: '2026-01-05',
          status: 'checked_out',
          items: [],
          createdAt: 'a',
          updatedAt: 'b'
        }
      }).status
    ).toBe('CONVERTED_TO_RENTAL')

    expect(
      mapRentalV2ToLegacy({
        id: 'l1',
        rentalNumber: 'RNT-1',
        customerId: 'c1',
        rentalDate: '2026-01-01',
        expectedReturnDate: '2026-01-05',
        status: 'return_pending',
        items: [],
        createdAt: 'a',
        updatedAt: 'b'
      }).status
    ).toBe('RETURN_PENDING')
  })

  it('bridgeListQuery lowercases status for Nest validators', () => {
    expect(bridgeListQuery({ status: 'OPEN' })?.status).toBe('open')
    expect(bridgeListQuery({ status: 'PARTIALLY_PAID' })?.status).toBe('partially_paid')
    expect(bridgeListQuery({ status: 'RETURN_PENDING' })?.status).toBe('return_pending')
    expect(bridgeListQuery({ status: 'VOIDED' })?.status).toBe('cancelled')
  })

  it('maps dashboard and financial reports', () => {
    const dash = mapDashboardV2ToLegacy({
      activeRentals: 3,
      todaysCheckouts: 2,
      todaysReturns: 1,
      openSettlements: 4,
      outstandingBalanceFils: 500,
      revenueTodayFils: 100,
      revenueThisMonthFils: 900,
      inventoryCount: 20,
      reservedItems: 5,
      availableItems: 10,
      asOf: '2026-08-03T00:00:00.000Z'
    })
    expect(dash.rentals_active).toBe(3)
    expect(dash.dresses_total).toBe(20)
    expect(dash.dresses_by_status.AVAILABLE).toBe(10)
    expect(dash.open_settlements).toBe(4)

    const fin = mapFinancialV2ToLegacy({
      revenueFils: 1000,
      paymentsCount: 2,
      outstandingFils: 100,
      openSettlementsCount: 1,
      refundsFils: 0,
      refundsCount: 0,
      discountsFils: 0,
      discountsCount: 0,
      lateFeesFils: 10,
      lateFeesCount: 1,
      adjustmentsFils: 0,
      adjustmentsCount: 0,
      depositsFils: 50,
      depositsCount: 1,
      chargesFils: 900,
      chargesCount: 1
    })
    expect(fin.total_cash_collected).toBe(1000)
    expect(fin.rental_charges_gross).toBe(900)
  })

  it('unwrapV2Page accepts items or data envelopes', () => {
    expect(unwrapV2Page({ items: [{ id: 1 }], meta: { offset: 0, limit: 10, total: 1 } }).items).toHaveLength(
      1
    )
    expect(unwrapV2Page({ data: [{ id: 2 }], meta: { offset: 0, limit: 5, total: 1 } }).items[0]).toEqual({
      id: 2
    })
  })
})

describe('v2Unsupported', () => {
  it('throws AppError with V2_UNSUPPORTED', () => {
    expect(() => v2Unsupported('calendar')).toThrowError(/calendar/)
    try {
      v2Unsupported('sales')
    } catch (e) {
      expect(e).toMatchObject({ code: 'V2_UNSUPPORTED' })
    }
  })
})

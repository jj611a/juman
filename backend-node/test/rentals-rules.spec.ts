import { describe, expect, it } from 'vitest';
import {
  RENTAL_STATUS,
  RENTAL_STATUS_TRANSITIONS,
} from '../src/rentals/rentals.constants';
import {
  canCancel,
  canCheckout,
  canComplete,
  canInitiateReturn,
  canTransitionRentalStatus,
  assertRentalTransition,
  isOutboundRentalStatus,
  isRentalStatus,
} from '../src/rentals/rentals.rules';
import { toRentalPublic } from '../src/rentals/rentals.mapper';

describe('rentals.rules', () => {
  it('validates rental status graph', () => {
    expect(canTransitionRentalStatus(RENTAL_STATUS.DRAFT, RENTAL_STATUS.CHECKED_OUT)).toBe(
      true,
    );
    expect(canTransitionRentalStatus(RENTAL_STATUS.CHECKED_OUT, RENTAL_STATUS.ACTIVE)).toBe(
      true,
    );
    expect(canTransitionRentalStatus(RENTAL_STATUS.ACTIVE, RENTAL_STATUS.RETURN_PENDING)).toBe(
      true,
    );
    expect(canTransitionRentalStatus(RENTAL_STATUS.ACTIVE, RENTAL_STATUS.OVERDUE)).toBe(true);
    expect(canTransitionRentalStatus(RENTAL_STATUS.DRAFT, RENTAL_STATUS.ACTIVE)).toBe(false);
    expect(canTransitionRentalStatus(RENTAL_STATUS.COMPLETED, RENTAL_STATUS.ACTIVE)).toBe(
      false,
    );
    expect(isRentalStatus('active')).toBe(true);
    expect(isRentalStatus('nope')).toBe(false);
    expect(canCheckout(RENTAL_STATUS.DRAFT)).toBe(true);
    expect(canCheckout(RENTAL_STATUS.ACTIVE)).toBe(false);
    expect(canComplete(RENTAL_STATUS.RETURN_PENDING)).toBe(true);
    expect(canComplete(RENTAL_STATUS.ACTIVE)).toBe(false);
    expect(canInitiateReturn(RENTAL_STATUS.ACTIVE)).toBe(true);
    expect(canInitiateReturn(RENTAL_STATUS.DRAFT)).toBe(false);
    expect(canCancel(RENTAL_STATUS.DRAFT)).toBe(true);
    expect(canCancel(RENTAL_STATUS.COMPLETED)).toBe(false);
    expect(isOutboundRentalStatus(RENTAL_STATUS.OVERDUE)).toBe(true);
    expect(Object.keys(RENTAL_STATUS_TRANSITIONS).length).toBe(7);
    expect(() =>
      assertRentalTransition(RENTAL_STATUS.DRAFT, RENTAL_STATUS.ACTIVE),
    ).toThrow(/Invalid rental transition/);
    assertRentalTransition(RENTAL_STATUS.DRAFT, RENTAL_STATUS.CHECKED_OUT);
  });

  it('maps public rental shape including nulls', () => {
    const pub = toRentalPublic({
      id: 'r1',
      rentalNumber: 'RENT-00000001',
      customerId: 'c1',
      rentalDate: new Date('2026-01-01'),
      expectedReturnDate: new Date('2026-01-03'),
      actualReturnDate: null,
      status: 'draft',
      notes: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      deletedBy: null,
      customer: null as never,
      items: [
        {
          id: 'ri1',
          rentalId: 'r1',
          itemId: 'i1',
          barcodeValue: 'DR-1',
          agreedRentalPrice: 1000,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          item: null as never,
        },
      ],
      statusHistory: [
        {
          id: 'h1',
          rentalId: 'r1',
          oldStatus: 'draft',
          newStatus: 'draft',
          reason: 'created',
          userId: null,
          username: null,
          createdAt: new Date(),
        },
      ],
    });
    expect(pub.customer).toBeNull();
    expect(pub.items[0].item).toBeNull();
  });
});

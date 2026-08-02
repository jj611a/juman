import { describe, expect, it } from 'vitest';
import { rangesOverlap } from '../src/reservations/availability/availability.types';
import {
  RESERVATION_STATUS,
  RESERVATION_STATUS_TRANSITIONS,
} from '../src/reservations/reservations.constants';
import {
  canCancelReservation,
  canCheckoutReservation,
  canExpireReservation,
  canTransitionReservationStatus,
  isReservationStatus,
} from '../src/reservations/reservations.rules';
import { toReservationPublic } from '../src/reservations/reservations.mapper';

describe('availability ranges + reservation rules', () => {
  it('detects half-open range overlaps', () => {
    const a = new Date('2026-08-01T00:00:00Z');
    const b = new Date('2026-08-05T00:00:00Z');
    const c = new Date('2026-08-04T00:00:00Z');
    const d = new Date('2026-08-10T00:00:00Z');
    expect(rangesOverlap(a, b, c, d)).toBe(true);
    expect(rangesOverlap(a, b, b, d)).toBe(false);
    expect(rangesOverlap(a, b, new Date('2026-07-01'), a)).toBe(false);
  });

  it('validates reservation status graph', () => {
    expect(
      canTransitionReservationStatus(
        RESERVATION_STATUS.DRAFT,
        RESERVATION_STATUS.CONFIRMED,
      ),
    ).toBe(true);
    expect(
      canTransitionReservationStatus(
        RESERVATION_STATUS.CONFIRMED,
        RESERVATION_STATUS.CHECKED_OUT,
      ),
    ).toBe(true);
    expect(
      canTransitionReservationStatus(
        RESERVATION_STATUS.CHECKED_OUT,
        RESERVATION_STATUS.CANCELLED,
      ),
    ).toBe(false);
    expect(canCheckoutReservation(RESERVATION_STATUS.CONFIRMED)).toBe(true);
    expect(canCheckoutReservation(RESERVATION_STATUS.DRAFT)).toBe(false);
    expect(canCancelReservation(RESERVATION_STATUS.CONFIRMED)).toBe(true);
    expect(canExpireReservation(RESERVATION_STATUS.DRAFT)).toBe(true);
    expect(canExpireReservation(RESERVATION_STATUS.CHECKED_OUT)).toBe(false);
    expect(isReservationStatus('confirmed')).toBe(true);
    expect(isReservationStatus('nope')).toBe(false);
    expect(Object.keys(RESERVATION_STATUS_TRANSITIONS).length).toBe(6);
  });

  it('maps public reservation shape', () => {
    const pub = toReservationPublic({
      id: 'rs1',
      reservationNumber: 'RSV-1',
      customerId: 'c1',
      startDate: new Date(),
      expectedCheckoutDate: new Date(),
      expectedReturnDate: new Date(),
      status: 'confirmed',
      notes: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      deletedBy: null,
      customer: null as never,
      rental: null,
      items: [],
      statusHistory: [],
    });
    expect(pub.reservationNumber).toBe('RSV-1');
    expect(pub.customer).toBeNull();
    expect(pub.rental).toBeNull();
  });
});

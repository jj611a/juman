import {
  RESERVATION_STATUS,
  RESERVATION_STATUS_TRANSITIONS,
  RESERVATION_STATUS_VALUES,
  type ReservationStatus,
} from './reservations.constants';

export function isReservationStatus(value: string): value is ReservationStatus {
  return (RESERVATION_STATUS_VALUES as string[]).includes(value);
}

export function canTransitionReservationStatus(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return RESERVATION_STATUS_TRANSITIONS[from].includes(to);
}

export function canCheckoutReservation(status: string): boolean {
  return status === RESERVATION_STATUS.CONFIRMED;
}

export function canCancelReservation(status: string): boolean {
  return (
    status === RESERVATION_STATUS.DRAFT ||
    status === RESERVATION_STATUS.CONFIRMED
  );
}

export function canExpireReservation(status: string): boolean {
  return (
    status === RESERVATION_STATUS.DRAFT ||
    status === RESERVATION_STATUS.CONFIRMED
  );
}

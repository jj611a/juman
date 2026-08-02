import {
  RENTAL_STATUS,
  RENTAL_STATUS_TRANSITIONS,
  RENTAL_STATUS_VALUES,
  type RentalStatus,
} from './rentals.constants';

export function isRentalStatus(value: string): value is RentalStatus {
  return (RENTAL_STATUS_VALUES as string[]).includes(value);
}

export function canTransitionRentalStatus(
  from: RentalStatus,
  to: RentalStatus,
): boolean {
  return RENTAL_STATUS_TRANSITIONS[from].includes(to);
}

export function assertRentalTransition(from: RentalStatus, to: RentalStatus): void {
  if (!canTransitionRentalStatus(from, to)) {
    throw new Error(`Invalid rental transition: ${from} → ${to}`);
  }
}

/** Statuses where items are physically out (inventory should be rented). */
export function isOutboundRentalStatus(status: string): boolean {
  return (
    status === RENTAL_STATUS.CHECKED_OUT ||
    status === RENTAL_STATUS.ACTIVE ||
    status === RENTAL_STATUS.OVERDUE
  );
}

export function canInitiateReturn(status: string): boolean {
  return isOutboundRentalStatus(status);
}

export function canCancel(status: string): boolean {
  return (
    status === RENTAL_STATUS.DRAFT ||
    status === RENTAL_STATUS.CHECKED_OUT ||
    status === RENTAL_STATUS.ACTIVE ||
    status === RENTAL_STATUS.OVERDUE
  );
}

export function canCheckout(status: string): boolean {
  return status === RENTAL_STATUS.DRAFT;
}

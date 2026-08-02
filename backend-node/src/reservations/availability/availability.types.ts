export type AvailabilityConflictKind = 'reservation' | 'rental';

export interface AvailabilityWindow {
  readonly itemId: string;
  readonly start: Date;
  readonly end: Date;
  readonly excludeReservationId?: string | null;
  readonly excludeRentalId?: string | null;
}

export interface AvailabilityConflict {
  readonly kind: AvailabilityConflictKind;
  readonly id: string;
  readonly number: string;
  readonly itemId: string;
  readonly start: Date;
  readonly end: Date;
  readonly status: string;
}

/** Half-open overlap: [start, end) intersects [otherStart, otherEnd). */
export function rangesOverlap(
  start: Date,
  end: Date,
  otherStart: Date,
  otherEnd: Date,
): boolean {
  return start.getTime() < otherEnd.getTime() && end.getTime() > otherStart.getTime();
}

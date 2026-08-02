import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BusinessException } from '../../shared/errors/business.exception';
import { RENTAL_STATUS } from '../../rentals/rentals.constants';
import { RESERVATION_STATUS } from '../reservations.constants';
import {
  rangesOverlap,
  type AvailabilityConflict,
  type AvailabilityWindow,
} from './availability.types';

/** Reservation statuses that still hold a calendar window. */
const BLOCKING_RESERVATION_STATUSES: readonly string[] = [
  RESERVATION_STATUS.DRAFT,
  RESERVATION_STATUS.CONFIRMED,
];

/** Rental statuses that still occupy an item window. */
const BLOCKING_RENTAL_STATUSES: readonly string[] = [
  RENTAL_STATUS.DRAFT,
  RENTAL_STATUS.CHECKED_OUT,
  RENTAL_STATUS.ACTIVE,
  RENTAL_STATUS.RETURN_PENDING,
  RENTAL_STATUS.OVERDUE,
];

/**
 * Reusable availability / conflict detector (calendar-ready).
 * Cancelled / expired / completed reservations and cancelled / completed rentals are ignored.
 */
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async findConflicts(
    window: AvailabilityWindow,
  ): Promise<AvailabilityConflict[]> {
    if (window.end.getTime() <= window.start.getTime()) {
      return [];
    }

    const [reservationRows, rentalRows] = await Promise.all([
      this.prisma.reservationItem.findMany({
        where: {
          itemId: window.itemId,
          reservation: {
            deletedAt: null,
            status: { in: [...BLOCKING_RESERVATION_STATUSES] },
            ...(window.excludeReservationId
              ? { id: { not: window.excludeReservationId } }
              : {}),
          },
        },
        include: {
          reservation: {
            select: {
              id: true,
              reservationNumber: true,
              startDate: true,
              expectedReturnDate: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.rentalItem.findMany({
        where: {
          itemId: window.itemId,
          rental: {
            deletedAt: null,
            status: { in: [...BLOCKING_RENTAL_STATUSES] },
            ...(window.excludeRentalId
              ? { id: { not: window.excludeRentalId } }
              : {}),
          },
        },
        include: {
          rental: {
            select: {
              id: true,
              rentalNumber: true,
              rentalDate: true,
              expectedReturnDate: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const conflicts: AvailabilityConflict[] = [];

    for (const row of reservationRows) {
      const r = row.reservation;
      if (
        rangesOverlap(
          window.start,
          window.end,
          r.startDate,
          r.expectedReturnDate,
        )
      ) {
        conflicts.push({
          kind: 'reservation',
          id: r.id,
          number: r.reservationNumber,
          itemId: window.itemId,
          start: r.startDate,
          end: r.expectedReturnDate,
          status: r.status,
        });
      }
    }

    for (const row of rentalRows) {
      const r = row.rental;
      if (
        rangesOverlap(
          window.start,
          window.end,
          r.rentalDate,
          r.expectedReturnDate,
        )
      ) {
        conflicts.push({
          kind: 'rental',
          id: r.id,
          number: r.rentalNumber,
          itemId: window.itemId,
          start: r.rentalDate,
          end: r.expectedReturnDate,
          status: r.status,
        });
      }
    }

    return conflicts;
  }

  async assertAvailable(window: AvailabilityWindow): Promise<void> {
    const conflicts = await this.findConflicts(window);
    if (conflicts.length === 0) return;
    const first = conflicts[0];
    throw BusinessException.conflict(
      `Item has conflicting ${first.kind} ${first.number} (${first.status})`,
      conflicts.map(
        (c) => `${c.kind}:${c.number}:${c.status}:${c.start.toISOString()}`,
      ),
    );
  }

  async assertItemsAvailable(
    itemIds: string[],
    start: Date,
    end: Date,
    opts?: {
      excludeReservationId?: string | null;
      excludeRentalId?: string | null;
    },
  ): Promise<void> {
    for (const itemId of itemIds) {
      await this.assertAvailable({
        itemId,
        start,
        end,
        excludeReservationId: opts?.excludeReservationId,
        excludeRentalId: opts?.excludeRentalId,
      });
    }
  }
}
